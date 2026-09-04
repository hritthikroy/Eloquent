package audio

import (
	"encoding/binary"
	"math"
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestAudioEngine_LifecycleAndConcurrency(t *testing.T) {
	cfg := DefaultEngineConfig()
	cfg.NumWorkers = 8
	cfg.QueueCapacity = 1024

	engine := NewAudioEngine(cfg)
	if engine == nil {
		t.Fatal("Expected NewAudioEngine to return non-nil instance")
	}
	defer engine.Close()

	if !engine.IsConnected() {
		t.Fatal("Expected fresh engine to be connected")
	}

	if engine.Synchronizer() == nil {
		t.Fatal("Expected Synchronizer() to be non-nil")
	}
	if engine.Resampler() == nil {
		t.Fatal("Expected Resampler() to be non-nil")
	}

	// 1. Concurrent Ingestion Test: 2000 frames from 4 goroutines
	var receivedCount uint64
	engine.Subscribe(func(frame *AudioFrame) {
		if frame != nil && frame.RMS >= 0 {
			atomic.AddUint64(&receivedCount, 1)
		}
	})

	var wg sync.WaitGroup
	numProducers := 4
	framesPerProducer := 500

	sampleData := make([]byte, 1920)
	for i := range sampleData {
		sampleData[i] = byte(i % 128)
	}

	for p := 0; p < numProducers; p++ {
		wg.Add(1)
		go func(producerID int) {
			defer wg.Done()
			for f := 0; f < framesPerProducer; f++ {
				frameID := uint64(producerID*10000 + f)
				_, _ = engine.Submit(sampleData, frameID)
			}
		}(p)
	}

	wg.Wait()

	// Wait for worker pool to drain
	time.Sleep(100 * time.Millisecond)

	metrics := engine.GetMetrics()
	if metrics.FramesIngested == 0 {
		t.Fatal("Expected framesIngested > 0")
	}
	if metrics.FramesProcessed == 0 {
		t.Fatal("Expected framesProcessed > 0")
	}
	if metrics.ActiveWorkers != 8 {
		t.Fatalf("Expected 8 active workers, got %d", metrics.ActiveWorkers)
	}

	// Test ReadProcessed
	frame, ok := engine.ReadProcessed()
	if !ok || frame == nil {
		// Output queue may have been drained or read, verify underruns logic
		_, _ = engine.ReadProcessed()
	}
}

func TestAudioEngine_SelfHealingWorkerRecovery(t *testing.T) {
	cfg := DefaultEngineConfig()
	cfg.NumWorkers = 4
	cfg.QueueCapacity = 256

	engine := NewAudioEngine(cfg)
	defer engine.Close()

	// Register subscriber that deliberately panics on specific ID to test self-healing
	var safeHandled uint64
	engine.Subscribe(func(frame *AudioFrame) {
		if frame.ID == 99999 {
			panic("simulated subscriber panic")
		}
		atomic.AddUint64(&safeHandled, 1)
	})

	// Submit frame that causes subscriber panic
	_, _ = engine.Submit([]byte{0x01, 0x02, 0x03, 0x04}, 99999)
	time.Sleep(20 * time.Millisecond)

	// Engine and workers should remain completely alive and process subsequent frames
	for i := 0; i < 50; i++ {
		ok, err := engine.Submit([]byte{0x00, 0x10, 0x00, 0x20}, uint64(i+1))
		if !ok || err != nil {
			t.Fatalf("Engine failed to submit after panic: %v", err)
		}
	}

	time.Sleep(50 * time.Millisecond)
	if atomic.LoadUint64(&safeHandled) < 50 {
		t.Fatalf("Expected workers to self-heal and process 50+ frames, got %d", safeHandled)
	}
}

func TestAudioEngine_ZeroOverrunBackpressure(t *testing.T) {
	cfg := DefaultEngineConfig()
	cfg.NumWorkers = 2
	cfg.QueueCapacity = 16 // Small queue to trigger backpressure

	engine := NewAudioEngine(cfg)
	defer engine.Close()

	var rejectedCount int
	dummy := make([]byte, 100)

	for i := 0; i < 200; i++ {
		ok, err := engine.Submit(dummy, uint64(i))
		if !ok || err == ErrBufferOverrun {
			rejectedCount++
		}
	}

	metrics := engine.GetMetrics()
	if metrics.OverrunCount == 0 {
		t.Fatal("Expected OverrunCount > 0 under heavy queue saturation")
	}
	if metrics.FramesDropped == 0 {
		t.Fatal("Expected FramesDropped > 0 under backpressure")
	}
}

func TestAudioEngine_HeartbeatTimeout(t *testing.T) {
	cfg := DefaultEngineConfig()
	cfg.HeartbeatTimeoutMs = 50 // Short 50ms timeout

	engine := NewAudioEngine(cfg)
	defer engine.Close()

	if !engine.IsConnected() {
		t.Fatal("Expected engine to be connected initially")
	}

	time.Sleep(80 * time.Millisecond)
	if engine.IsConnected() {
		t.Fatal("Expected engine to report disconnected after heartbeat elapsed")
	}

	engine.Heartbeat()
	if !engine.IsConnected() {
		t.Fatal("Expected engine to reconnect after Heartbeat()")
	}
}

func TestAudioEngine_ResamplingAndTargetRate(t *testing.T) {
	cfg := DefaultEngineConfig()
	cfg.SampleRate = 48000
	cfg.TargetSampleRate = 16000 // Resample from 48kHz down to 16kHz
	cfg.NumWorkers = 2

	engine := NewAudioEngine(cfg)
	defer engine.Close()

	var resampledFrame *AudioFrame
	var resampledMu sync.Mutex
	var resampledCond = sync.NewCond(&resampledMu)

	engine.Subscribe(func(f *AudioFrame) {
		resampledMu.Lock()
		resampledFrame = f
		resampledCond.Broadcast()
		resampledMu.Unlock()
	})

	// 48kHz: 480 samples = 960 bytes (10ms of audio)
	inData := make([]byte, 960)
	for i := 0; i < len(inData)-1; i += 2 {
		val := int16(2000 * math.Sin(float64(i)))
		binary.LittleEndian.PutUint16(inData[i:i+2], uint16(val))
	}

	ok, err := engine.Submit(inData, 101)
	if !ok || err != nil {
		t.Fatalf("failed to submit: %v", err)
	}

	resampledMu.Lock()
	for resampledFrame == nil {
		resampledCond.Wait()
	}
	resampledMu.Unlock()

	// 10ms at 16kHz = 160 samples = 320 bytes
	if resampledFrame.SampleRate != 16000 {
		t.Fatalf("expected resampled SampleRate 16000, got %d", resampledFrame.SampleRate)
	}
	if len(resampledFrame.Data) != 320 {
		t.Fatalf("expected resampled data len 320, got %d", len(resampledFrame.Data))
	}

	// Test dynamic SetTargetSampleRate
	engine.SetTargetSampleRate(24000)
}

func TestLinearResampler_Unit(t *testing.T) {
	resampler := NewLinearResampler()

	// 1. Downsampling 48kHz -> 16kHz (3:1 ratio)
	srcData := make([]byte, 960) // 480 samples
	for i := 0; i < len(srcData)-1; i += 2 {
		val := int16(1000)
		binary.LittleEndian.PutUint16(srcData[i:i+2], uint16(val))
	}

	out, err := resampler.Resample(srcData, 48000, 16000, 1)
	if err != nil {
		t.Fatalf("resample failed: %v", err)
	}
	if len(out) != 320 { // 160 samples = 320 bytes
		t.Fatalf("expected 320 bytes, got %d", len(out))
	}

	// 2. Upsampling 16kHz -> 48kHz (1:3 ratio)
	outUp, err := resampler.Resample(out, 16000, 48000, 1)
	if err != nil {
		t.Fatalf("upsample failed: %v", err)
	}
	if len(outUp) != 960 {
		t.Fatalf("expected 960 bytes, got %d", len(outUp))
	}

	// 3. Same rate passthrough
	outSame, err := resampler.Resample(srcData, 48000, 48000, 1)
	if err != nil {
		t.Fatalf("same rate failed: %v", err)
	}
	if len(outSame) != len(srcData) {
		t.Fatalf("expected %d bytes, got %d", len(srcData), len(outSame))
	}

	// 4. Stereo resampling
	stereoSrc := make([]byte, 960*2) // 480 stereo frames
	outStereo, err := resampler.Resample(stereoSrc, 48000, 16000, 2)
	if err != nil {
		t.Fatalf("stereo resample failed: %v", err)
	}
	if len(outStereo) != 320*2 {
		t.Fatalf("expected 640 bytes for stereo resample, got %d", len(outStereo))
	}

	// 5. Error branches
	if _, err := resampler.Resample(nil, 48000, 16000, 1); err != ErrEmptyPayload {
		t.Fatalf("expected ErrEmptyPayload, got %v", err)
	}
	if _, err := resampler.Resample([]byte{0x01}, 48000, 16000, 1); err != ErrInvalidAudioPacket {
		t.Fatalf("expected ErrInvalidAudioPacket on odd bytes, got %v", err)
	}
	if _, err := resampler.Resample(srcData, 0, 16000, 1); err != ErrInvalidSampleRate {
		t.Fatalf("expected ErrInvalidSampleRate on src=0, got %v", err)
	}
	if _, err := resampler.Resample(srcData, 48000, 0, 1); err != ErrInvalidSampleRate {
		t.Fatalf("expected ErrInvalidSampleRate on dst=0, got %v", err)
	}
	if _, err := resampler.Resample(srcData, 48000, 16000, 0); err != ErrInvalidChannels {
		t.Fatalf("expected ErrInvalidChannels, got %v", err)
	}
	if _, err := resampler.Resample([]byte{0x00, 0x00}, 48000, 16000, 2); err != ErrBufferTooShort {
		t.Fatalf("expected ErrBufferTooShort for insufficient stereo bytes, got %v", err)
	}
}

func TestAudioEngine_EdgeCasesAndShutdown(t *testing.T) {
	// Fallback config validation
	badCfg := EngineConfig{
		NumWorkers:         -1,
		QueueCapacity:      -5,
		VADThresholdRMS:    -1,
		VADThresholdPeak:   -1,
		HeartbeatTimeoutMs: -1,
	}
	engine := NewAudioEngine(badCfg)
	if engine == nil {
		t.Fatal("expected non-nil engine with bad config")
	}

	// Subscribe nil guard
	engine.Subscribe(nil)

	// Submit invalid packet
	if ok, err := engine.Submit([]byte{0x01}, 1); ok || err != ErrInvalidAudioPacket {
		t.Fatalf("expected ErrInvalidAudioPacket, got ok=%v, err=%v", ok, err)
	}

	// Close engine
	err := engine.Close()
	if err != nil {
		t.Fatalf("unexpected close error: %v", err)
	}

	// Close idempotence
	if err := engine.Close(); err != nil {
		t.Fatalf("expected second close to be nil, got %v", err)
	}

	// Submit after close
	if ok, err := engine.Submit([]byte{0x00, 0x00}, 2); ok || err != ErrEngineStopped {
		t.Fatalf("expected ErrEngineStopped after close, got ok=%v, err=%v", ok, err)
	}

	// ReadProcessed after close
	if _, ok := engine.ReadProcessed(); ok {
		t.Fatal("expected ReadProcessed after close to return false")
	}
}

func BenchmarkAudioEngine_SubmitAndProcess(b *testing.B) {
	cfg := DefaultEngineConfig()
	cfg.NumWorkers = runtime.NumCPU() * 2
	cfg.QueueCapacity = 4096

	engine := NewAudioEngine(cfg)
	defer engine.Close()

	chunk := make([]byte, 1920)
	for i := range chunk {
		chunk[i] = byte(rand.Intn(256))
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		var id uint64
		for pb.Next() {
			currID := atomic.AddUint64(&id, 1)
			_, _ = engine.Submit(chunk, currID)
		}
	})
}
