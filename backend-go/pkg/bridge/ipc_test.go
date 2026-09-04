package bridge

import (
	"sync"
	"testing"
	"time"
)

func TestMemoryTrackingMiddleware_Lifecycle(t *testing.T) {
	cfg := MemoryTrackingConfig{
		MaxInFlightThreshold: 10,
		TrackDuration:        true,
	}
	mw := NewMemoryTrackingMiddleware(cfg)

	// 1. Initial state
	metrics := mw.GetMetrics()
	if metrics.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active buffers, got %d", metrics.ActiveInFlight)
	}
	if !metrics.IsHealthy {
		t.Errorf("Expected healthy initial state")
	}

	// 2. Acquisition
	mw.TrackAcquisition(1920)
	mw.TrackAcquisition(1920)

	metricsAfterAcquire := mw.GetMetrics()
	if metricsAfterAcquire.ActiveInFlight != 2 {
		t.Errorf("Expected 2 active buffers, got %d", metricsAfterAcquire.ActiveInFlight)
	}
	if metricsAfterAcquire.PeakInFlight != 2 {
		t.Errorf("Expected peak of 2, got %d", metricsAfterAcquire.PeakInFlight)
	}
	if metricsAfterAcquire.TotalBytesPassed != 3840 {
		t.Errorf("Expected 3840 bytes passed, got %d", metricsAfterAcquire.TotalBytesPassed)
	}

	// 3. Release
	mw.TrackRelease(time.Now().Add(-10 * time.Millisecond))
	mw.TrackRelease(time.Now().Add(-10 * time.Millisecond))

	metricsAfterRelease := mw.GetMetrics()
	if metricsAfterRelease.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active buffers after release, got %d", metricsAfterRelease.ActiveInFlight)
	}
	if metricsAfterRelease.TotalReleased != 2 {
		t.Errorf("Expected 2 releases, got %d", metricsAfterRelease.TotalReleased)
	}
	if metricsAfterRelease.PeakInFlight != 2 {
		t.Errorf("Expected peak to remain 2, got %d", metricsAfterRelease.PeakInFlight)
	}
}

func TestMemoryTrackingMiddleware_WrapHandler(t *testing.T) {
	mw := NewMemoryTrackingMiddleware(MemoryTrackingConfig{
		MaxInFlightThreshold: 50,
		TrackDuration:        true,
	})

	handlerExecuted := false
	wrapped := mw.WrapHandler(func(data []byte) error {
		handlerExecuted = true
		// Verify in-flight count during handler execution
		if mw.GetMetrics().ActiveInFlight != 1 {
			t.Errorf("Expected 1 active in-flight buffer inside handler, got %d", mw.GetMetrics().ActiveInFlight)
		}
		return nil
	})

	frameData := []byte("test-audio-frame-ipc")
	err := wrapped(frameData)
	if err != nil {
		t.Fatalf("Wrapped handler returned error: %v", err)
	}
	if !handlerExecuted {
		t.Fatalf("Wrapped handler did not execute")
	}

	// After wrapped handler returns, active in-flight must be 0
	if mw.GetMetrics().ActiveInFlight != 0 {
		t.Errorf("Expected 0 active in-flight buffers after wrapped execution, got %d", mw.GetMetrics().ActiveInFlight)
	}
}

func TestMemoryTrackingMiddleware_LeakDetection(t *testing.T) {
	cfg := MemoryTrackingConfig{
		MaxInFlightThreshold: 3,
		WarnOnLeak:           true,
	}
	mw := NewMemoryTrackingMiddleware(cfg)

	// Acquire beyond threshold (4 > 3)
	for i := 0; i < 4; i++ {
		mw.TrackAcquisition(1024)
	}

	metrics := mw.GetMetrics()
	if metrics.LeakWarnings == 0 {
		t.Errorf("Expected leak warnings when active buffers exceed threshold (4 > 3)")
	}
	if metrics.IsHealthy {
		t.Errorf("Expected IsHealthy = false when leak warnings are triggered")
	}

	// Release back to 0
	for i := 0; i < 4; i++ {
		mw.TrackRelease(time.Time{})
	}

	if mw.GetMetrics().ActiveInFlight != 0 {
		t.Errorf("Expected 0 active buffers after draining")
	}
}

func TestMemoryTrackingMiddleware_ConcurrentRace(t *testing.T) {
	mw := NewMemoryTrackingMiddleware(MemoryTrackingConfig{
		MaxInFlightThreshold: 500,
		TrackDuration:        true,
	})

	const numGoroutines = 20
	const iterations = 100

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	for g := 0; g < numGoroutines; g++ {
		go func() {
			defer wg.Done()
			wrapped := mw.WrapHandler(func(data []byte) error {
				return nil
			})
			for i := 0; i < iterations; i++ {
				_ = wrapped([]byte("burst"))
			}
		}()
	}

	wg.Wait()

	metrics := mw.GetMetrics()
	if metrics.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active buffers after concurrent execution, got %d", metrics.ActiveInFlight)
	}
	expectedTotal := uint64(numGoroutines * iterations)
	if metrics.TotalAcquired != expectedTotal {
		t.Errorf("Expected %d total acquisitions, got %d", expectedTotal, metrics.TotalAcquired)
	}
	if metrics.TotalReleased != expectedTotal {
		t.Errorf("Expected %d total releases, got %d", expectedTotal, metrics.TotalReleased)
	}
}
