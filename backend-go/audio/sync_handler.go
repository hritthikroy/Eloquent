// Package state provides audio synchronization checkpoint management
// and adaptive buffering across the Go audio backend and Electron main process.
package state

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// SyncCheckpoint represents an atomic audio synchronization event emitted to Electron.
type SyncCheckpoint struct {
	EventType          string  `json:"eventType"` // Constant: "SYNC_CHECKPOINT"
	Timestamp          int64   `json:"timestamp"`
	SequenceNumber     int64   `json:"sequenceNumber"`
	BufferHash         string  `json:"bufferHash"`
	BufferLength       int     `json:"bufferLength"`
	LastProcessedToken string  `json:"lastProcessedToken"`
	LastTokenTimestamp int64   `json:"lastTokenTimestamp"`
	IsPaused           bool    `json:"isPaused"`
	CPULoad            float64 `json:"cpuLoad"`
	StateVersion       int     `json:"stateVersion,omitempty"`
}

// SyncHandlerConfig allows configuring sync checkpoint behavior.
type SyncHandlerConfig struct {
	BaseInterval      time.Duration
	MinInterval       time.Duration
	MaxInterval       time.Duration
	AdaptiveBuffering bool
}

// DefaultSyncHandlerConfig returns optimal 50ms standard interval configuration.
func DefaultSyncHandlerConfig() SyncHandlerConfig {
	return SyncHandlerConfig{
		BaseInterval:      50 * time.Millisecond,
		MinInterval:       25 * time.Millisecond,
		MaxInterval:       100 * time.Millisecond,
		AdaptiveBuffering: true,
	}
}

// SyncHandler manages continuous buffer alignment telemetry.
type SyncHandler struct {
	mu                 sync.RWMutex
	config             SyncHandlerConfig
	sequenceNumber     int64
	currentBufferHash  string
	currentBufferLen   int
	lastProcessedToken string
	lastTokenTimestamp int64
	isPaused           bool
	lastCPULoad        float64
	stateVersion       int
	running            int32
	cancelFunc         context.CancelFunc
}

// NewSyncHandler creates an initialized SyncHandler.
func NewSyncHandler(cfg ...SyncHandlerConfig) *SyncHandler {
	config := DefaultSyncHandlerConfig()
	if len(cfg) > 0 {
		config = cfg[0]
	}

	h := &SyncHandler{
		config:             config,
		sequenceNumber:     0,
		currentBufferHash:  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // empty sha256
		currentBufferLen:   0,
		lastProcessedToken: "",
		lastTokenTimestamp: time.Now().UnixMilli(),
		isPaused:           false,
		lastCPULoad:        0.0,
		stateVersion:       1,
	}
	return h
}

// UpdateAudioBuffer computes the SHA-256 hash of the active audio buffer.
func (sh *SyncHandler) UpdateAudioBuffer(data []byte) {
	sh.mu.Lock()
	defer sh.mu.Unlock()

	sh.currentBufferLen = len(data)
	if len(data) == 0 {
		sh.currentBufferHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
		return
	}

	hash := sha256.Sum256(data)
	sh.currentBufferHash = hex.EncodeToString(hash[:])
	sh.stateVersion++
}

// UpdateLastToken updates the latest transcribed/processed token with timestamp.
func (sh *SyncHandler) UpdateLastToken(token string, ts int64) {
	sh.mu.Lock()
	defer sh.mu.Unlock()

	sh.lastProcessedToken = token
	if ts <= 0 {
		sh.lastTokenTimestamp = time.Now().UnixMilli()
	} else {
		sh.lastTokenTimestamp = ts
	}
	sh.stateVersion++
}

// SetPaused updates whether the audio backend stream is paused.
func (sh *SyncHandler) SetPaused(paused bool) {
	sh.mu.Lock()
	defer sh.mu.Unlock()

	sh.isPaused = paused
	sh.stateVersion++
}

// GetCheckpoint generates a point-in-time SyncCheckpoint snapshot.
func (sh *SyncHandler) GetCheckpoint() SyncCheckpoint {
	sh.mu.Lock()
	defer sh.mu.Unlock()

	sh.sequenceNumber++

	// Estimate current CPU load / goroutine pressure for adaptive intervals
	numGoroutines := runtime.NumGoroutine()
	estimatedLoad := float64(numGoroutines) / 100.0
	if estimatedLoad > 1.0 {
		estimatedLoad = 1.0
	}
	sh.lastCPULoad = estimatedLoad

	return SyncCheckpoint{
		EventType:          "SYNC_CHECKPOINT",
		Timestamp:          time.Now().UnixMilli(),
		SequenceNumber:     sh.sequenceNumber,
		BufferHash:         sh.currentBufferHash,
		BufferLength:       sh.currentBufferLen,
		LastProcessedToken: sh.lastProcessedToken,
		LastTokenTimestamp: sh.lastTokenTimestamp,
		IsPaused:           sh.isPaused,
		CPULoad:            sh.lastCPULoad,
		StateVersion:       sh.stateVersion,
	}
}

// AdaptiveInterval computes next interval based on CPU load and paused state.
func (sh *SyncHandler) AdaptiveInterval() time.Duration {
	sh.mu.RLock()
	defer sh.mu.RUnlock()

	if !sh.config.AdaptiveBuffering {
		return sh.config.BaseInterval
	}

	if sh.isPaused {
		// When paused, reduce emission frequency to 150ms to conserve resources
		return 150 * time.Millisecond
	}

	// Dynamic adjustment: Under high CPU load (> 0.70), throttle to 100ms
	// Under light CPU load (< 0.25), run at 25ms for ultra-low sync latency
	if sh.lastCPULoad > 0.70 {
		return sh.config.MaxInterval
	} else if sh.lastCPULoad < 0.25 {
		return sh.config.MinInterval
	}
	return sh.config.BaseInterval
}

// Start begins emitting SYNC_CHECKPOINT events periodically via emitFn.
func (sh *SyncHandler) Start(ctx context.Context, emitFn func(checkpoint SyncCheckpoint)) {
	if !atomic.CompareAndSwapInt32(&sh.running, 0, 1) {
		return
	}

	subCtx, cancel := context.WithCancel(ctx)
	sh.cancelFunc = cancel

	go func() {
		defer atomic.StoreInt32(&sh.running, 0)

		for {
			interval := sh.AdaptiveInterval()
			timer := time.NewTimer(interval)

			select {
			case <-subCtx.Done():
				timer.Stop()
				return
			case <-timer.C:
				cp := sh.GetCheckpoint()
				if emitFn != nil {
					emitFn(cp)
				}
			}
		}
	}()
}

// Stop terminates active emission loop gracefully.
func (sh *SyncHandler) Stop() {
	if atomic.CompareAndSwapInt32(&sh.running, 1, 0) {
		if sh.cancelFunc != nil {
			sh.cancelFunc()
		}
	}
}

// IsRunning reports whether the periodic checkpoint loop is active.
func (sh *SyncHandler) IsRunning() bool {
	return atomic.LoadInt32(&sh.running) == 1
}
