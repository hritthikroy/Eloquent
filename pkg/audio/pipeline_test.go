package audio

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestConcurrentAudioPipelineInitialization(t *testing.T) {
	cfg := DefaultPipelineConfig()
	cfg.NumWorkers = 8
	p := NewConcurrentAudioPipeline(cfg)
	defer p.Close()

	metrics := p.GetMetrics()
	if metrics.ActiveWorkers != 8 {
		t.Errorf("expected 8 active workers, got %d", metrics.ActiveWorkers)
	}
	if metrics.FramesIngested != 0 {
		t.Errorf("expected 0 frames ingested initially, got %d", metrics.FramesIngested)
	}
}

func TestConcurrentAudioPipelineDSPProcessing(t *testing.T) {
	cfg := DefaultPipelineConfig()
	cfg.NumWorkers = 4
	p := NewConcurrentAudioPipeline(cfg)
	defer p.Close()

	var receivedCount int32
	var wg sync.WaitGroup
	wg.Add(100)

	p.Subscribe(func(chunk *AudioChunk) {
		atomic.AddInt32(&receivedCount, 1)
		if chunk.RMS <= 0 && chunk.Peak <= 0 {
			t.Errorf("expected positive RMS or peak on synthetic audio")
		}
		wg.Done()
	})

	// Generate 100 synthetic audio frames with sine wave PCM
	for i := 0; i < 100; i++ {
		data := make([]byte, 1920)
		sampleVal := (i + 1) * 20
		for j := 0; j < len(data)-1; j += 2 {
			data[j] = byte(sampleVal)
			data[j+1] = byte(sampleVal >> 8)
		}

		submitted := p.Submit(&AudioChunk{
			ID:          uint64(i + 1),
			TimestampNs: time.Now().UnixNano(),
			SampleRate:  48000,
			Channels:    1,
			Data:        data,
		})
		if !submitted {
			t.Fatalf("failed to submit frame %d", i)
		}
	}

	wg.Wait()

	if atomic.LoadInt32(&receivedCount) != 100 {
		t.Fatalf("expected 100 processed frames, got %d", receivedCount)
	}

	metrics := p.GetMetrics()
	if metrics.FramesProcessed < 100 {
		t.Errorf("expected at least 100 frames processed in metrics, got %d", metrics.FramesProcessed)
	}
	if metrics.ThroughputFPS <= 0 {
		t.Errorf("expected positive throughput FPS, got %f", metrics.ThroughputFPS)
	}
}

func TestConcurrentAudioPipelineBackpressure(t *testing.T) {
	// Create pipeline with tiny queue capacity
	cfg := PipelineConfig{
		NumWorkers:       1,
		QueueCapacity:    5,
		VADThresholdRMS:  0.0028,
		VADThresholdPeak: 700,
	}
	p := NewConcurrentAudioPipeline(cfg)
	defer p.Close()

	dummyData := make([]byte, 100)
	droppedOccurred := false

	// Submit burst of 500 items rapidly to saturate 5-capacity queue
	for i := 0; i < 500; i++ {
		ok := p.Submit(&AudioChunk{
			ID:   uint64(i + 1),
			Data: dummyData,
		})
		if !ok {
			droppedOccurred = true
		}
	}

	metrics := p.GetMetrics()
	if !droppedOccurred && metrics.FramesDropped == 0 {
		t.Errorf("expected backpressure drops on small queue under burst load")
	}
}

func TestConcurrentAudioPipelineHighVelocityThroughput(t *testing.T) {
	cfg := DefaultPipelineConfig()
	cfg.NumWorkers = 16
	cfg.QueueCapacity = 20000
	p := NewConcurrentAudioPipeline(cfg)
	defer p.Close()

	totalFrames := 5000
	var processedCount int32
	var wg sync.WaitGroup
	wg.Add(totalFrames)

	p.Subscribe(func(chunk *AudioChunk) {
		atomic.AddInt32(&processedCount, 1)
		wg.Done()
	})

	start := time.Now()
	testChunk := make([]byte, 960) // 10ms mono frame

	for i := 0; i < totalFrames; i++ {
		p.Submit(&AudioChunk{
			ID:   uint64(i + 1),
			Data: testChunk,
		})
	}

	wg.Wait()
	elapsed := time.Since(start)

	fps := float64(totalFrames) / elapsed.Seconds()
	t.Logf("High-velocity throughput: %.1f frames/sec across 16 worker goroutines", fps)

	if atomic.LoadInt32(&processedCount) != int32(totalFrames) {
		t.Fatalf("expected %d processed frames, got %d", totalFrames, processedCount)
	}
}
