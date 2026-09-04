// Package audio provides memory-efficient, non-blocking audio processing and buffer
// management for the Eloquent Go audio backend. It utilizes a sync.Pool for byte slice
// reuse, atomic pointers for lock-free buffer state synchronization, non-blocking channels
// for zero-latency frame streaming, and graceful silence injection to handle underflow
// without panics.
package audio

import (
	"context"
	"errors"
	"math"
	"sync"
	"sync/atomic"
	"time"
)

var (
	// ErrInvalidBufferSize indicates an invalid buffer size request.
	ErrInvalidBufferSize = errors.New("requested buffer size must be greater than zero")
	// ErrNilBuffer indicates an attempt to release a nil buffer.
	ErrNilBuffer = errors.New("cannot release nil buffer to pool")
	// ErrLoopAlreadyRunning indicates the processing loop is already active.
	ErrLoopAlreadyRunning = errors.New("processing loop is already running")
)

// BufferStatus indicates the current lifecycle state of the audio buffer pipeline.
type BufferStatus int

const (
	// StatusIdle indicates no audio is currently being processed.
	StatusIdle BufferStatus = iota
	// StatusProcessing indicates frames are actively being streamed and processed.
	StatusProcessing
	// StatusUnderflow indicates incoming audio starved, triggering graceful silence insertion.
	StatusUnderflow
	// StatusOverflow indicates the buffer or output channel reached capacity.
	StatusOverflow
)

// String returns a human-readable representation of BufferStatus.
func (s BufferStatus) String() string {
	switch s {
	case StatusIdle:
		return "idle"
	case StatusProcessing:
		return "processing"
	case StatusUnderflow:
		return "underflow"
	case StatusOverflow:
		return "overflow"
	default:
		return "unknown"
	}
}

// BufferState represents a lock-free atomic snapshot of buffer health and processing state.
type BufferState struct {
	Status         BufferStatus `json:"status"`
	Capacity       int          `json:"capacity"`
	Filled         int          `json:"filled"`
	UnderflowCount uint64       `json:"underflowCount"`
	DroppedInputs  uint64       `json:"droppedInputs"`
	DroppedOutputs uint64       `json:"droppedOutputs"`
	LastProcessed  time.Time    `json:"lastProcessed"`
}

// ProcessedFrame represents an audio frame analyzed with pooled memory and sub-millisecond telemetry.
type ProcessedFrame struct {
	Data        []byte  `json:"data"`
	Size        int     `json:"size"`
	RMS         float64 `json:"rms"`
	Peak        int16   `json:"peak"`
	IsSpeech    bool    `json:"isSpeech"`
	IsSilence   bool    `json:"isSilence"`
	IsUnderflow bool    `json:"isUnderflow"`
	IsRecycled  bool    `json:"isRecycled"`
	TimestampNs int64   `json:"timestampNs"`
}

// PoolMetrics tracks buffer reuse efficiency, underflow frequency, and channel telemetry.
type PoolMetrics struct {
	PoolHits          uint64  `json:"poolHits"`
	PoolMisses        uint64  `json:"poolMisses"`
	TotalAllocations  uint64  `json:"totalAllocations"`
	TotalRecycled     uint64  `json:"totalRecycled"`
	ActiveInFlight    int64   `json:"activeInFlight"`
	HitRatioPercent   float64 `json:"hitRatioPercent"`
	FallbackCount     uint64  `json:"fallbackCount"`
	UnderflowCount    uint64  `json:"underflowCount"`
	DroppedInputs     uint64  `json:"droppedInputs"`
	DroppedOutputs    uint64  `json:"droppedOutputs"`
}

// ProcessorConfig defines audio processing, buffer pooling, and non-blocking channel parameters.
type ProcessorConfig struct {
	DefaultBufferSize int           `json:"defaultBufferSize"` // e.g. 4096 or 1920
	SpeechThreshold   float64       `json:"speechThreshold"`   // RMS threshold for speech detection
	MaxPooledSize     int           `json:"maxPooledSize"`     // Upper bound on pooled buffers
	ChannelCapacity   int           `json:"channelCapacity"`   // Ring channel buffer depth
	UnderflowTimeout  time.Duration `json:"underflowTimeout"`  // Wait duration before inserting silence
}

