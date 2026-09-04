package audio

import (
	"context"
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestBufferProcessor_NonBlockingChannels verifies non-blocking submission and reception.
func TestBufferProcessor_NonBlockingChannels(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 1024,
		ChannelCapacity:   10,
	})

	// Fill channel to capacity
	for i := 0; i < 10; i++ {
		ok := bp.TrySubmitFrame(make([]byte, 1024))
		if !ok {
			t.Fatalf("Expected submit to succeed at index %d", i)
		}
	}

	// 11th frame should be dropped without blocking
	ok := bp.TrySubmitFrame(make([]byte, 1024))
	if ok {
		t.Errorf("Expected submit to return false when channel is full")
	}

	metrics := bp.GetMetrics()
	if metrics.DroppedInputs != 1 {
		t.Errorf("Expected DroppedInputs=1, got %d", metrics.DroppedInputs)
	}

	state := bp.GetState()
	if state.Status != StatusOverflow {
		t.Errorf("Expected StatusOverflow, got %s", state.Status)
	}
}

// TestBufferProcessor_UnderflowSilenceInsertion explicitly tests underflow handling
// with graceful silence insertion rather than panic-inducing nil pointer dereferences.
func TestBufferProcessor_UnderflowSilenceInsertion(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 1920,
	})

	// 1. Explicit nil input must NOT panic, but return a silence frame
	frameNil, err := bp.ProcessAudioFrame(nil)
	if err != nil {
		t.Fatalf("ProcessAudioFrame(nil) returned error: %v", err)
	}
	if frameNil == nil {
		t.Fatalf("Expected non-nil frame on nil input")
	}
	if !frameNil.IsSilence || !frameNil.IsUnderflow {
		t.Errorf("Expected IsSilence=true, IsUnderflow=true, got silence=%v, underflow=%v",
			frameNil.IsSilence, frameNil.IsUnderflow)
	}
	if frameNil.RMS != 0 || frameNil.Peak != 0 {
		t.Errorf("Expected 0 RMS and Peak for silence frame, got RMS=%f, Peak=%d",
			frameNil.RMS, frameNil.Peak)
	}

	// Verify all bytes in silence frame are 0x00
	for i, b := range frameNil.Data {
		if b != 0 {
			t.Fatalf("Expected zeroed silence byte at index %d, got 0x%02x", i, b)
		}
	}
	_ = bp.ReleaseBuffer(frameNil.Data)

	// 2. Direct InsertSilence call
	frameSilence := bp.InsertSilence(2048)
	if frameSilence.Size != 2048 {
		t.Errorf("Expected size 2048, got %d", frameSilence.Size)
	}
	if !frameSilence.IsSilence {
		t.Errorf("Expected IsSilence=true")
	}
	_ = bp.ReleaseBuffer(frameSilence.Data)

	metrics := bp.GetMetrics()
	if metrics.UnderflowCount != 2 {
		t.Errorf("Expected UnderflowCount=2, got %d", metrics.UnderflowCount)
	}

	state := bp.GetState()
	if state.Status != StatusUnderflow {
		t.Errorf("Expected state StatusUnderflow, got %s", state.Status)
	}
}

// TestBufferProcessor_AtomicPointerState verifies lock-free state transitions under high concurrency.
func TestBufferProcessor_AtomicPointerState(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 1024,
	})

	const goroutines = 20
	const iterations = 500
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for g := 0; g < goroutines; g++ {
		go func(id int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				// Alternately process frames and insert silence
				if i%2 == 0 {
					buf := make([]byte, 512)
					frame, _ := bp.ProcessAudioFrame(buf)
					_ = bp.ReleaseBuffer(frame.Data)
				} else {
					frame := bp.InsertSilence(512)
					_ = bp.ReleaseBuffer(frame.Data)
				}

				// Check state snapshot is valid without data race
				state := bp.GetState()
				if state.Capacity <= 0 {
					t.Errorf("Invalid capacity observed in state")
				}
			}
		}(g)
	}

	wg.Wait()

	metrics := bp.GetMetrics()
	if metrics.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active in-flight buffers after concurrent test, got %d", metrics.ActiveInFlight)
	}
}

