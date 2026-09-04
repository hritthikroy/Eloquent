// Package backend provides movement and audio adjustment coordination for the Eloquent platform.
package backend

import (
	"strings"
	"sync"
	"time"
)

// MovementEvent represents a standardized movement or pose event emitted by the visual tracking subsystem.
type MovementEvent struct {
	EventType  string                 `json:"eventType"`  // "pose_change", "movement", "eye_unavailable"
	Pose       string                 `json:"pose"`       // "standing", "sitting", "walking", "unknown", "no-eye"
	Confidence float64                `json:"confidence"` // 0.0 to 1.0
	Timestamp  int64                  `json:"timestamp"`
	Metrics    map[string]interface{} `json:"metrics,omitempty"`
	Source     string                 `json:"source,omitempty"`
}

// AudioAdjustment specifies dynamic DSP/acoustic compensations applied based on user movement.
type AudioAdjustment struct {
	GainBoostDB         float64 `json:"gainBoostDB"`
	NoiseReductionLevel string  `json:"noiseReductionLevel"`
	BufferHeadroomMs    int     `json:"bufferHeadroomMs"`
	AcousticPreset      string  `json:"acousticPreset"`
	Timestamp           int64   `json:"timestamp"`
	Pose                string  `json:"pose"`
}

// MovementState captures the current thread-safe movement and audio adaptation posture.
type MovementState struct {
	CurrentPose      string          `json:"currentPose"`
	Confidence       float64         `json:"confidence"`
	LastMovementTime int64           `json:"lastMovementTime"`
	Adjustment       AudioAdjustment `json:"adjustment"`
	IsDegraded       bool            `json:"isDegraded"`
	EventCount       int64           `json:"eventCount"`
}

// MovementHandler coordinates real-time visual movement tracking with backend audio processing.
type MovementHandler struct {
	mu    sync.RWMutex
	state MovementState
}

// NewMovementHandler creates a new MovementHandler initialized to stationary default baseline.
func NewMovementHandler() *MovementHandler {
	now := time.Now().UnixMilli()
	defaultAdj := AudioAdjustment{
		GainBoostDB:         0.0,
		NoiseReductionLevel: "standard",
		BufferHeadroomMs:    20,
		AcousticPreset:      "near_field_sitting",
		Timestamp:           now,
		Pose:                "sitting",
	}

	return &MovementHandler{
		state: MovementState{
			CurrentPose:      "sitting",
			Confidence:       1.0,
			LastMovementTime: now,
			Adjustment:       defaultAdj,
			IsDegraded:       false,
			EventCount:       0,
		},
	}
}

// HandleMovementEvent updates internal state and calculates acoustic adjustments based on pose.
func (h *MovementHandler) HandleMovementEvent(event MovementEvent) AudioAdjustment {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now().UnixMilli()
	if event.Timestamp <= 0 {
		event.Timestamp = now
	}

	h.state.EventCount++
	h.state.LastMovementTime = event.Timestamp

	poseNormalized := strings.ToLower(strings.TrimSpace(event.Pose))
	var adj AudioAdjustment

	if event.EventType == "eye_unavailable" || poseNormalized == "no-eye" || poseNormalized == "unavailable" {
		h.state.IsDegraded = true
		h.state.CurrentPose = "no-eye"
		h.state.Confidence = 0.0

		adj = AudioAdjustment{
			GainBoostDB:         0.0,
			NoiseReductionLevel: "standard",
			BufferHeadroomMs:    20,
			AcousticPreset:      "stationary_fallback",
			Timestamp:           now,
			Pose:                "no-eye",
		}
		h.state.Adjustment = adj
		return adj
	}

	h.state.IsDegraded = false
	h.state.Confidence = event.Confidence
	if h.state.Confidence <= 0 {
		h.state.Confidence = 0.85
	}

	switch poseNormalized {
	case "standing":
		h.state.CurrentPose = "standing"
		adj = AudioAdjustment{
			GainBoostDB:         1.5,
			NoiseReductionLevel: "adaptive",
			BufferHeadroomMs:    20,
			AcousticPreset:      "far_field_standing",
			Timestamp:           now,
			Pose:                "standing",
		}

	case "walking":
		h.state.CurrentPose = "walking"
		adj = AudioAdjustment{
			GainBoostDB:         1.0,
			NoiseReductionLevel: "boosted",
			BufferHeadroomMs:    45,
			AcousticPreset:      "motion_walking",
			Timestamp:           now,
			Pose:                "walking",
		}

	case "sitting":
		h.state.CurrentPose = "sitting"
		adj = AudioAdjustment{
			GainBoostDB:         0.0,
			NoiseReductionLevel: "standard",
			BufferHeadroomMs:    20,
			AcousticPreset:      "near_field_sitting",
			Timestamp:           now,
			Pose:                "sitting",
		}

	default:
		h.state.CurrentPose = "unknown"
		adj = AudioAdjustment{
			GainBoostDB:         0.0,
			NoiseReductionLevel: "standard",
			BufferHeadroomMs:    20,
			AcousticPreset:      "stationary_fallback",
			Timestamp:           now,
			Pose:                "unknown",
		}
	}

	h.state.Adjustment = adj
	return adj
}

// GetState returns a thread-safe copy of the current movement state.
func (h *MovementHandler) GetState() MovementState {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.state
}

// Reset restores default baseline stationary state.
func (h *MovementHandler) Reset() {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now().UnixMilli()
	h.state = MovementState{
		CurrentPose:      "sitting",
		Confidence:       1.0,
		LastMovementTime: now,
		Adjustment: AudioAdjustment{
			GainBoostDB:         0.0,
			NoiseReductionLevel: "standard",
			BufferHeadroomMs:    20,
			AcousticPreset:      "near_field_sitting",
			Timestamp:           now,
			Pose:                "sitting",
		},
		IsDegraded: false,
		EventCount: 0,
	}
}
