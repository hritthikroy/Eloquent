package bridge

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestThrottledIPCHandler_BatchThreshold(t *testing.T) {
	var batchesReceived atomic.Int64
	var itemsReceived atomic.Int64

	cfg := IPCHandlerConfig{
		ThrottleInterval: 200 * time.Millisecond,
		MaxBatchSize:     10,
		ChannelCapacity:  64,
	}

	handler, err := NewThrottledIPCHandler(cfg, func(batch []AudioTelemetry) error {
		batchesReceived.Add(1)
		itemsReceived.Add(int64(len(batch)))
		return nil
	})
	if err != nil {
		t.Fatalf("Failed to create handler: %v", err)
	}
	defer func() { _ = handler.Close() }()

	// Enqueue 10 items to hit MaxBatchSize threshold immediately
	for i := 0; i < 10; i++ {
		ok := handler.Enqueue(AudioTelemetry{
			RMS:         0.05,
			Peak:        1500,
			IsSpeech:    true,
			SampleCount: 1920,
		})
		if !ok {
			t.Fatalf("Failed to enqueue item %d", i)
		}
	}

	// Give a small window for the batch to flush based on threshold
	time.Sleep(30 * time.Millisecond)

	if batchesReceived.Load() < 1 {
		t.Errorf("Expected at least 1 batch to flush on threshold, got %d", batchesReceived.Load())
	}
	if itemsReceived.Load() != 10 {
		t.Errorf("Expected 10 items received, got %d", itemsReceived.Load())
	}

	metrics := handler.GetMetrics()
	if metrics.TotalTelemetryBatched != 10 {
		t.Errorf("Expected TotalTelemetryBatched=10, got %d", metrics.TotalTelemetryBatched)
	}
}

func TestThrottledIPCHandler_TickerPacing(t *testing.T) {
	var batchesReceived atomic.Int64
	var itemsReceived atomic.Int64

	cfg := IPCHandlerConfig{
		ThrottleInterval: 20 * time.Millisecond,
		MaxBatchSize:     50, // Higher than items enqueued to test ticker flush
		ChannelCapacity:  64,
	}

	handler, err := NewThrottledIPCHandler(cfg, func(batch []AudioTelemetry) error {
		batchesReceived.Add(1)
		itemsReceived.Add(int64(len(batch)))
		return nil
	})
	if err != nil {
		t.Fatalf("Failed to create handler: %v", err)
	}
	defer func() { _ = handler.Close() }()

	// Enqueue 5 items (below threshold)
	for i := 0; i < 5; i++ {
		handler.Enqueue(AudioTelemetry{
			RMS:  0.02,
			Peak: 600,
		})
	}

	// Wait for ticker to fire (20ms + buffer)
	time.Sleep(50 * time.Millisecond)

	if batchesReceived.Load() < 1 {
		t.Errorf("Expected at least 1 batch to flush on ticker, got %d", batchesReceived.Load())
	}
	if itemsReceived.Load() != 5 {
		t.Errorf("Expected 5 items received, got %d", itemsReceived.Load())
	}
}

func TestThrottledIPCHandler_NonBlockingBackpressure(t *testing.T) {
	// Tiny capacity with slow ticker to force queue full
	cfg := IPCHandlerConfig{
		ThrottleInterval: 500 * time.Millisecond,
		MaxBatchSize:     100,
		ChannelCapacity:  5,
	}

	handler, err := NewThrottledIPCHandler(cfg, func(batch []AudioTelemetry) error {
		return nil
	})
	if err != nil {
		t.Fatalf("Failed to create handler: %v", err)
	}
	defer func() { _ = handler.Close() }()

	dropped := 0
	// Push 20 items into capacity 5 channel
	for i := 0; i < 20; i++ {
		if !handler.Enqueue(AudioTelemetry{RMS: 0.1}) {
			dropped++
		}
	}

	if dropped == 0 {
		t.Errorf("Expected dropped telemetry under backpressure, got 0")
	}

	metrics := handler.GetMetrics()
	if metrics.TotalDropped == 0 {
		t.Errorf("Expected TotalDropped > 0 in metrics, got %d", metrics.TotalDropped)
	}
}

func TestThrottledIPCHandler_ConcurrentStress(t *testing.T) {
	var totalDispatched atomic.Uint64

	cfg := IPCHandlerConfig{
		ThrottleInterval: 10 * time.Millisecond,
		MaxBatchSize:     32,
		ChannelCapacity:  1024,
	}

	handler, err := NewThrottledIPCHandler(cfg, func(batch []AudioTelemetry) error {
		totalDispatched.Add(uint64(len(batch)))
		return nil
	})
	if err != nil {
		t.Fatalf("Failed to create handler: %v", err)
	}

	const goroutines = 10
	const itemsPerGoroutine = 100
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < itemsPerGoroutine; i++ {
				_ = handler.Enqueue(AudioTelemetry{
					RMS:         0.04,
					Peak:        1000,
					SampleCount: 1920,
				})
			}
		}()
	}

	wg.Wait()

	// Flush and close
	_ = handler.Close()

	metrics := handler.GetMetrics()
	dispatched := totalDispatched.Load()
	total := metrics.TotalTelemetryBatched + metrics.TotalDropped

	expectedTotal := uint64(goroutines * itemsPerGoroutine)
	if total != expectedTotal {
		t.Errorf("Mismatch: dispatched + dropped = %d, expected %d", total, expectedTotal)
	}
	if dispatched != metrics.TotalTelemetryBatched {
		t.Errorf("Dispatched count %d != batched metrics %d", dispatched, metrics.TotalTelemetryBatched)
	}
}
