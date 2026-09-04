package audio

import (
	"bytes"
	"context"
	"sync"
	"testing"
	"time"
)

func TestBufferProcessor_PoolLifecycle(t *testing.T) {
	cfg := ProcessorConfig{
		DefaultBufferSize: 4096,
		SpeechThreshold:   0.003,
	}
	bp := NewBufferProcessor(cfg)

	// 1. First acquire triggers allocation / pool miss
	buf1 := bp.AcquireBuffer(4096)
	if len(buf1) != 4096 {
		t.Fatalf("Expected buffer length 4096, got %d", len(buf1))
	}

	metrics := bp.GetMetrics()
	if metrics.TotalAllocations != 1 {
		t.Errorf("Expected 1 allocation, got %d", metrics.TotalAllocations)
	}
	if metrics.ActiveInFlight != 1 {
		t.Errorf("Expected 1 active in-flight buffer, got %d", metrics.ActiveInFlight)
	}

	// 2. Release buffer back to pool
	err := bp.ReleaseBuffer(buf1)
	if err != nil {
		t.Fatalf("ReleaseBuffer failed: %v", err)
	}

	metricsAfterRelease := bp.GetMetrics()
	if metricsAfterRelease.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active in-flight buffers, got %d", metricsAfterRelease.ActiveInFlight)
	}
	if metricsAfterRelease.TotalRecycled != 1 {
		t.Errorf("Expected 1 recycled buffer, got %d", metricsAfterRelease.TotalRecycled)
	}

	// 3. Second acquire should hit the pool without new allocation
	buf2 := bp.AcquireBuffer(4096)
	metricsAfterReuse := bp.GetMetrics()
	if metricsAfterReuse.PoolHits != 1 {
		t.Errorf("Expected 1 pool hit, got %d", metricsAfterReuse.PoolHits)
	}
	if metricsAfterReuse.TotalAllocations != 1 {
		t.Errorf("Expected total allocations to remain 1, got %d", metricsAfterReuse.TotalAllocations)
	}

	_ = bp.ReleaseBuffer(buf2)
}

func TestBufferProcessor_FallbackUnderLoad(t *testing.T) {
	cfg := ProcessorConfig{
		DefaultBufferSize: 1024,
		MaxPooledSize:     2048,
	}
	bp := NewBufferProcessor(cfg)

	// Request buffer larger than pool capacity -> fallback mechanism activates
	largeBuf := bp.AcquireBuffer(8192)
	if len(largeBuf) != 8192 {
		t.Fatalf("Expected fallback buffer length 8192, got %d", len(largeBuf))
	}

	metrics := bp.GetMetrics()
	if metrics.FallbackCount != 1 {
		t.Errorf("Expected fallback count 1, got %d", metrics.FallbackCount)
	}

	// Release large buffer; should not be retained in pool since cap > MaxPooledSize
	_ = bp.ReleaseBuffer(largeBuf)
	if bp.GetMetrics().ActiveInFlight != 0 {
		t.Errorf("Expected 0 active in-flight buffers after large buffer release")
	}

	// Release nil buffer returns error
	err := bp.ReleaseBuffer(nil)
	if err != ErrNilBuffer {
		t.Errorf("Expected ErrNilBuffer on nil release, got %v", err)
	}
}

func TestBufferProcessor_AudioProcessing(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 1920,
		SpeechThreshold:   0.003,
	})

	// 20ms of dummy speech audio (high amplitude)
	pcmData := make([]byte, 1920)
	for i := 0; i < len(pcmData)-1; i += 2 {
		// ~1000 amplitude
		pcmData[i] = 0xE8
		pcmData[i+1] = 0x03
	}

	frame, err := bp.ProcessAudioFrame(pcmData)
	if err != nil {
		t.Fatalf("ProcessAudioFrame failed: %v", err)
	}
	if frame.Size != 1920 {
		t.Errorf("Expected frame size 1920, got %d", frame.Size)
	}
	if frame.Peak <= 0 {
		t.Errorf("Expected non-zero peak, got %d", frame.Peak)
	}
	if !frame.IsSpeech {
		t.Errorf("Expected speech detection true for high amplitude audio")
	}

	// Release frame buffer
	_ = bp.ReleaseBuffer(frame.Data)
}

