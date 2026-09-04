package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestMovementHandlerInit(t *testing.T) {
	h := NewMovementHandler()
	state := h.GetState()

	if state.CurrentPose != "sitting" {
		t.Fatalf("expected initial pose sitting, got %s", state.CurrentPose)
	}
	if state.IsDegraded {
		t.Fatalf("expected initial IsDegraded to be false")
	}
	if state.Adjustment.GainBoostDB != 0.0 {
		t.Fatalf("expected initial gain boost 0.0, got %f", state.Adjustment.GainBoostDB)
	}
}

func TestMovementHandlerStanding(t *testing.T) {
	h := NewMovementHandler()

	event := MovementEvent{
		EventType:  "pose_change",
		Pose:       "standing",
		Confidence: 0.95,
		Timestamp:  time.Now().UnixMilli(),
		Metrics: map[string]interface{}{
			"elevationRatio": 0.85,
			"velocity":       0.02,
		},
		Source: "test",
	}

	adj := h.HandleMovementEvent(event)

	if adj.GainBoostDB != 1.5 {
		t.Fatalf("expected 1.5 dB gain boost for standing, got %f", adj.GainBoostDB)
	}
	if adj.AcousticPreset != "far_field_standing" {
		t.Fatalf("expected far_field_standing, got %s", adj.AcousticPreset)
	}
	if adj.NoiseReductionLevel != "adaptive" {
		t.Fatalf("expected adaptive noise reduction, got %s", adj.NoiseReductionLevel)
	}

	state := h.GetState()
	if state.CurrentPose != "standing" {
		t.Fatalf("expected state CurrentPose to be standing, got %s", state.CurrentPose)
	}
	if state.Confidence != 0.95 {
		t.Fatalf("expected confidence 0.95, got %f", state.Confidence)
	}
}

func TestMovementHandlerWalking(t *testing.T) {
	h := NewMovementHandler()

	event := MovementEvent{
		EventType:  "pose_change",
		Pose:       "walking",
		Confidence: 0.91,
		Timestamp:  time.Now().UnixMilli(),
		Metrics: map[string]interface{}{
			"velocity":     0.65,
			"displacement": 0.40,
		},
		Source: "test",
	}

	adj := h.HandleMovementEvent(event)

	if adj.GainBoostDB != 1.0 {
		t.Fatalf("expected 1.0 dB gain boost for walking, got %f", adj.GainBoostDB)
	}
	if adj.BufferHeadroomMs != 45 {
		t.Fatalf("expected 45ms buffer headroom for walking, got %d", adj.BufferHeadroomMs)
	}
	if adj.NoiseReductionLevel != "boosted" {
		t.Fatalf("expected boosted noise reduction, got %s", adj.NoiseReductionLevel)
	}
	if adj.AcousticPreset != "motion_walking" {
		t.Fatalf("expected motion_walking, got %s", adj.AcousticPreset)
	}
}

func TestMovementHandlerSitting(t *testing.T) {
	h := NewMovementHandler()

	// First set to standing
	h.HandleMovementEvent(MovementEvent{Pose: "standing", Confidence: 0.9})

	// Transition back to sitting
	adj := h.HandleMovementEvent(MovementEvent{
		EventType:  "pose_change",
		Pose:       "sitting",
		Confidence: 0.88,
	})

	if adj.GainBoostDB != 0.0 {
		t.Fatalf("expected 0.0 dB gain boost for sitting, got %f", adj.GainBoostDB)
	}
	if adj.AcousticPreset != "near_field_sitting" {
		t.Fatalf("expected near_field_sitting, got %s", adj.AcousticPreset)
	}
	if adj.BufferHeadroomMs != 20 {
		t.Fatalf("expected 20ms buffer headroom, got %d", adj.BufferHeadroomMs)
	}
}