// BufferProcessor manages reusable byte slices via sync.Pool, atomic pointers for state,
// and non-blocking channels for sub-millisecond audio streaming without UI thread starvation.
type BufferProcessor struct {
	config ProcessorConfig
	pool   sync.Pool

	// Atomic pointer for lock-free state synchronization
	state atomic.Pointer[BufferState]

	// Non-blocking frame communication channels
	inChan  chan []byte
	outChan chan *ProcessedFrame

	// Lifecycle state
	loopRunning atomic.Bool

	// Atomic telemetry metrics
	poolHits         atomic.Uint64
	poolMisses       atomic.Uint64
	totalAllocations atomic.Uint64
	totalRecycled    atomic.Uint64
	activeInFlight   atomic.Int64
	fallbackCount    atomic.Uint64
	underflowCount   atomic.Uint64
	droppedInputs    atomic.Uint64
	droppedOutputs   atomic.Uint64
}

// NewBufferProcessor creates a new BufferProcessor with initialized pool, atomic pointer state,
// and non-blocking channels.
func NewBufferProcessor(cfg ProcessorConfig) *BufferProcessor {
	if cfg.DefaultBufferSize <= 0 {
		cfg.DefaultBufferSize = 4096
	}
	if cfg.SpeechThreshold <= 0 {
		cfg.SpeechThreshold = 0.003
	}
	if cfg.MaxPooledSize <= 0 {
		cfg.MaxPooledSize = 65536 // 64KB max pooled buffer
	}
	if cfg.ChannelCapacity <= 0 {
		cfg.ChannelCapacity = 128 // Non-blocking channel buffer depth
	}
	if cfg.UnderflowTimeout <= 0 {
		cfg.UnderflowTimeout = 10 * time.Millisecond
	}

	bp := &BufferProcessor{
		config:  cfg,
		inChan:  make(chan []byte, cfg.ChannelCapacity),
		outChan: make(chan *ProcessedFrame, cfg.ChannelCapacity),
	}

	initialState := &BufferState{
		Status:        StatusIdle,
		Capacity:      cfg.DefaultBufferSize,
		Filled:        0,
		LastProcessed: time.Now(),
	}
	bp.state.Store(initialState)

	return bp
}

// GetState atomically loads the current BufferState snapshot.
func (bp *BufferProcessor) GetState() BufferState {
	s := bp.state.Load()
	if s == nil {
		return BufferState{Status: StatusIdle}
	}
	return *s
}

// updateState updates the atomic pointer state snapshot using CAS retry loop.
func (bp *BufferProcessor) updateState(fn func(*BufferState) *BufferState) {
	for {
		current := bp.state.Load()
		if current == nil {
			current = &BufferState{Status: StatusIdle}
		}
		next := fn(current)
		if bp.state.CompareAndSwap(current, next) {
			break
		}
	}
}

// InChan returns the non-blocking input channel for audio chunks.
func (bp *BufferProcessor) InChan() chan<- []byte {
	return bp.inChan
}

// OutChan returns the non-blocking output channel for analyzed frames.
func (bp *BufferProcessor) OutChan() <-chan *ProcessedFrame {
	return bp.outChan
}

// TrySubmitFrame attempts a non-blocking push to the incoming audio channel.
// Returns false and increments dropped telemetry if the channel is full, preventing thread blocking.
func (bp *BufferProcessor) TrySubmitFrame(data []byte) bool {
	select {
	case bp.inChan <- data:
		return true
	default:
		bp.droppedInputs.Add(1)
		bp.updateState(func(s *BufferState) *BufferState {
			clone := *s
			clone.DroppedInputs++
			clone.Status = StatusOverflow
			return &clone
		})
		return false
	}
}

// TryReceiveFrame attempts a non-blocking pull from the output channel.
// Returns nil, false if no frame is immediately available.
func (bp *BufferProcessor) TryReceiveFrame() (*ProcessedFrame, bool) {
	select {
	case frame, ok := <-bp.outChan:
		return frame, ok
	default:
		return nil, false
	}
}

