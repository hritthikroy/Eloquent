// Package audio provides full lifecycle management, auto-recovery restart loops,
// and health inspection for the Eloquent audio processing pipeline.
package audio

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

// ServiceState represents the operational status of AudioService.
type ServiceState uint32

const (
	StateStopped ServiceState = iota
	StateStarting
	StateRunning
	StateStopping
	StateError
)

func (s ServiceState) String() string {
	switch s {
	case StateStopped:
		return "stopped"
	case StateStarting:
		return "starting"
	case StateRunning:
		return "running"
	case StateStopping:
		return "stopping"
	case StateError:
		return "error"
	default:
		return "unknown"
	}
}

// HealthStatus conveys real-time health telemetry to external monitoring systems.
type HealthStatus struct {
	State          string  `json:"state"`
	UptimeMs       int64   `json:"uptimeMs"`
	FramesIngested uint64  `json:"framesIngested"`
	DropRate       float64 `json:"dropRate"`
	BridgeHealthy  bool    `json:"bridgeHealthy"`
	LastErrorMs    int64   `json:"lastErrorMs"`
	IsHealthy      bool    `json:"isHealthy"`
}

// ServiceConfig configures processing, streaming, and restart tolerance.
type ServiceConfig struct {
	ProcessorConfig ProcessorConfig `json:"processorConfig"`
	StreamerConfig  StreamerConfig  `json:"streamerConfig"`
	BufferSize      int             `json:"bufferSize"`
	MaxRestarts     int             `json:"maxRestarts"`
	RestartDelay    time.Duration   `json:"restartDelay"`
}

// DefaultServiceConfig supplies standard production settings.
func DefaultServiceConfig() ServiceConfig {
	return ServiceConfig{
		ProcessorConfig: ProcessorConfig{
			DefaultBufferSize: 1920,
			SpeechThreshold:   0.003,
			MaxPooledSize:     65536,
			ChannelCapacity:   256,
			UnderflowTimeout:  20 * time.Millisecond,
		},
		StreamerConfig: StreamerConfig{
			ChunkSize:      1920,
			MaxConcurrency: 8,
			FlushTimeout:   50 * time.Millisecond,
		},
		BufferSize:   1920,
		MaxRestarts:  5,
		RestartDelay: 500 * time.Millisecond,
	}
}

// AudioService coordinates the BufferProcessor, AudioStreamer, and ZeroCopyBridge.
type AudioService struct {
	cfg         ServiceConfig
	processor   *BufferProcessor
	streamer    *AudioStreamer
	bridge      *ZeroCopyBridge
	state       atomic.Uint32
	startTime   time.Time
	restarts    atomic.Uint32
	lastErrTime atomic.Int64

	mu     sync.Mutex
	cancel context.CancelFunc
	done   chan struct{}
}

// NewAudioService instantiates an AudioService with all internal subsystems.
func NewAudioService(cfg ServiceConfig) *AudioService {
	bp := NewBufferProcessor(cfg.ProcessorConfig)
	st := NewAudioStreamer(bp, cfg.StreamerConfig)
	br := NewZeroCopyBridge()

	s := &AudioService{
		cfg:       cfg,
		processor: bp,
		streamer:  st,
		bridge:    br,
		done:      make(chan struct{}),
	}
	s.state.Store(uint32(StateStopped))
	s.lastErrTime.Store(-1)
	return s
}

// Start boots the background audio processing loop with auto-recovery.
func (s *AudioService) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	currentState := ServiceState(s.state.Load())
	if currentState == StateRunning || currentState == StateStarting {
		return errors.New("audio service is already active")
	}

	s.state.Store(uint32(StateStarting))
	s.startTime = time.Now()
	s.done = make(chan struct{})

	childCtx, cancel := context.WithCancel(ctx)
	s.cancel = cancel

	go s.runLoop(childCtx)
	s.state.Store(uint32(StateRunning))
	return nil
}

// runLoop executes the primary processing loop with restart recovery.
func (s *AudioService) runLoop(ctx context.Context) {
	defer func() {
		s.state.Store(uint32(StateStopped))
		close(s.done)
	}()

	for {
		err := s.processor.RunProcessingLoop(ctx)
		if err == nil || errors.Is(err, context.Canceled) {
			return
		}

		s.lastErrTime.Store(time.Now().UnixNano())
		curRestarts := s.restarts.Add(1)
		log.Printf("[AudioService] Processing loop halted: %v (restart %d/%d)", err, curRestarts, s.cfg.MaxRestarts)

		if int(curRestarts) > s.cfg.MaxRestarts {
			log.Printf("[AudioService] Maximum restart threshold exceeded. Transitioning to error state.")
			s.state.Store(uint32(StateError))
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(s.cfg.RestartDelay):
		}
	}
}

// Stop gracefully halts audio streaming and processing.
func (s *AudioService) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	currentState := ServiceState(s.state.Load())
	if currentState == StateStopped || currentState == StateStopping {
		return nil
	}

	s.state.Store(uint32(StateStopping))
	if s.cancel != nil {
		s.cancel()
	}

	select {
	case <-s.done:
	case <-time.After(5 * time.Second):
		log.Println("[AudioService] Stop timed out after 5s")
	}

	_ = s.bridge.Close()
	s.state.Store(uint32(StateStopped))
	return nil
}

// IngestFrame submits a raw PCM frame through zero-copy bridge and buffer processor.
func (s *AudioService) IngestFrame(data []byte) error {
	if ServiceState(s.state.Load()) != StateRunning {
		return errors.New("audio service is not currently running")
	}

	// Try zero-copy bridge transfer
	_, bridgeErr := s.bridge.Transfer(data, DirectionInbound)

	// Try submitting directly to processor inChan
	ok := s.processor.TrySubmitFrame(data)

	if !ok && bridgeErr != nil {
		return fmt.Errorf("frame ingestion failed: buffer full and bridge error: %w", bridgeErr)
	}
	return nil
}

// HealthCheck produces a composite health check snapshot.
func (s *AudioService) HealthCheck() HealthStatus {
	state := ServiceState(s.state.Load())
	metrics := s.processor.GetMetrics()
	brMetrics := s.bridge.GetMetrics()

	uptimeMs := int64(0)
	if state == StateRunning && !s.startTime.IsZero() {
		uptimeMs = time.Since(s.startTime).Milliseconds()
	}

	totalInputs := metrics.TotalAllocations + metrics.DroppedInputs
	dropRate := 0.0
	if totalInputs > 0 {
		dropRate = float64(metrics.DroppedInputs) / float64(totalInputs)
	}

	lastErrNs := s.lastErrTime.Load()
	lastErrMs := int64(-1)
	if lastErrNs > 0 {
		lastErrMs = (time.Now().UnixNano() - lastErrNs) / 1e6
	}

	isHealthy := state == StateRunning && dropRate < 0.05 && !brMetrics.IsClosed

	return HealthStatus{
		State:          state.String(),
		UptimeMs:       uptimeMs,
		FramesIngested: metrics.TotalAllocations,
		DropRate:       dropRate,
		BridgeHealthy:  !brMetrics.IsClosed && brMetrics.ContentionCount < 100,
		LastErrorMs:    lastErrMs,
		IsHealthy:      isHealthy,
	}
}

// Processor returns the underlying BufferProcessor instance.
func (s *AudioService) Processor() *BufferProcessor {
	return s.processor
}

// Bridge returns the active ZeroCopyBridge instance.
func (s *AudioService) Bridge() *ZeroCopyBridge {
	return s.bridge
}
