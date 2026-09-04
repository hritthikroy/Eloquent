// Package audio provides real-time clock synchronization, jitter filtering,
// and buffer alignment primitives to eliminate display flickering and buffer desynchronization.
package audio

import (
	"sync"
	"sync/atomic"
	"time"
)

// SyncState represents the current alignment health between audio and visual clocks.
type SyncState string

const (
	SyncStateInSync        SyncState = "in-sync"
	SyncStateLead          SyncState = "lead"
	SyncStateLag           SyncState = "lag"
	SyncStateRecalibrating SyncState = "recalibrating"
)

// ClockSyncConfig configures drift thresholds, display cadence, and jitter filters.
type ClockSyncConfig struct {
	TargetFPS          float64 `json:"targetFps"`          // Default: 60.0 (visual refresh cadence)
	SampleRate         uint32  `json:"sampleRate"`         // Default: 48000
	DriftThresholdUs   int64   `json:"driftThresholdUs"`   // Default: 10000 (10ms tolerance window)
	MaxAllowedDriftUs  int64   `json:"maxAllowedDriftUs"`  // Default: 50000 (50ms hard threshold)
	JitterWindowSize   int     `json:"jitterWindowSize"`   // Moving-average window size (default: 16)
}

// DefaultClockSyncConfig provides production-tuned synchronization defaults.
func DefaultClockSyncConfig() ClockSyncConfig {
	return ClockSyncConfig{
		TargetFPS:         60.0,
		SampleRate:        48000,
		DriftThresholdUs:  10000,
		MaxAllowedDriftUs: 50000,
		JitterWindowSize:  16,
	}
}

// DriftMetrics reports real-time synchronization telemetry and clock offsets.
type DriftMetrics struct {
	ClockDriftUs            int64     `json:"clockDriftUs"`
	AudioPresentationTimeNs int64     `json:"audioPresentationTimeNs"`
	VisualTimestampNs       int64     `json:"visualTimestampNs"`
	DriftCorrections        uint64    `json:"driftCorrections"`
	State                   SyncState `json:"state"`
	SampleOffsetCorrection  int       `json:"sampleOffsetCorrection"`
	AverageJitterUs         int64     `json:"averageJitterUs"`
}

// ClockSynchronizer aligns audio buffer presentation times (PTS) with display refresh cycles.
type ClockSynchronizer struct {
	mu                 sync.RWMutex
	cfg                ClockSyncConfig
	startTime          time.Time
	audioBaseTimeNs    int64
	visualBaseTimeNs   int64
	totalAudioSamples  uint64
	totalVisualFrames  uint64
	jitterWindow       []int64
	jitterIdx          int
	jitterFilled       bool
	lastVisualNs       int64
	lastAudioNs        int64

	// Atomic telemetry
	driftUs            atomic.Int64
	corrections        atomic.Uint64
	stateStr           atomic.Pointer[string]
}

// NewClockSynchronizer initializes a high-precision clock synchronizer.
func NewClockSynchronizer(cfg ...ClockSyncConfig) *ClockSynchronizer {
	config := DefaultClockSyncConfig()
	if len(cfg) > 0 {
		config = cfg[0]
	}

	if config.TargetFPS <= 0 {
		config.TargetFPS = 60.0
	}
	if config.SampleRate == 0 {
		config.SampleRate = 48000
	}
	if config.DriftThresholdUs <= 0 {
		config.DriftThresholdUs = 10000
	}
	if config.MaxAllowedDriftUs <= config.DriftThresholdUs {
		config.MaxAllowedDriftUs = 50000
	}
	if config.JitterWindowSize <= 0 {
		config.JitterWindowSize = 16
	}

	now := time.Now()
	nowNs := now.UnixNano()

	s := &ClockSynchronizer{
		cfg:              config,
		startTime:        now,
		audioBaseTimeNs:  nowNs,
		visualBaseTimeNs: nowNs,
		jitterWindow:     make([]int64, config.JitterWindowSize),
		lastVisualNs:     nowNs,
		lastAudioNs:      nowNs,
	}

	initialState := string(SyncStateInSync)
	s.stateStr.Store(&initialState)

	return s
}

// RecordAudioSamples logs processed sample count and returns the presentation timestamp (PTS).
func (s *ClockSynchronizer) RecordAudioSamples(numSamples int, timestampNs int64) int64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.totalAudioSamples == 0 && timestampNs > 0 {
		s.audioBaseTimeNs = timestampNs
	}

	s.totalAudioSamples += uint64(numSamples)
	if timestampNs > 0 {
		s.lastAudioNs = timestampNs
	} else {
		s.lastAudioNs = time.Now().UnixNano()
	}

	// Calculate PTS based on accumulated audio samples at nominal sample rate
	sampleDurationNs := int64((float64(s.totalAudioSamples) / float64(s.cfg.SampleRate)) * 1e9)
	ptsNs := s.audioBaseTimeNs + sampleDurationNs

	return ptsNs
}

// RecordVisualFrame logs a display refresh / V-Sync tick timestamp from Electron.
func (s *ClockSynchronizer) RecordVisualFrame(timestampNs int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if timestampNs <= 0 {
		timestampNs = time.Now().UnixNano()
	}

	if s.totalVisualFrames == 0 {
		s.visualBaseTimeNs = timestampNs
	}

	s.totalVisualFrames++
	s.lastVisualNs = timestampNs

	s.updateDriftCalculationLocked()
}