// AcquireBuffer acquires a byte slice of at least minSize from the pool.
// Includes a fallback mechanism if the pool is exhausted or cleared by GC.
func (bp *BufferProcessor) AcquireBuffer(minSize int) []byte {
	if minSize <= 0 {
		minSize = bp.config.DefaultBufferSize
	}

	// 1. Try to acquire from sync.Pool
	obj := bp.pool.Get()
	if obj != nil {
		raw, ok := obj.([]byte)
		if ok && cap(raw) >= minSize {
			bp.poolHits.Add(1)
			bp.activeInFlight.Add(1)
			return raw[:minSize]
		}
		// Pool returned buffer with insufficient capacity -> fallback
		bp.fallbackCount.Add(1)
	}

	// 2. Fallback / Pool Miss Allocation:
	if minSize > bp.config.DefaultBufferSize {
		bp.fallbackCount.Add(1)
	}
	bp.poolMisses.Add(1)
	bp.totalAllocations.Add(1)
	bp.activeInFlight.Add(1)
	return make([]byte, minSize)
}

// ReleaseBuffer returns a previously acquired buffer back to the sync.Pool.
func (bp *BufferProcessor) ReleaseBuffer(buf []byte) error {
	if buf == nil {
		return ErrNilBuffer
	}

	// Do not pool excessively large buffers to prevent heap retention bloat
	if cap(buf) > bp.config.MaxPooledSize {
		bp.activeInFlight.Add(-1)
		return nil
	}

	// Reset slice to its full capacity for next consumer
	recycled := buf[:cap(buf)]

	bp.totalRecycled.Add(1)
	bp.activeInFlight.Add(-1)
	bp.pool.Put(recycled)
	return nil
}

// InsertSilence handles buffer underflow scenarios with graceful silence insertion
// rather than panic-inducing nil pointer dereferences. It returns a zero-filled
// 16-bit PCM frame, increments underflow telemetry, and updates state atomically.
func (bp *BufferProcessor) InsertSilence(size int) *ProcessedFrame {
	if size <= 0 {
		size = bp.config.DefaultBufferSize
	}

	buf := bp.AcquireBuffer(size)
	// Zero-fill the buffer (PCM 16-bit silence: 0x00)
	for i := range buf {
		buf[i] = 0
	}

	underflows := bp.underflowCount.Add(1)
	now := time.Now()

	bp.updateState(func(s *BufferState) *BufferState {
		clone := *s
		clone.UnderflowCount = underflows
		clone.Status = StatusUnderflow
		clone.Filled = 0
		clone.LastProcessed = now
		return &clone
	})

	return &ProcessedFrame{
		Data:        buf,
		Size:        size,
		RMS:         0,
		Peak:        0,
		IsSpeech:    false,
		IsSilence:   true,
		IsUnderflow: true,
		IsRecycled:  true,
		TimestampNs: now.UnixNano(),
	}
}

