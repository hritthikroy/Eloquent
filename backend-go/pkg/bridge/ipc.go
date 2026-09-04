// Package bridge provides IPC communication bridges and lifecycle-tracking
// middleware between the Go audio backend and the Electron main process.
package bridge

import (
	"errors"
	"sync/atomic"
	"time"
)

var (
	// ErrBufferLeakDetected indicates that active buffers exceeded the safety threshold.
	ErrBufferLeakDetected = errors.New("potential buffer leak detected: active buffers exceeded threshold")
)

// BridgeMemoryMetrics provides lock-free telemetry on IPC buffer lifecycle and memory health.
type BridgeMemoryMetrics struct {
	ActiveInFlight    int64   `json:"activeInFlight"`
	PeakInFlight      int64   `json:"peakInFlight"`
	TotalAcquired     uint64  `json:"totalAcquired"`
	TotalReleased     uint64  `json:"totalReleased"`
	TotalBytesPassed  uint64  `json:"totalBytesPassed"`
	LeakWarnings      uint64  `json:"leakWarnings"`
	AvgInFlightTimeUs float64 `json:"avgInFlightTimeUs"`
	IsHealthy         bool    `json:"isHealthy"`
}

// MemoryTrackingConfig configures threshold limits for leak detection.
type MemoryTrackingConfig struct {
	MaxInFlightThreshold int64         `json:"maxInFlightThreshold"` // Maximum concurrent buffers before warning
	WarnOnLeak           bool          `json:"warnOnLeak"`
	TrackDuration        bool          `json:"trackDuration"`
	SlowDispatchWarn     time.Duration `json:"slowDispatchWarn"`
}

// MemoryTrackingMiddleware tracks buffer acquisition and release lifecycles
// across asynchronous and concurrent IPC events.
type MemoryTrackingMiddleware struct {
	config MemoryTrackingConfig

	// Atomic telemetry
	activeInFlight   atomic.Int64
	peakInFlight     atomic.Int64
	totalAcquired    atomic.Uint64
	totalReleased    atomic.Uint64
	totalBytesPassed atomic.Uint64
	leakWarnings     atomic.Uint64
	totalInFlightNs  atomic.Int64
}

// NewMemoryTrackingMiddleware creates a new memory tracking middleware.
func NewMemoryTrackingMiddleware(cfg MemoryTrackingConfig) *MemoryTrackingMiddleware {
	if cfg.MaxInFlightThreshold <= 0 {
		cfg.MaxInFlightThreshold = 1000 // High-concurrency ceiling
	}
	if cfg.SlowDispatchWarn <= 0 {
		cfg.SlowDispatchWarn = 50 * time.Millisecond
	}

	return &MemoryTrackingMiddleware{
		config: cfg,
	}
}

// TrackAcquisition increments in-flight buffer counters and updates peak telemetry.
func (m *MemoryTrackingMiddleware) TrackAcquisition(size int) {
	current := m.activeInFlight.Add(1)
	m.totalAcquired.Add(1)
	m.totalBytesPassed.Add(uint64(size))

	// Update peak tracking atomically
	for {
		peak := m.peakInFlight.Load()
		if current <= peak {
			break
		}
		if m.peakInFlight.CompareAndSwap(peak, current) {
			break
		}
	}

	// Check if active buffers exceed safety threshold (leak detection)
	if current > m.config.MaxInFlightThreshold {
		m.leakWarnings.Add(1)
	}
}

// TrackRelease decrements in-flight buffer counters and accumulates duration telemetry.
func (m *MemoryTrackingMiddleware) TrackRelease(startTime time.Time) {
	m.activeInFlight.Add(-1)
	m.totalReleased.Add(1)

	if m.config.TrackDuration && !startTime.IsZero() {
		durNs := time.Since(startTime).Nanoseconds()
		m.totalInFlightNs.Add(durNs)
	}
}

// WrapHandler wraps an IPC frame dispatch handler with automatic buffer lifecycle tracking.
func (m *MemoryTrackingMiddleware) WrapHandler(handler func(data []byte) error) func(data []byte) error {
	return func(data []byte) error {
		m.TrackAcquisition(len(data))
		start := time.Now()

		err := handler(data)

		m.TrackRelease(start)
		return err
	}
}

// GetMetrics returns a snapshot of memory tracking telemetry.
func (m *MemoryTrackingMiddleware) GetMetrics() BridgeMemoryMetrics {
	active := m.activeInFlight.Load()
	peak := m.peakInFlight.Load()
	acquired := m.totalAcquired.Load()
	released := m.totalReleased.Load()
	warnings := m.leakWarnings.Load()
	totalNs := m.totalInFlightNs.Load()

	var avgDurationUs float64
	if released > 0 {
		avgDurationUs = float64(totalNs) / float64(released) / 1000.0
	}

	// Healthy if active buffers remain within safety limits and warnings are low
	isHealthy := active >= 0 && active <= m.config.MaxInFlightThreshold && warnings == 0

	return BridgeMemoryMetrics{
		ActiveInFlight:    active,
		PeakInFlight:      peak,
		TotalAcquired:     acquired,
		TotalReleased:     released,
		TotalBytesPassed:  m.totalBytesPassed.Load(),
		LeakWarnings:      warnings,
		AvgInFlightTimeUs: avgDurationUs,
		IsHealthy:         isHealthy,
	}
}
