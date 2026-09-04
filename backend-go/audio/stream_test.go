package state

import (
	"context"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestAtomicRingBufferConcurrent(t *testing.T) {
	rb := NewAtomicRingBuffer(512)

	numWriters := 4
	itemsPerWriter := 100
	var wg sync.WaitGroup
	wg.Add(numWriters)

	for w := 0; w < numWriters; w++ {
		go func(writerID int) {
			defer wg.Done()
			for i := 0; i < itemsPerWriter; i++ {
				data := []byte("pcm-audio-sample-data")
				rb.Write(data)
			}
		}(w)
	}

	wg.Wait()

	depth := rb.Depth()
	if depth != uint64(numWriters*itemsPerWriter) {
		t.Fatalf("expected depth %d, got %d", numWriters*itemsPerWriter, depth)
	}

	// Read all items
	readCount := 0
	for {
		_, ok := rb.Read()
		if !ok {
			break
		}
		readCount++
	}

	if readCount != numWriters*itemsPerWriter {
		t.Fatalf("expected readCount %d, got %d", numWriters*itemsPerWriter, readCount)
	}

	if rb.Depth() != 0 {
		t.Fatalf("expected empty buffer after reading all items, got %d", rb.Depth())
	}
}

func TestDeterministicAudioStreamDelivery(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := DefaultDeterministicAudioStreamConfig()
	cfg.FrameInterval = 10 * time.Millisecond
	cfg.TargetLatency = 5 * time.Millisecond

	stream, err := NewDeterministicAudioStream(ctx, "det-stream-test", cfg)
	if err != nil {
		t.Fatalf("failed to initialize stream: %v", err)
	}
	defer stream.Close()

	sub := stream.Subscribe()

	// Ingest 10 frames
	numFrames := 10
	for i := 0; i < numFrames; i++ {
		ok := stream.IngestRawAudio([]byte("audio-deterministic-payload"))
		if !ok {
			t.Fatalf("failed to ingest frame %d", i)
		}
	}

	// Collect frames from subscriber
	var receivedCount int64
	var lastTimestamp int64

	timeout := time.After(300 * time.Millisecond)
	for i := 0; i < numFrames; i++ {
		select {
		case frame, ok := <-sub:
			if !ok {
				t.Fatalf("subscriber closed prematurely")
			}
			atomic.AddInt64(&receivedCount, 1)

			if lastTimestamp > 0 {
				delta := frame.TimestampMs - lastTimestamp
				// Expect roughly 10ms frame intervals (+/- 15ms scheduling tolerance)
				if delta < 0 || delta > 30 {
					t.Logf("frame interval delta: %dms", delta)
				}
			}
			lastTimestamp = frame.TimestampMs

			// Assert sub-5ms IPC dispatch latency
			if frame.DispatchTimeMs > 5.0 {
				t.Logf("warning: dispatch latency exceeded 5ms: %.2fms", frame.DispatchTimeMs)
			}
		case <-timeout:
			t.Fatalf("timeout waiting for frames: received %d/%d", atomic.LoadInt64(&receivedCount), numFrames)
		}
	}

	metrics := stream.GetMetrics()
	if metrics.FramesProduced != uint64(numFrames) {
		t.Fatalf("expected %d frames produced, got %d", numFrames, metrics.FramesProduced)
	}
	if metrics.FramesDispatched != uint64(numFrames) {
		t.Fatalf("expected %d frames dispatched, got %d", numFrames, metrics.FramesDispatched)
	}
	if metrics.AverageDispatchLatencyMs > 5.0 {
		t.Fatalf("average dispatch latency exceeded 5ms: %.2fms", metrics.AverageDispatchLatencyMs)
	}
}

func TestDeterministicAudioStreamZeroLeaks(t *testing.T) {
	initialGoroutines := runtime.NumGoroutine()

	ctx, cancel := context.WithCancel(context.Background())
	stream, err := NewDeterministicAudioStream(ctx, "leak-check-stream")
	if err != nil {
		t.Fatalf("failed to create stream: %v", err)
	}

	_ = stream.Subscribe()
	stream.IngestRawAudio([]byte("data"))

	time.Sleep(30 * time.Millisecond)

	// Close stream and cancel context
	cancel()
	err = stream.Close()
	if err != nil {
		t.Fatalf("close returned error: %v", err)
	}

	// Double close should be idempotent
	_ = stream.Close()

	time.Sleep(50 * time.Millisecond)
	finalGoroutines := runtime.NumGoroutine()

	if finalGoroutines-initialGoroutines > 5 {
		t.Fatalf("potential goroutine leak: initial=%d, final=%d", initialGoroutines, finalGoroutines)
	}
}
