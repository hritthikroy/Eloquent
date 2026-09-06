package audio

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestDeviceCloseAndRelease(t *testing.T) {
	registry := &DeviceRegistry{
		devices: make(map[string]*Device),
	}

	dev := &Device{
		ID:       "test-cam-01",
		Name:     "Built-in FaceTime HD Camera",
		Type:     "camera",
		Active:   true,
		OpenedAt: time.Now(),
	}

	registry.RegisterDevice(dev)

	if registry.GetActiveDeviceCount() != 1 {
		t.Fatalf("Expected 1 active device, got %d", registry.GetActiveDeviceCount())
	}

	if !dev.IsActive() {
		t.Errorf("Expected device to be active")
	}

	// Release single device
	err := registry.ReleaseDevice("test-cam-01")
	if err != nil {
		t.Fatalf("Failed to release device: %v", err)
	}

	if registry.GetActiveDeviceCount() != 0 {
		t.Errorf("Expected 0 active devices after release, got %d", registry.GetActiveDeviceCount())
	}

	if dev.IsActive() {
		t.Errorf("Expected device active flag to be false after close")
	}
}

func TestReleaseAllDevices(t *testing.T) {
	registry := &DeviceRegistry{
		devices: make(map[string]*Device),
	}

	registry.RegisterDevice(&Device{ID: "mic-1", Name: "Mic 1", Type: "microphone", Active: true})
	registry.RegisterDevice(&Device{ID: "cam-1", Name: "Cam 1", Type: "camera", Active: true})

	if registry.GetActiveDeviceCount() != 2 {
		t.Fatalf("Expected 2 active devices, got %d", registry.GetActiveDeviceCount())
	}

	released := registry.ReleaseAllDevices()
	if released != 2 {
		t.Errorf("Expected 2 devices released, got %d", released)
	}

	if registry.GetActiveDeviceCount() != 0 {
		t.Errorf("Expected 0 active devices, got %d", registry.GetActiveDeviceCount())
	}
}

func TestAudioServiceEndpoints(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	reg := GetDeviceRegistry()
	reg.RegisterDevice(&Device{ID: "mic-test", Name: "Mic", Type: "microphone", Active: true})

	// Test GET /audio/device-status
	req := httptest.NewRequest(http.MethodGet, "/audio/device-status", nil)
	w := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/audio/device-status", func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(rw).Encode(reg.GetStatus())
	})
	mux.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if data["activeCount"].(float64) < 1 {
		t.Errorf("Expected activeCount >= 1, got %v", data["activeCount"])
	}

	// Test POST /audio/release
	reqRel := httptest.NewRequest(http.MethodPost, "/audio/release", nil)
	wRel := httptest.NewRecorder()

	mux.HandleFunc("/audio/release", func(rw http.ResponseWriter, r *http.Request) {
		released := reg.ReleaseAllDevices()
		rw.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(rw).Encode(map[string]any{
			"ok":              true,
			"devicesReleased": released,
		})
	})
	mux.ServeHTTP(wRel, reqRel)

	if wRel.Result().StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200 for /audio/release, got %d", wRel.Result().StatusCode)
	}

	if reg.GetActiveDeviceCount() != 0 {
		t.Errorf("Expected 0 active devices after /audio/release, got %d", reg.GetActiveDeviceCount())
	}

	_ = ctx
}
