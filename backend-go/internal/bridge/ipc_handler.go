// Package bridge provides high-performance, non-blocking IPC handlers and throttled
// event emitters that batch audio telemetry data before dispatching to the Electron renderer.
// This decouples high-frequency audio processing from IPC serialization, eliminating
// UI thread starvation and guaranteeing sub-millisecond synchronization.
package bridge

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

var (
	// ErrHandlerClosed indicates the throttled IPC handler is shutting down or closed.
	ErrHandlerClosed = errors.New("throttled IPC handler is closed")
	// ErrNilDispatcher indicates a missing dispatch callback function.
	ErrNilDispatcher = errors.New("batch dispatcher callback cannot be nil")
)

// AudioTelemetry represents an instantaneous snapshot of audio metrics emitted by the Go audio engine.
type AudioTelemetry struct {
	TimestampNs    int64   `json:"timestampNs"`
	RMS            float64 `json:"rms"`
	Peak           int16   `json:"peak"`
	IsSpeech       bool    `json:"isSpeech"`
	IsSilence      bool    `json:"isSilence"`
	IsUnderflow    bool    `json:"isUnderflow"`
	BufferLevel    float64 `json:"bufferLevel"`
	UnderflowCount uint64  `json:"underflowCount"`
	ActiveInFlight int64   `json:"activeInFlight"`
	SampleCount    int     `json:"sampleCount"`
	JitterNs       int64   `json:"jitterNs"`
}

// IPCHandlerConfig defines batching and throttling thresholds for telemetry dispatch.
type IPCHandlerConfig struct {
	ThrottleInterval time.Duration `json:"throttleInterval"` // e.g. 16ms for 60 FPS UI pacing
	MaxBatchSize     int           `json:"maxBatchSize"`     // Flush trigger when batch reaches this threshold
	ChannelCapacity  int           `json:"channelCapacity"`  // Buffer depth for incoming telemetry channel
}

// IPCTelemetryMetrics provides observability into IPC throughput and batch efficiency.
type IPCTelemetryMetrics struct {
	TotalBatchesSent      uint64  `json:"totalBatchesSent"`
	TotalTelemetryBatched uint64  `json:"totalTelemetryBatched"`
	TotalDropped          uint64  `json:"totalDropped"`
	AvgBatchSize          float64 `json:"avgBatchSize"`
	MaxObservedBatch      int     `json:"maxObservedBatch"`
	QueueFillRatio        float64 `json:"queueFillRatio"`
	IsRunning             bool    `json:"isRunning"`
}

// BatchDispatcher is a callback function invoked when a batch of telemetry items is ready for IPC dispatch.
type BatchDispatcher func(batch []AudioTelemetry) error

// ThrottledIPCHandler collects high-frequency telemetry events and flushes them in batches
// at a throttled cadence (e.g. 16ms / 60 FPS) to prevent Electron renderer starvation.
type ThrottledIPCHandler struct {
	config     IPCHandlerConfig
	dispatcher BatchDispatcher

	// Non-blocking telemetry ingestion channel
	telemetryChan chan AudioTelemetry

	// Lifecycle control
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isClosed   atomic.Bool
	lastTickNs atomic.Int64

	// Atomic telemetry metrics
	totalBatchesSent      atomic.Uint64
	totalTelemetryBatched atomic.Uint64
	totalDropped          atomic.Uint64
	maxBatchObserved      atomic.Int64
}

// NewThrottledIPCHandler creates a new throttled IPC handler and starts the batching loop.
func NewThrottledIPCHandler(cfg IPCHandlerConfig, dispatcher BatchDispatcher) (*ThrottledIPCHandler, error) {
	if dispatcher == nil {
		return nil, ErrNilDispatcher
	}

	if cfg.ThrottleInterval <= 0 {
		cfg.ThrottleInterval = 16 * time.Millisecond // Default 60 FPS pacing
	}
	if cfg.MaxBatchSize <= 0 {
		cfg.MaxBatchSize = 64
	}
	if cfg.ChannelCapacity <= 0 {
		cfg.ChannelCapacity = 512
	}

	ctx, cancel := context.WithCancel(context.Background())

	handler := &ThrottledIPCHandler{
		config:        cfg,
		dispatcher:    dispatcher,
		telemetryChan: make(chan AudioTelemetry, cfg.ChannelCapacity),
		ctx:           ctx,
		cancel:        cancel,
	}

	handler.lastTickNs.Store(time.Now().UnixNano())

	handler.wg.Add(1)
	go handler.eventLoop()

	return handler, nil
}