func TestMovementHandlerUnavailableGracefulDegradation(t *testing.T) {
	h := NewMovementHandler()

	// 1. Test eventType = eye_unavailable
	adj1 := h.HandleMovementEvent(MovementEvent{
		EventType: "eye_unavailable",
		Pose:      "unknown",
	})

	if adj1.AcousticPreset != "stationary_fallback" {
		t.Fatalf("expected stationary_fallback on eye_unavailable, got %s", adj1.AcousticPreset)
	}
	state1 := h.GetState()
	if !state1.IsDegraded {
		t.Fatalf("expected IsDegraded to be true")
	}
	if state1.CurrentPose != "no-eye" {
		t.Fatalf("expected CurrentPose to be no-eye, got %s", state1.CurrentPose)
	}

	// 2. Test pose = no-eye
	adj2 := h.HandleMovementEvent(MovementEvent{
		Pose: "no-eye",
	})
	if adj2.AcousticPreset != "stationary_fallback" {
		t.Fatalf("expected stationary_fallback on pose no-eye, got %s", adj2.AcousticPreset)
	}

	// 3. Test recovery when camera re-connects
	adj3 := h.HandleMovementEvent(MovementEvent{
		EventType:  "pose_change",
		Pose:       "sitting",
		Confidence: 0.90,
	})
	if adj3.AcousticPreset != "near_field_sitting" {
		t.Fatalf("expected recovery to near_field_sitting, got %s", adj3.AcousticPreset)
	}
	state3 := h.GetState()
	if state3.IsDegraded {
		t.Fatalf("expected IsDegraded to recover to false")
	}
}

func TestMovementHandlerUnknownPose(t *testing.T) {
	h := NewMovementHandler()

	adj := h.HandleMovementEvent(MovementEvent{
		Pose: "dancing_breakdance",
	})

	if adj.AcousticPreset != "stationary_fallback" {
		t.Fatalf("expected stationary_fallback for unknown pose, got %s", adj.AcousticPreset)
	}
	state := h.GetState()
	if state.CurrentPose != "unknown" {
		t.Fatalf("expected CurrentPose unknown, got %s", state.CurrentPose)
	}
}

func TestMovementHandlerReset(t *testing.T) {
	h := NewMovementHandler()
	h.HandleMovementEvent(MovementEvent{Pose: "standing", Confidence: 0.9})
	h.Reset()

	state := h.GetState()
	if state.CurrentPose != "sitting" {
		t.Fatalf("expected reset pose sitting, got %s", state.CurrentPose)
	}
	if state.EventCount != 0 {
		t.Fatalf("expected reset eventCount 0, got %d", state.EventCount)
	}
}

func TestMovementHandlerConcurrentUpdates(t *testing.T) {
	h := NewMovementHandler()
	var wg sync.WaitGroup
	poses := []string{"standing", "sitting", "walking", "unknown"}

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			pose := poses[idx%len(poses)]
			h.HandleMovementEvent(MovementEvent{
				Pose:       pose,
				Confidence: 0.9,
				Timestamp:  time.Now().UnixMilli(),
			})
			_ = h.GetState()
		}(i)
	}

	wg.Wait()
	state := h.GetState()
	if state.EventCount != 50 {
		t.Fatalf("expected eventCount 50, got %d", state.EventCount)
	}
}

func TestMovementHandlerGinEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewMovementHandler()

	r.POST("/api/movement", h.PostMovement)
	r.GET("/api/movement/state", h.GetMovementState)

	// 1. Test POST valid
	eventPayload := MovementEvent{
		EventType:  "pose_change",
		Pose:       "walking",
		Confidence: 0.92,
	}
	body, _ := json.Marshal(eventPayload)

	req := httptest.NewRequest("POST", "/api/movement", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected POST /api/movement status 200, got %d", w.Code)
	}

	var postResp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &postResp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if postResp["success"] != true {
		t.Fatalf("expected success true, got %v", postResp["success"])
	}

	// 2. Test POST invalid JSON
	reqBad := httptest.NewRequest("POST", "/api/movement", bytes.NewBufferString("{bad-json"))
	reqBad.Header.Set("Content-Type", "application/json")
	wBad := httptest.NewRecorder()
	r.ServeHTTP(wBad, reqBad)

	if wBad.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for bad JSON, got %d", wBad.Code)
	}

	// 3. Test GET state
	reqGet := httptest.NewRequest("GET", "/api/movement/state", nil)
	wGet := httptest.NewRecorder()
	r.ServeHTTP(wGet, reqGet)

	if wGet.Code != http.StatusOK {
		t.Fatalf("expected GET /api/movement/state status 200, got %d", wGet.Code)
	}
}
