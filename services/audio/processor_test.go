package audio

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"math"
	"strings"
	"testing"
	"time"
)

func TestAudioStreamHandler_InitCapture(t *testing.T) {
	handler := NewAudioStreamHandler(DefaultConfig(), nil)
	if handler.IsActive() {
		t.Fatal("expected handler to be inactive before InitCapture")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := handler.InitCapture(ctx); err != nil {
		t.Fatalf("InitCapture failed: %v", err)
	}

	if !handler.IsActive() {
		t.Fatal("expected handler to be active after InitCapture")
	}

	// Calling InitCapture again should return ErrCaptureAlreadyActive
	if err := handler.InitCapture(ctx); err != ErrCaptureAlreadyActive {
		t.Fatalf("expected ErrCaptureAlreadyActive, got %v", err)
	}

	if err := handler.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	if handler.IsActive() {
		t.Fatal("expected handler to be inactive after Close")
	}
}

func TestAudioStreamHandler_ProcessFrame_NilSafety(t *testing.T) {
	handler := NewAudioStreamHandler(DefaultConfig(), nil)

	// 1. Nil buffer
	frame, err := handler.ProcessFrame(nil)
	if err != ErrNilPCMData {
		t.Fatalf("expected ErrNilPCMData on nil input, got: %v", err)
	}
	if frame != nil {
		t.Fatal("expected nil frame on nil input")
	}

	// 2. Empty buffer
	frame, err = handler.ProcessFrame([]byte{})
	if err != ErrEmptyPCMData {
		t.Fatalf("expected ErrEmptyPCMData on empty input, got: %v", err)
	}
	if frame != nil {
		t.Fatal("expected nil frame on empty input")
	}
}

func TestAudioStreamHandler_ProcessFrame_ValidPCM(t *testing.T) {
	cfg := DefaultConfig()
	cfg.SpeechThreshold = 0.01
	handler := NewAudioStreamHandler(cfg, nil)

	// Generate 512 bytes (256 samples) of 440Hz sine wave PCM
	pcm := make([]byte, 512)
	for i := 0; i < 256; i++ {
		sample := int16(16000 * math.Sin(2*math.Pi*440*float64(i)/16000))
		binary.LittleEndian.PutUint16(pcm[i*2:(i*2)+2], uint16(sample))
	}

	frame, err := handler.ProcessFrame(pcm)
	if err != nil {
		t.Fatalf("ProcessFrame failed on valid PCM: %v", err)
	}
	if frame == nil {
		t.Fatal("expected non-nil frame")
	}

	if frame.Size != 512 {
		t.Fatalf("expected frame size 512, got %d", frame.Size)
	}
	if frame.RMS <= 0 {
		t.Fatalf("expected positive RMS, got %f", frame.RMS)
	}
	if frame.Peak <= 0 {
		t.Fatalf("expected positive peak amplitude, got %d", frame.Peak)
	}
	if !frame.IsSpeech {
		t.Fatalf("expected speech detection on 16000 amplitude sine wave, RMS was %f", frame.RMS)
	}

	processed, _, _ := handler.Stats()
	if processed != 1 {
		t.Fatalf("expected 1 processed frame, got %d", processed)
	}
}

func TestAudioStreamHandler_SemanticIntent_TruncatedInstruction(t *testing.T) {
	handler := NewAudioStreamHandler(DefaultConfig(), nil)

	testCases := []struct {
		input       string
		description string
	}{
		{"Chatter. Chatter for.", "Classic truncated gap transcript"},
		{"Chatter for.", "Shorter truncated gap transcript"},
		{"Chatter.", "Minimal truncated gap transcript"},
		{"Chatter. Chatter for", "Unpunctuated truncated gap"},
		{"chatter. chatter for.", "Lower case truncated transcript"},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			intent, matched := handler.ResolveSemanticIntent(tc.input)
			if !matched {
				t.Fatalf("failed to match truncated input: %q", tc.input)
			}
			if intent.Action != TaskActionWriteGoAudioService {
				t.Fatalf("expected action %q, got %q", TaskActionWriteGoAudioService, intent.Action)
			}
			if intent.Type != IntentTypeTechnicalTask {
				t.Fatalf("expected type %q, got %q", IntentTypeTechnicalTask, intent.Type)
			}
			if !intent.IsTruncated {
				t.Fatalf("expected IsTruncated to be true for %q", tc.input)
			}
			if !intent.BypassLLM {
				t.Fatalf("expected BypassLLM to be true for %q", tc.input)
			}
			if intent.Confidence < 0.95 {
				t.Fatalf("expected high confidence (>= 0.95), got %f", intent.Confidence)
			}
		})
	}
}

