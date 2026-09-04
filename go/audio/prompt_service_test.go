package audio

import (
	"errors"
	"strings"
	"sync"
	"testing"
)

func TestNewAudioServiceDefaults(t *testing.T) {
	svc := NewAudioService()
	defer svc.Close()

	metrics := svc.GetMetrics()
	if !metrics.IsActive {
		t.Fatalf("expected audio service to be active")
	}
	if metrics.PromptsGenerated != 0 || metrics.FramesSynthesized != 0 || metrics.BytesSynthesized != 0 {
		t.Fatalf("expected 0 initial metrics, got %+v", metrics)
	}

	ch := svc.Frames()
	if ch == nil {
		t.Fatalf("expected non-nil frames channel")
	}
}

func TestGeneratePromptAudioSuccess(t *testing.T) {
	svc := NewAudioService(PromptAudioConfig{
		SampleRate:  16000,
		Channels:    1,
		FrameSizeMs: 20,
		ChannelCap:  100,
	})
	defer svc.Close()

	promptText := "Clear Technical Objective\nImplement audio streaming service."
	err := svc.GeneratePromptAudio(promptText)
	if err != nil {
		t.Fatalf("unexpected error generating audio: %v", err)
	}

	metrics := svc.GetMetrics()
	if metrics.PromptsGenerated != 1 {
		t.Fatalf("expected 1 prompt generated, got %d", metrics.PromptsGenerated)
	}
	if metrics.FramesSynthesized == 0 || metrics.BytesSynthesized == 0 {
		t.Fatalf("expected non-zero synthesized frames/bytes, got %+v", metrics)
	}

	// Consume at least one synthesized frame from channel
	select {
	case frame := <-svc.Frames():
		if len(frame) == 0 {
			t.Fatalf("expected non-empty audio frame buffer")
		}
	default:
		t.Fatalf("expected audio frame ready in channel")
	}
}

func TestGeneratePromptAudioEmptyText(t *testing.T) {
	svc := NewAudioService()
	defer svc.Close()

	err1 := svc.GeneratePromptAudio("")
	if !errors.Is(err1, ErrEmptyPromptText) {
		t.Fatalf("expected ErrEmptyPromptText for empty string, got: %v", err1)
	}

	err2 := svc.GeneratePromptAudio("   \n\t  ")
	if !errors.Is(err2, ErrEmptyPromptText) {
		t.Fatalf("expected ErrEmptyPromptText for whitespace-only string, got: %v", err2)
	}
}

func TestGeneratePromptAudioClosedService(t *testing.T) {
	svc := NewAudioService()
	err := svc.Close()
	if err != nil {
		t.Fatalf("unexpected close error: %v", err)
	}

	// Secondary close is idempotent
	err = svc.Close()
	if err != nil {
		t.Fatalf("unexpected secondary close error: %v", err)
	}

	err = svc.GeneratePromptAudio("Test prompt text")
	if !errors.Is(err, ErrAudioServiceClosed) {
		t.Fatalf("expected ErrAudioServiceClosed, got: %v", err)
	}

	metrics := svc.GetMetrics()
	if metrics.IsActive {
		t.Fatalf("expected service to be inactive after close")
	}
}

func TestGeneratePromptAudioLargeTextTruncation(t *testing.T) {
	svc := NewAudioService(PromptAudioConfig{
		MaxTextBytes: 50,
		ChannelCap:   1000,
	})
	defer svc.Close()

	largeText := strings.Repeat("A", 500)
	err := svc.GeneratePromptAudio(largeText)
	if err != nil {
		t.Fatalf("expected successful synthesis for large text, got: %v", err)
	}

	metrics := svc.GetMetrics()
	if metrics.PromptsGenerated != 1 {
		t.Fatalf("expected 1 prompt generated, got %d", metrics.PromptsGenerated)
	}
}

func TestGeneratePromptAudioChannelSaturation(t *testing.T) {
	// Small channel capacity to test default non-blocking branch
	svc := NewAudioService(PromptAudioConfig{
		ChannelCap:  1,
		FrameSizeMs: 20,
	})
	defer svc.Close()

	// Feed prompt with many frames to overflow 1-slot channel
	longPrompt := strings.Repeat("Long technical objective directive word. ", 100)
	err := svc.GeneratePromptAudio(longPrompt)
	if err != nil {
		t.Fatalf("expected non-blocking drop without error, got: %v", err)
	}
}

func TestGeneratePromptAudioConcurrency(t *testing.T) {
	svc := NewAudioService(PromptAudioConfig{
		ChannelCap: 5000,
	})
	defer svc.Close()

	var wg sync.WaitGroup
	workers := 10
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			_ = svc.GeneratePromptAudio("Concurrent developer objective synthesis")
			_ = svc.GetMetrics()
		}(i)
	}
	wg.Wait()

	metrics := svc.GetMetrics()
	if metrics.PromptsGenerated != uint64(workers) {
		t.Fatalf("expected %d prompts generated, got %d", workers, metrics.PromptsGenerated)
	}
}