// ProcessAudioFrame analyzes 16-bit PCM audio data using pooled memory and constant O(1) time
// complexity per sample. If input is nil, it gracefully inserts silence rather than panicking.
func (bp *BufferProcessor) ProcessAudioFrame(input []byte) (*ProcessedFrame, error) {
	// EDGE-CASE: Graceful silence insertion on nil input (prevents nil pointer dereference)
	if input == nil {
		return bp.InsertSilence(bp.config.DefaultBufferSize), nil
	}

	if len(input) == 0 {
		return &ProcessedFrame{
			Data:        nil,
			Size:        0,
			RMS:         0,
			Peak:        0,
			IsSpeech:    false,
			IsSilence:   true,
			IsUnderflow: false,
			IsRecycled:  false,
			TimestampNs: time.Now().UnixNano(),
		}, nil
	}

	// Acquire pooled buffer for processing
	workBuf := bp.AcquireBuffer(len(input))
	copy(workBuf, input)

	var sumSq float64
	var peak int16
	sampleCount := len(input) / 2

	// O(1) constant time per sample: fixed scalar operations per 16-bit PCM sample
	for i := 0; i < len(input)-1; i += 2 {
		sample := int16(uint16(workBuf[i]) | (uint16(workBuf[i+1]) << 8))
		if sample < 0 {
			if -sample > peak {
				peak = -sample
			}
		} else {
			if sample > peak {
				peak = sample
			}
		}

		normalized := float64(sample) / 32768.0
		sumSq += normalized * normalized
	}

	var rms float64
	if sampleCount > 0 {
		rms = math.Sqrt(sumSq / float64(sampleCount))
	}

	isSpeech := rms >= bp.config.SpeechThreshold
	isSilence := rms < 0.0001
	now := time.Now()

	// Update atomic state
	bp.updateState(func(s *BufferState) *BufferState {
		clone := *s
		clone.Filled = len(input)
		clone.Status = StatusProcessing
		clone.LastProcessed = now
		return &clone
	})

	frame := &ProcessedFrame{
		Data:        workBuf,
		Size:        len(input),
		RMS:         rms,
		Peak:        peak,
		IsSpeech:    isSpeech,
		IsSilence:   isSilence,
		IsUnderflow: false,
		IsRecycled:  true,
		TimestampNs: now.UnixNano(),
	}

	return frame, nil
}

// RunProcessingLoop executes the primary latency-sensitive processing loop.
// It continuously consumes frames from inChan using non-blocking channel operations,
// analyzes samples in O(1) time, gracefully injects silence on underflow/timeout,
// and dispatches to outChan without blocking or starving downstream listeners.
func (bp *BufferProcessor) RunProcessingLoop(ctx context.Context) error {
	if bp.loopRunning.Swap(true) {
		return ErrLoopAlreadyRunning
	}
	defer bp.loopRunning.Store(false)

	ticker := time.NewTicker(bp.config.UnderflowTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()

		case input, ok := <-bp.inChan:
			if !ok {
				return nil
			}

			frame, err := bp.ProcessAudioFrame(input)
			if err != nil {
				continue
			}

			// Non-blocking dispatch to outChan
			select {
			case bp.outChan <- frame:
				// Successfully dispatched
			default:
				// Channel full -> increment dropped count and recycle buffer immediately
				bp.droppedOutputs.Add(1)
				bp.updateState(func(s *BufferState) *BufferState {
					clone := *s
					clone.DroppedOutputs++
					clone.Status = StatusOverflow
					return &clone
				})
				if frame.Data != nil {
					_ = bp.ReleaseBuffer(frame.Data)
				}
			}

		case <-ticker.C:
			// Timeout tick: check if pipeline starved while in processing state
			state := bp.GetState()
			if state.Status == StatusProcessing && time.Since(state.LastProcessed) > bp.config.UnderflowTimeout {
				// Buffer underflow detected: gracefully insert silence
				silenceFrame := bp.InsertSilence(bp.config.DefaultBufferSize)
				select {
				case bp.outChan <- silenceFrame:
				default:
					bp.droppedOutputs.Add(1)
					_ = bp.ReleaseBuffer(silenceFrame.Data)
				}
			}
		}
	}
}

// GetMetrics returns a snapshot of pool telemetry, underflow rates, and hit/miss ratios.
func (bp *BufferProcessor) GetMetrics() PoolMetrics {
	hits := bp.poolHits.Load()
	misses := bp.poolMisses.Load()
	total := hits + misses

	var ratio float64
	if total > 0 {
		ratio = (float64(hits) / float64(total)) * 100.0
	}

	return PoolMetrics{
		PoolHits:         hits,
		PoolMisses:       misses,
		TotalAllocations: bp.totalAllocations.Load(),
		TotalRecycled:    bp.totalRecycled.Load(),
		ActiveInFlight:   bp.activeInFlight.Load(),
		HitRatioPercent:  ratio,
		FallbackCount:    bp.fallbackCount.Load(),
		UnderflowCount:   bp.underflowCount.Load(),
		DroppedInputs:    bp.droppedInputs.Load(),
		DroppedOutputs:   bp.droppedOutputs.Load(),
	}
}
