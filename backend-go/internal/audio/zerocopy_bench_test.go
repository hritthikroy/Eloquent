package audio

import (
	"context"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"
)

func BenchmarkProcessAudioFrame(b *testing.B) {
	cfg := ProcessorConfig{
		DefaultBufferSize: 1920,
		SpeechThreshold:   0.003,
		ChannelCapacity:   256,
		UnderflowTimeout:  20 * time.Millisecond,
	}
	bp := NewBufferProcessor(cfg)
	payload := make([]byte, 1920)
	for i := range payload {
		payload[i] = byte(i*31 + 7)
	}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		frame, err := bp.ProcessAudioFrame(payload)
		if err != nil {
			b.Fatal(err)
		}
		if frame.Data != nil {
			_ = bp.ReleaseBuffer(frame.Data)
		}
	}
}

func BenchmarkProcessAudioFrameParallel(b *testing.B) {
	cfg := ProcessorConfig{
		DefaultBufferSize: 1920,
		SpeechThreshold:   0.003,
		ChannelCapacity:   256,
		UnderflowTimeout:  20 * time.Millisecond,
	}
	bp := NewBufferProcessor(cfg)
	payload := make([]byte, 1920)
	for i := range payload {
		payload[i] = byte(i*17 + 13)
	}

	b.ResetTimer()
	b.ReportAllocs()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			frame, err := bp.ProcessAudioFrame(payload)
			if err != nil {
				b.Fatal(err)
			}
			if frame.Data != nil {
				_ = bp.ReleaseBuffer(frame.Data)
			}
		}
	})
}

func BenchmarkBridgeTransfer(b *testing.B) {
	bridge := NewZeroCopyBridge()
	defer bridge.Close()

	payload := make([]byte, 1920)
	for i := range payload {
		payload[i] = byte(rand.Intn(256))
	}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		frame, err := bridge.Transfer(payload, DirectionInbound)
		if err == nil && frame != nil {
			select {
			case f := <-bridge.InboundFrames():
				bridge.ReleaseFrame(f)
			default:
			}
		}
	}
}

func BenchmarkPoolAcquireRelease(b *testing.B) {
	cfg := ProcessorConfig{DefaultBufferSize: 1920}
	bp := NewBufferProcessor(cfg)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		buf := bp.AcquireBuffer(1920)
		_ = bp.ReleaseBuffer(buf)
	}
}

func BenchmarkFullPipelineE2E(b *testing.B) {
	cfg := ProcessorConfig{
		DefaultBufferSize: 1920,
		ChannelCapacity:   1024,
		UnderflowTimeout:  100 * time.Millisecond,
	}
	bp := NewBufferProcessor(cfg)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go bp.RunProcessingLoop(ctx)

	payload := make([]byte, 1920)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		start := time.Now()
		if bp.TrySubmitFrame(payload) {
			select {
			case frame := <-bp.OutChan():
				elapsed := float64(time.Since(start).Microseconds()) / 1000.0
				b.ReportMetric(elapsed, "ms/frame")
				if frame.Data != nil {
					_ = bp.ReleaseBuffer(frame.Data)
				}
			case <-time.After(10 * time.Millisecond):
			}
		}
	}
}

func FuzzProcessAudioFrame(f *testing.F) {
	f.Add([]byte{0x00, 0x00})
	f.Add([]byte{0xFF, 0x7F})
	f.Add([]byte{})
	f.Add(make([]byte, 1920))

	f.Fuzz(func(t *testing.T, data []byte) {
		cfg := ProcessorConfig{DefaultBufferSize: 1920, SpeechThreshold: 0.003}
		bp := NewBufferProcessor(cfg)

		frame, err := bp.ProcessAudioFrame(data)
		if err != nil {
			t.Fatalf("unexpected processing error: %v", err)
		}
		if frame == nil {
			t.Fatal("expected non-nil processed frame")
		}
		if frame.Data != nil {
			_ = bp.ReleaseBuffer(frame.Data)
		}
	})
}

func TestLatencyBound(t *testing.T) {
	const maxLatencyMs = 10.0
	cfg := ProcessorConfig{
		DefaultBufferSize: 1920,
		SpeechThreshold:   0.003,
		ChannelCapacity:   256,
		UnderflowTimeout:  20 * time.Millisecond,
	}
	bp := NewBufferProcessor(cfg)
	payload := make([]byte, 1920)

	var wg sync.WaitGroup
	var maxObservedMs float64
	var mu sync.Mutex

	cpus := runtime.NumCPU()
	if cpus < 2 {
		cpus = 2
	}

	for g := 0; g < cpus; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 500; i++ {
				start := time.Now()
				frame, _ := bp.ProcessAudioFrame(payload)
				elapsed := float64(time.Since(start).Nanoseconds()) / 1e6
				if frame != nil && frame.Data != nil {
					_ = bp.ReleaseBuffer(frame.Data)
				}
				mu.Lock()
				if elapsed > maxObservedMs {
					maxObservedMs = elapsed
				}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if maxObservedMs > maxLatencyMs {
		t.Errorf("max latency %.3fms exceeds latency bound %.0fms", maxObservedMs, maxLatencyMs)
	}
}
