package audio

import (
	"errors"
	"testing"
)

func TestJimmyBufferManager_Iterative(t *testing.T) {
	cfg := DefaultJimmyConfig()
	cfg.MaxChunkSize = 512
	mgr := NewJimmyBufferManager(cfg)

	// Test zero-length input edge case
	res, err := mgr.ProcessIterative(nil, 512)
	if err != nil {
		t.Fatalf("expected nil error on nil input, got %v", err)
	}
	if len(res) != 0 {
		t.Fatalf("expected 0 chunks for nil input, got %d", len(res))
	}

	// Test non-divisible buffer size
	data := make([]byte, 1200)
	for i := range data {
		data[i] = byte(i % 256)
	}

	chunks, err := mgr.ProcessIterative(data, 512)
	if err != nil {
		t.Fatalf("ProcessIterative failed: %v", err)
	}
	// 1200 / 512 = 3 chunks (512, 512, 176)
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}
	if chunks[0].Size != 512 || chunks[1].Size != 512 || chunks[2].Size != 176 {
		t.Fatalf("chunk sizing mismatch: %+v", chunks)
	}
}

func TestJimmyBufferManager_Trampoline(t *testing.T) {
	cfg := DefaultJimmyConfig()
	mgr := NewJimmyBufferManager(cfg)

	data := make([]byte, 3840) // 2 full frames
	chunksCount := 0

	err := mgr.ProcessWithTrampoline(data, 1920, func(chunk []byte, index int) error {
		chunksCount++
		if len(chunk) != 1920 {
			t.Errorf("chunk %d length %d != 1920", index, len(chunk))
		}
		return nil
	})

	if err != nil {
		t.Fatalf("ProcessWithTrampoline failed: %v", err)
	}
	if chunksCount != 2 {
		t.Fatalf("expected 2 chunks, got %d", chunksCount)
	}
}

func TestJimmyBufferManager_RecursionLimitSimulation(t *testing.T) {
	cfg := DefaultJimmyConfig()
	cfg.MaxStackDepth = 100
	mgr := NewJimmyBufferManager(cfg)

	// Test safe depth under limit
	count := 0
	err := mgr.SimulateRecursiveSafe(50, func(depth int) error {
		count++
		return nil
	})
	if err != nil {
		t.Fatalf("expected success for depth 50, got %v", err)
	}
	if count != 50 {
		t.Fatalf("expected count 50, got %d", count)
	}

	// Test edge case: depth exceeding maximum stack safety trip
	err = mgr.SimulateRecursiveSafe(150, func(depth int) error {
		return nil
	})
	if !errors.Is(err, ErrRecursionDepthExceeded) {
		t.Fatalf("expected ErrRecursionDepthExceeded, got %v", err)
	}

	metrics := mgr.GetMetrics()
	if metrics["overflowTrips"].(uint64) != 1 {
		t.Fatalf("expected 1 overflow trip recorded, got %v", metrics["overflowTrips"])
	}
}
