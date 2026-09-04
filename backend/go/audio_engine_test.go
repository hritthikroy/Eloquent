package audio

import (
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
}

func TestAudioEngine_SelfHealingWorkerRecovery(t *testing.T) {
	cfg := DefaultEngineConfig()
	cfg.NumWorkers = 4
	cfg.QueueCapacity = 256

	engine := NewAudioEngine(cfg)
	defer engine.Close()

	var safeHandled uint64
	engine.Subscribe(func(frame *AudioFrame) {
		if frame.ID == 99999 {
			panic("simulated subscriber panic")
		}
		atomic.AddUint64(&safeHandled, 1)
	})

	_, _ = engine.Submit([]byte{0x01, 0x02, 0x03, 0x04}, 99999)
	time.Sleep(20 * time.Millisecond)

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
	cfg.QueueCapacity = 16

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
	cfg.HeartbeatTimeoutMs = 50

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