func TestAudioStreamHandler_SemanticIntent_Keywords(t *testing.T) {
	handler := NewAudioStreamHandler(DefaultConfig(), nil)

	testCases := []struct {
		input          string
		expectedAction TaskAction
		bypassLLM      bool
	}{
		{"Listen", TaskActionInitGoAudioService, true},
		{"Listen.", TaskActionInitGoAudioService, true},
		{"listen!", TaskActionInitGoAudioService, true},
		{"fix memory loop", TaskActionFixMemoryLoop, true},
		{"Fix memory loop immediately", TaskActionFixMemoryLoop, true},
		{"write prompt", TaskActionWritePrompt, true},
		{"Please write prompt for agent", TaskActionWritePrompt, true},
		{"Go service", TaskActionWriteGoAudioService, true},
		{"go audio service", TaskActionWriteGoAudioService, true},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			intent, matched := handler.ResolveSemanticIntent(tc.input)
			if !matched {
				t.Fatalf("expected input %q to match an intent", tc.input)
			}
			if intent.Action != tc.expectedAction {
				t.Fatalf("expected action %q, got %q", tc.expectedAction, intent.Action)
			}
			if intent.BypassLLM != tc.bypassLLM {
				t.Fatalf("expected BypassLLM=%v, got %v", tc.bypassLLM, intent.BypassLLM)
			}
		})
	}

	// Ensure conversational filler does NOT trigger high-confidence technical task
	conversationalChatter := []string{
		"Hey what is the weather today?",
		"Tell me a joke about coding",
		"Can you sing a song?",
	}
	for _, text := range conversationalChatter {
		_, matched := handler.ResolveSemanticIntent(text)
		if matched {
			t.Fatalf("conversational filler %q should not match deterministic technical tasks", text)
		}
	}
}

func TestAudioStreamHandler_EmitIntent(t *testing.T) {
	var buf bytes.Buffer
	handler := NewAudioStreamHandler(DefaultConfig(), &buf)

	testIntent := Intent{
		ID:              "intent-test-123",
		Type:            IntentTypeTechnicalTask,
		Action:          TaskActionWriteGoAudioService,
		Confidence:      0.99,
		RawInput:        "Chatter. Chatter for.",
		NormalizedInput: "chatter chatter for",
		IsTruncated:     true,
		BypassLLM:       true,
		TargetService:   "services/audio",
		TimestampNs:     time.Now().UnixNano(),
	}

	if err := handler.EmitIntent(testIntent); err != nil {
		t.Fatalf("EmitIntent failed: %v", err)
	}

	output := buf.String()
	if !strings.HasSuffix(output, "\n") {
		t.Fatal("expected newline delimiter in emitted intent output")
	}

	var parsed Intent
	if err := json.Unmarshal(buf.Bytes(), &parsed); err != nil {
		t.Fatalf("failed to parse emitted JSON intent: %v", err)
	}

	if parsed.ID != testIntent.ID {
		t.Fatalf("expected ID %q, got %q", testIntent.ID, parsed.ID)
	}
	if parsed.Action != testIntent.Action {
		t.Fatalf("expected Action %q, got %q", testIntent.Action, parsed.Action)
	}
	if parsed.IsTruncated != testIntent.IsTruncated {
		t.Fatalf("expected IsTruncated %v, got %v", testIntent.IsTruncated, parsed.IsTruncated)
	}
	if parsed.BypassLLM != testIntent.BypassLLM {
		t.Fatalf("expected BypassLLM %v, got %v", testIntent.BypassLLM, parsed.BypassLLM)
	}

	_, emitted, _ := handler.Stats()
	if emitted != 1 {
		t.Fatalf("expected 1 emitted intent, got %d", emitted)
	}
}