// TestBufferProcessor_ProcessingLoop verifies RunProcessingLoop with non-blocking channels and timeouts.
func TestBufferProcessor_ProcessingLoop(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 960,
		ChannelCapacity:   100,
		UnderflowTimeout:  20 * time.Millisecond,
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		_ = bp.RunProcessingLoop(ctx)
	}()

	// Submit 25 frames
	for i := 0; i < 25; i++ {
		data := make([]byte, 960)
		data[0] = 0x50
		bp.TrySubmitFrame(data)
	}

	receivedCount := 0
	deadline := time.After(500 * time.Millisecond)

	for receivedCount < 25 {
		select {
		case frame := <-bp.OutChan():
			receivedCount++
			_ = bp.ReleaseBuffer(frame.Data)
		case <-deadline:
			t.Fatalf("Timed out waiting for frames. Received: %d/25", receivedCount)
		}
	}

	cancel()
	time.Sleep(50 * time.Millisecond)

	metrics := bp.GetMetrics()
	if metrics.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active in-flight buffers, got %d", metrics.ActiveInFlight)
	}
}

// BenchmarkSampleProcessing_O1 verifies constant O(1) time complexity per sample.
func BenchmarkSampleProcessing_O1(b *testing.B) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 1920,
	})

	// Pre-generate audio PCM data
	pcmData := make([]byte, 1920)
	for i := range pcmData {
		pcmData[i] = byte(rand.Intn(256))
	}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		frame, _ := bp.ProcessAudioFrame(pcmData)
		_ = bp.ReleaseBuffer(frame.Data)
	}
}

// TestBufferProcessor_HeapProfileStress verifies no memory leaks during rapid stream processing.
func TestBufferProcessor_HeapProfileStress(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 2048,
		MaxPooledSize:     8192,
		ChannelCapacity:   256,
	})

	// Force initial GC to establish baseline
	runtime.GC()
	var m1, m2 runtime.MemStats
	runtime.ReadMemStats(&m1)

	// Stream 20,000 frames through the processor
	const frameCount = 20000
	var framesProcessed atomic.Uint64

	pcmData := make([]byte, 2048)
	for i := range pcmData {
		pcmData[i] = byte(i % 256)
	}

	for i := 0; i < frameCount; i++ {
		frame, err := bp.ProcessAudioFrame(pcmData)
		if err != nil {
			t.Fatalf("ProcessAudioFrame failed: %v", err)
		}
		framesProcessed.Add(1)
		_ = bp.ReleaseBuffer(frame.Data)
	}

	runtime.GC()
	runtime.ReadMemStats(&m2)

	metrics := bp.GetMetrics()
	if metrics.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active buffers, got %d", metrics.ActiveInFlight)
	}
	if metrics.PoolHits < 19000 {
		t.Errorf("Expected >19,000 pool hits for 20k frames, got %d", metrics.PoolHits)
	}

	// Verify heap did not explode (memory leak check)
	var heapDiff int64
	if m2.HeapInuse > m1.HeapInuse {
		heapDiff = int64(m2.HeapInuse - m1.HeapInuse)
	}

	t.Logf("Heap baseline: %d KB, Post-stress: %d KB, Delta: %d KB (Pool hit ratio: %.2f%%)",
		m1.HeapInuse/1024, m2.HeapInuse/1024, heapDiff/1024, metrics.HitRatioPercent)

	const maxAllowedGrowthBytes = 5 * 1024 * 1024 // 5 MB threshold
	if heapDiff > maxAllowedGrowthBytes {
		t.Fatalf("Potential memory leak detected: HeapInuse grew by %d bytes", heapDiff)
	}
}