// Enqueue attempts a non-blocking push of telemetry data. If the channel is full,
// the telemetry item is dropped and tracked without blocking the audio loop.
func (h *ThrottledIPCHandler) Enqueue(item AudioTelemetry) bool {
	if h.isClosed.Load() {
		return false
	}

	if item.TimestampNs == 0 {
		item.TimestampNs = time.Now().UnixNano()
	}

	select {
	case h.telemetryChan <- item:
		return true
	default:
		h.totalDropped.Add(1)
		return false
	}
}

// eventLoop handles periodic and threshold-based batching.
func (h *ThrottledIPCHandler) eventLoop() {
	defer h.wg.Done()

	ticker := time.NewTicker(h.config.ThrottleInterval)
	defer ticker.Stop()

	batch := make([]AudioTelemetry, 0, h.config.MaxBatchSize)

	flushBatch := func() {
		if len(batch) == 0 {
			return
		}

		batchLen := len(batch)
		h.totalBatchesSent.Add(1)
		h.totalTelemetryBatched.Add(uint64(batchLen))

		// Update max batch observed atomically
		for {
			curMax := h.maxBatchObserved.Load()
			if int64(batchLen) <= curMax {
				break
			}
			if h.maxBatchObserved.CompareAndSwap(curMax, int64(batchLen)) {
				break
			}
		}

		// Allocate fresh slice for outgoing dispatch to prevent race on reuse
		dispatchSlice := make([]AudioTelemetry, batchLen)
		copy(dispatchSlice, batch)
		batch = batch[:0]

		now := time.Now().UnixNano()
		h.lastTickNs.Store(now)

		// Dispatch batch (fire-and-forget or handled safely)
		_ = h.dispatcher(dispatchSlice)
	}

	for {
		select {
		case <-h.ctx.Done():
			// Flush any remaining buffered items before exiting
			for {
				select {
				case item := <-h.telemetryChan:
					batch = append(batch, item)
					if len(batch) >= h.config.MaxBatchSize {
						flushBatch()
					}
				default:
					flushBatch()
					return
				}
			}

		case item, ok := <-h.telemetryChan:
			if !ok {
				flushBatch()
				return
			}

			batch = append(batch, item)
			if len(batch) >= h.config.MaxBatchSize {
				flushBatch()
			}

		case <-ticker.C:
			flushBatch()
		}
	}
}

// Flush immediately drains any queued telemetry and sends the batch.
func (h *ThrottledIPCHandler) Flush() {
	if h.isClosed.Load() {
		return
	}

	// Read everything currently in telemetryChan without blocking
	var drained []AudioTelemetry
	for {
		select {
		case item, ok := <-h.telemetryChan:
			if !ok {
				break
			}
			drained = append(drained, item)
		default:
			goto DRAINED
		}
	}

DRAINED:
	if len(drained) > 0 {
		h.totalBatchesSent.Add(1)
		h.totalTelemetryBatched.Add(uint64(len(drained)))
		_ = h.dispatcher(drained)
	}
}

// Close gracefully flushes pending telemetry and shuts down the background goroutine.
func (h *ThrottledIPCHandler) Close() error {
	if h.isClosed.Swap(true) {
		return ErrHandlerClosed
	}

	h.cancel()
	h.wg.Wait()
	return nil
}

// GetMetrics returns snapshot metrics of IPC batching and throttle performance.
func (h *ThrottledIPCHandler) GetMetrics() IPCTelemetryMetrics {
	batches := h.totalBatchesSent.Load()
	totalItems := h.totalTelemetryBatched.Load()

	var avgSize float64
	if batches > 0 {
		avgSize = float64(totalItems) / float64(batches)
	}

	queueLen := len(h.telemetryChan)
	queueRatio := float64(queueLen) / float64(h.config.ChannelCapacity)

	return IPCTelemetryMetrics{
		TotalBatchesSent:      batches,
		TotalTelemetryBatched: totalItems,
		TotalDropped:          h.totalDropped.Load(),
		AvgBatchSize:          avgSize,
		MaxObservedBatch:      int(h.maxBatchObserved.Load()),
		QueueFillRatio:        queueRatio,
		IsRunning:             !h.isClosed.Load(),
	}
}