// updateDriftCalculationLocked recalculates drift and updates jitter smoothing window.
func (s *ClockSynchronizer) updateDriftCalculationLocked() {
	if s.totalAudioSamples == 0 || s.totalVisualFrames == 0 {
		return
	}

	// Expected elapsed times
	audioElapsedNs := int64((float64(s.totalAudioSamples) / float64(s.cfg.SampleRate)) * 1e9)
	visualElapsedNs := int64((float64(s.totalVisualFrames) / s.cfg.TargetFPS) * 1e9)

	rawDriftUs := (audioElapsedNs - visualElapsedNs) / 1000

	// Insert into circular jitter filter
	s.jitterWindow[s.jitterIdx] = rawDriftUs
	s.jitterIdx++
	if s.jitterIdx >= len(s.jitterWindow) {
		s.jitterIdx = 0
		s.jitterFilled = true
	}

	// Calculate moving average drift to filter out OS thread scheduling noise
	count := len(s.jitterWindow)
	if !s.jitterFilled {
		count = s.jitterIdx
		if count == 0 {
			count = 1
		}
	}

	var sum int64
	for i := 0; i < count; i++ {
		sum += s.jitterWindow[i]
	}
	smoothedDriftUs := sum / int64(count)

	s.driftUs.Store(smoothedDriftUs)

	// Determine synchronization state
	var newState SyncState
	absDrift := smoothedDriftUs
	if absDrift < 0 {
		absDrift = -absDrift
	}

	if absDrift > s.cfg.MaxAllowedDriftUs {
		newState = SyncStateRecalibrating
	} else if smoothedDriftUs > s.cfg.DriftThresholdUs {
		newState = SyncStateLead
	} else if smoothedDriftUs < -s.cfg.DriftThresholdUs {
		newState = SyncStateLag
	} else {
		newState = SyncStateInSync
	}

	str := string(newState)
	s.stateStr.Store(&str)
}

// AlignFrame inspects an audio frame, timestamps it with PTS, and computes sample correction if drifting.
func (s *ClockSynchronizer) AlignFrame(frame *AudioFrame) (int, SyncState) {
	if frame == nil {
		return 0, SyncStateInSync
	}

	numSamples := len(frame.Data) / 2
	pts := s.RecordAudioSamples(numSamples, frame.TimestampNs)
	frame.TimestampNs = pts

	drift := s.driftUs.Load()
	state := s.GetState()

	if state == SyncStateInSync {
		return 0, state
	}

	// Compute required micro-sample correction to realign buffer without acoustic artifacts
	s.mu.Lock()
	defer s.mu.Unlock()

	// Samples to adjust: (drift in seconds) * sampleRate
	sampleCorrection := int((float64(drift) / 1e6) * float64(s.cfg.SampleRate))

	// Dampen correction step to max 5% of frame size to prevent audible pitch shifts
	maxAdjustment := numSamples / 20
	if maxAdjustment < 1 {
		maxAdjustment = 1
	}

	if sampleCorrection > maxAdjustment {
		sampleCorrection = maxAdjustment
	} else if sampleCorrection < -maxAdjustment {
		sampleCorrection = -maxAdjustment
	}

	s.corrections.Add(1)

	// In recalibrating state, perform hard re-anchor to current monotonic clock
	if state == SyncStateRecalibrating {
		nowNs := time.Now().UnixNano()
		s.audioBaseTimeNs = nowNs
		s.visualBaseTimeNs = nowNs
		s.totalAudioSamples = uint64(numSamples)
		s.totalVisualFrames = 1
		s.driftUs.Store(0)
		inSync := string(SyncStateInSync)
		s.stateStr.Store(&inSync)
		return 0, SyncStateInSync
	}

	return sampleCorrection, state
}

// GetState returns current synchronization state lock-free.
func (s *ClockSynchronizer) GetState() SyncState {
	if ptr := s.stateStr.Load(); ptr != nil {
		return SyncState(*ptr)
	}
	return SyncStateInSync
}

// GetDriftUs returns current smoothed drift in microseconds lock-free.
func (s *ClockSynchronizer) GetDriftUs() int64 {
	return s.driftUs.Load()
}

// GetMetrics returns a comprehensive telemetry snapshot of clock alignment.
func (s *ClockSynchronizer) GetMetrics() DriftMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	drift := s.driftUs.Load()
	state := s.GetState()

	var avgJitter int64
	count := len(s.jitterWindow)
	if !s.jitterFilled {
		count = s.jitterIdx
	}
	if count > 0 {
		var sum int64
		for i := 0; i < count; i++ {
			v := s.jitterWindow[i]
			if v < 0 {
				v = -v
			}
			sum += v
		}
		avgJitter = sum / int64(count)
	}

	return DriftMetrics{
		ClockDriftUs:            drift,
		AudioPresentationTimeNs: s.lastAudioNs,
		VisualTimestampNs:       s.lastVisualNs,
		DriftCorrections:        s.corrections.Load(),
		State:                   state,
		AverageJitterUs:         avgJitter,
	}
}

// Reset re-initializes all accumulators and anchors to current clock.
func (s *ClockSynchronizer) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	nowNs := now.UnixNano()

	s.startTime = now
	s.audioBaseTimeNs = nowNs
	s.visualBaseTimeNs = nowNs
	s.totalAudioSamples = 0
	s.totalVisualFrames = 0
	s.jitterIdx = 0
	s.jitterFilled = false
	s.lastAudioNs = nowNs
	s.lastVisualNs = nowNs

	for i := range s.jitterWindow {
		s.jitterWindow[i] = 0
	}

	s.driftUs.Store(0)
	s.corrections.Store(0)

	inSync := string(SyncStateInSync)
	s.stateStr.Store(&inSync)
}
