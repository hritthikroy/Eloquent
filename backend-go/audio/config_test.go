package audio

import (
	"testing"
)

func TestAudioConfigValidation(t *testing.T) {
	validCfg := AudioConfig{
		SampleRate:   44100,
		BufferSize:   512,
		OutputDevice: "Speakers",
	}
	if err := ValidateAudioConfig(validCfg); err != nil {
		t.Fatalf("expected valid config to pass, got error: %v", err)
	}

	invalidSR := AudioConfig{
		SampleRate:   12345,
		BufferSize:   512,
		OutputDevice: "Speakers",
	}
	if err := ValidateAudioConfig(invalidSR); err == nil {
		t.Fatalf("expected invalid sample rate to fail")
	}

	invalidBuf := AudioConfig{
		SampleRate:   48000,
		BufferSize:   10,
		OutputDevice: "Speakers",
	}
	if err := ValidateAudioConfig(invalidBuf); err == nil {
		t.Fatalf("expected invalid buffer size to fail")
	}

	invalidDev := AudioConfig{
		SampleRate:   48000,
		BufferSize:   1024,
		OutputDevice: "",
	}
	if err := ValidateAudioConfig(invalidDev); err == nil {
		t.Fatalf("expected empty output device to fail")
	}
}

func TestSetConfigAndGetConfig(t *testing.T) {
	newCfg := AudioConfig{
		SampleRate:   96000,
		BufferSize:   2048,
		OutputDevice: "Headphones",
		Channels:     2,
		Volume:       0.9,
	}

	if err := SetConfig(newCfg); err != nil {
		t.Fatalf("SetConfig failed: %v", err)
	}

	retrieved := GetConfig()
	if retrieved.SampleRate != 96000 {
		t.Errorf("expected SampleRate 96000, got %d", retrieved.SampleRate)
	}
	if retrieved.BufferSize != 2048 {
		t.Errorf("expected BufferSize 2048, got %d", retrieved.BufferSize)
	}

	ch := GetConfigUpdateChannel()
	select {
	case updated := <-ch:
		if updated.SampleRate != 96000 {
			t.Errorf("channel update sample rate mismatch: %d", updated.SampleRate)
		}
	default:
		t.Errorf("expected config update on channel")
	}
}

func TestResetConfigToDefaults(t *testing.T) {
	ResetConfigToDefaults()
	cfg := GetConfig()
	if cfg.SampleRate != 48000 {
		t.Errorf("expected default SampleRate 48000, got %d", cfg.SampleRate)
	}
}
