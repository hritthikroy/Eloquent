package backend

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestNewSynchronizer(t *testing.T) {
	s := NewSynchronizer(48000)
	if s == nil {
		t.Fatal("NewSynchronizer returned nil")
	}

	metrics := s.GetMetrics()
	if metrics.State != SyncStateInSync {
		t.Errorf("Expected initial state %s, got %s", SyncStateInSync, metrics.State)
	}
	if metrics.DriftCorrections != 0 {
		t.Errorf("Expected 0 initial drift corrections, got %d", metrics.DriftCorrections)
	}
}

func TestForceSync(t *testing.T) {
	s := NewSynchronizer(48000)
	nowNs := time.Now().UnixNano()

	metrics, err := s.ForceSync(nowNs, 48000)
	if err != nil {
		t.Fatalf("ForceSync returned error: %v", err)
	}

	if metrics.State != SyncStateInSync {
		t.Errorf("Expected state %s, got %s", SyncStateInSync, metrics.State)
	}
	if metrics.DriftCorrections != 1 {
		t.Errorf("Expected 1 drift correction, got %d", metrics.DriftCorrections)
	}
	if metrics.VisualTimestampNs != nowNs {
		t.Errorf("Expected visual timestamp %d, got %d", nowNs, metrics.VisualTimestampNs)
	}
}

func TestForceSyncRPC(t *testing.T) {
	s := NewSynchronizer(48000)
	req := &ForceSyncRequest{
		ClientTimestampNs: time.Now().UnixNano(),
		SampleRate:        48000,
	}

	resp, err := s.ForceSyncRPC(req)
	if err != nil {
		t.Fatalf("ForceSyncRPC returned error: %v", err)
	}
	if !resp.Success {
		t.Error("Expected Success = true")
	}
	if resp.Metrics == nil {
		t.Fatal("Expected non-nil Metrics in response")
	}
	if resp.Metrics.DriftCorrections != 1 {
		t.Errorf("Expected 1 drift correction, got %d", resp.Metrics.DriftCorrections)
	}

	// Test nil request error handling
	nilResp, nilErr := s.ForceSyncRPC(nil)
	if nilErr == nil {
		t.Error("Expected error for nil request")
	}
	if nilResp.Success {
		t.Error("Expected Success = false for nil request")
	}
}

func TestHandleForceSyncHTTP(t *testing.T) {
	s := NewSynchronizer(48000)
	reqBody := ForceSyncRequest{
		ClientTimestampNs: time.Now().UnixNano(),
		SampleRate:        48000,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/sync/force", bytes.NewReader(data))
	w := httptest.NewRecorder()

	s.HandleForceSync(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200 OK, got %d", resp.StatusCode)
	}

	var forceResp ForceSyncResponse
	if err := json.NewDecoder(resp.Body).Decode(&forceResp); err != nil {
		t.Fatalf("Failed to decode response JSON: %v", err)
	}

	if !forceResp.Success {
		t.Error("Expected response success = true")
	}
}

func TestConcurrentForceSyncThreadSafety(t *testing.T) {
	s := NewSynchronizer(48000)
	const concurrency = 50
	const iterations = 100

	var wg sync.WaitGroup
	wg.Add(concurrency)

	for c := 0; c < concurrency; c++ {
		go func(routineId int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				_, err := s.ForceSync(time.Now().UnixNano(), 48000)
				if err != nil {
					t.Errorf("Concurrent ForceSync error: %v", err)
				}
				_ = s.GetMetrics()
			}
		}(c)
	}

	wg.Wait()

	expectedCorrections := uint64(concurrency * iterations)
	metrics := s.GetMetrics()
	if metrics.DriftCorrections != expectedCorrections {
		t.Errorf("Expected %d total drift corrections, got %d", expectedCorrections, metrics.DriftCorrections)
	}
}
