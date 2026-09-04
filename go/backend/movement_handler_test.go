package backend

import (
	"sync"
	"testing"
	"time"
)

func TestMovementHandlerCore(t *testing.T) {
	h := NewMovementHandler()

	// Initial
	state := h.GetState()
	if state.CurrentPose != "sitting" {
		t.Fatalf("expected sitting, got %s", state.CurrentPose)
	}

	// Standing
	adjStanding := h.HandleMovementEvent(MovementEvent{
		EventType:  "pose_change",
		Pose:       "standing",
		Confidence: 0.94,
		Timestamp:  time.Now().UnixMilli(),
	})
	if adjStanding.GainBoostDB != 1.5 || adjStanding.AcousticPreset != "far_field_standing" {
		t.Fatalf("unexpected standing adjustment: %+v", adjStanding)
	}

	// Walking
	adjWalking := h.HandleMovementEvent(MovementEvent{
		EventType:  "pose_change",
		Pose:       "walking",
		Confidence: 0.89,
	})
	if adjWalking.BufferHeadroomMs != 45 || adjWalking.NoiseReductionLevel != "boosted" {
		t.Fatalf("unexpected walking adjustment: %+v", adjWalking)
	}

	// Eye unavailable
	adjUnavail := h.HandleMovementEvent(MovementEvent{
		EventType: "eye_unavailable",
		Pose:      "no-eye",
	})
	if adjUnavail.AcousticPreset != "stationary_fallback" {
		t.Fatalf("unexpected unavailable adjustment: %+v", adjUnavail)
	}
	if !h.GetState().IsDegraded {
		t.Fatalf("expected degraded state true")
	}

	// Concurrency
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			h.HandleMovementEvent(MovementEvent{Pose: "sitting", Confidence: 0.9})
			_ = h.GetState()
		}(i)
	}
	wg.Wait()

	// Reset
	h.Reset()
	if h.GetState().CurrentPose != "sitting" {
		t.Fatalf("expected sitting after reset")
	}
}