func TestAudioStreamer_StreamLoop(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 1024,
	})
	streamer := NewAudioStreamer(bp, StreamerConfig{
		ChunkSize: 1024,
	})

	// 20 chunks of dummy audio
	var readerBuffer bytes.Buffer
	chunk := bytes.Repeat([]byte{0x77}, 1024)
	for i := 0; i < 20; i++ {
		readerBuffer.Write(chunk)
	}

	dispatchedCount := 0
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := streamer.StreamLoop(ctx, &readerBuffer, func(data []byte) error {
		dispatchedCount++
		if len(data) != 1024 {
			t.Errorf("Dispatched frame length mismatch: %d", len(data))
		}
		return nil
	})

	if err != nil {
		t.Fatalf("StreamLoop failed: %v", err)
	}
	if dispatchedCount != 20 {
		t.Errorf("Expected 20 dispatched chunks, got %d", dispatchedCount)
	}

	// Verify all buffers were explicitly returned to the pool
	poolMetrics := bp.GetMetrics()
	if poolMetrics.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active in-flight buffers after stream loop, got %d", poolMetrics.ActiveInFlight)
	}
	if poolMetrics.TotalRecycled < 20 {
		t.Errorf("Expected at least 20 recycled buffers, got %d", poolMetrics.TotalRecycled)
	}

	streamMetrics := streamer.GetMetrics()
	if streamMetrics.FramesStreamed != 20 {
		t.Errorf("Expected 20 frames streamed, got %d", streamMetrics.FramesStreamed)
	}
	if streamMetrics.FramesDropped != 0 {
		t.Errorf("Expected 0 frames dropped, got %d", streamMetrics.FramesDropped)
	}
}

func TestAudioStreamer_DispatchFrame(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 512,
	})
	streamer := NewAudioStreamer(bp, StreamerConfig{
		ChunkSize: 512,
	})

	data := []byte("manual-frame-dispatch-test")
	dispatched := false

	err := streamer.DispatchFrame(data, func(frame []byte) error {
		dispatched = true
		if string(frame) != string(data) {
			t.Errorf("Payload mismatch: got %s, want %s", string(frame), string(data))
		}
		return nil
	})

	if err != nil {
		t.Fatalf("DispatchFrame failed: %v", err)
	}
	if !dispatched {
		t.Fatalf("Dispatch callback was not invoked")
	}

	// Buffer must be returned
	if bp.GetMetrics().ActiveInFlight != 0 {
		t.Errorf("Expected 0 active buffers after DispatchFrame")
	}
}

func TestAudioStreamer_ConcurrentStreams(t *testing.T) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 1024,
	})
	streamer := NewAudioStreamer(bp, StreamerConfig{
		ChunkSize: 1024,
	})

	const numGoroutines = 20
	const iterationsPerGoroutine = 50

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	for g := 0; g < numGoroutines; g++ {
		go func() {
			defer wg.Done()
			payload := bytes.Repeat([]byte{0x55}, 1024)
			for i := 0; i < iterationsPerGoroutine; i++ {
				_ = streamer.DispatchFrame(payload, func(frame []byte) error {
					return nil
				})
			}
		}()
	}

	wg.Wait()

	poolMetrics := bp.GetMetrics()
	if poolMetrics.ActiveInFlight != 0 {
		t.Errorf("Expected 0 active in-flight buffers after concurrent stress, got %d", poolMetrics.ActiveInFlight)
	}
	expectedTotal := uint64(numGoroutines * iterationsPerGoroutine)
	if streamer.GetMetrics().FramesStreamed != expectedTotal {
		t.Errorf("Expected %d total streamed frames, got %d", expectedTotal, streamer.GetMetrics().FramesStreamed)
	}
}

// --------------------------------------------------------------------------
// BENCHMARKS: Verification of >= 40% Heap Allocation Reduction
// --------------------------------------------------------------------------

var BenchmarkSink []byte

// BenchmarkStandardAllocation simulates naive slice allocation per audio frame.
func BenchmarkStandardAllocation(b *testing.B) {
	frameSize := 4096
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		// Real heap allocation escaping to receiver/sink per frame
		buf := make([]byte, frameSize)
		buf[0] = 0xAA
		buf[frameSize-1] = 0xBB
		BenchmarkSink = buf
	}
}

// BenchmarkPooledAllocation verifies zero/near-zero heap allocations using sync.Pool.
func BenchmarkPooledAllocation(b *testing.B) {
	bp := NewBufferProcessor(ProcessorConfig{
		DefaultBufferSize: 4096,
	})
	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		buf := bp.AcquireBuffer(4096)
		buf[0] = 0xAA
		buf[4095] = 0xBB
		BenchmarkSink = buf
		_ = bp.ReleaseBuffer(buf)
	}
}
