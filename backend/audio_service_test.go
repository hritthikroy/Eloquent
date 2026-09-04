package backend

import (
	"bytes"
	"context"
	"testing"
	"time"
)

func TestAudioServiceContinuousReadLoop(t *testing.T) {
	cfg := AudioServiceConfig{
		BufferSize:     1024,
		ChannelBufSize: 100,
		SampleRate:     48000,
		Channels:       1,
	}

	service := NewAudioService(cfg)
	defer service.Close()

	// 100 frames of dummy PCM audio
	var inputBuffer bytes.Buffer
	dummyFrame := bytes.Repeat([]byte{0x42}, 1024)
	for i := 0; i < 50; i++ {
		inputBuffer.Write(dummyFrame)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Run ReadLoop
	go func() {
		_ = service.ReadLoop(ctx, &inputBuffer)
	}()

	// Consume frames
	receivedCount := 0
	timeout := time.After(1 * time.Second)

consumeLoop:
	for {
		select {
		case frame, ok := <-service.Frames():
			if !ok {
				break consumeLoop
			}
			receivedCount++
			service.RecycleFrame(frame)
			if receivedCount == 50 {
				break consumeLoop
			}
		case <-timeout:
			t.Fatalf("Timeout waiting for frames; received %d/50", receivedCount)
		}
	}

	metrics := service.GetMetrics()
	if metrics.FramesRead != 50 {
		t.Errorf("Expected 50 frames read, got %d", metrics.FramesRead)
	}
	if metrics.FramesDropped != 0 {
		t.Errorf("Expected 0 frames dropped, got %d", metrics.FramesDropped)
	}
	if !metrics.IsContinuous {
		t.Errorf("Expected IsContinuous to be true")
	}
}

func TestAudioServiceDirectIngest(t *testing.T) {
	cfg := AudioServiceConfig{
		BufferSize:     512,
		ChannelBufSize: 50,
	}

	service := NewAudioService(cfg)
	defer service.Close()

	data := []byte("zero-copy-audio-frame-test")
	err := service.IngestDirect(data)
	if err != nil {
		t.Fatalf("IngestDirect failed: %v", err)
	}

	select {
	case frame := <-service.Frames():
		if string(frame) != string(data) {
			t.Errorf("Frame content mismatch: got %s, want %s", string(frame), string(data))
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatalf("Frame not delivered to channel")
	}
}
