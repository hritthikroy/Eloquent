package state

import (
	"errors"
	"fmt"
	"sync"
)

// AudioConfig defines the configurable audio backend parameters.
type AudioConfig struct {
	SampleRate   int     `json:"sampleRate"`
	BufferSize   int     `json:"bufferSize"`
	OutputDevice string  `json:"outputDevice"`
	Channels     int     `json:"channels,omitempty"`
	Volume       float64 `json:"volume,omitempty"`
}

var (
	globalAudioConfig = AudioConfig{
		SampleRate:   48000,
		BufferSize:   1024,
		OutputDevice: "default",
		Channels:     1,
		Volume:       1.0,
	}
	audioConfigMu sync.RWMutex
	configChannel = make(chan AudioConfig, 10)
)

// DefaultAudioConfig returns default safe audio parameters.
func DefaultAudioConfig() AudioConfig {
	return AudioConfig{
		SampleRate:   48000,
		BufferSize:   1024,
		OutputDevice: "default",
		Channels:     1,
		Volume:       1.0,
	}
}

// ValidateAudioConfig validates parameters.
func ValidateAudioConfig(cfg AudioConfig) error {
	allowedSampleRates := map[int]bool{
		8000:  true,
		16000: true,
		22050: true,
		44100: true,
		48000: true,
		96000: true,
	}
	if !allowedSampleRates[cfg.SampleRate] {
		return fmt.Errorf("invalid sample rate: %d", cfg.SampleRate)
	}
	if cfg.BufferSize < 64 || cfg.BufferSize > 8192 {
		return fmt.Errorf("invalid buffer size: %d", cfg.BufferSize)
	}
	if cfg.OutputDevice == "" {
		return errors.New("output device cannot be empty")
	}
	return nil
}

// SetConfig validates and updates global configuration.
func SetConfig(cfg AudioConfig) error {
	if err := ValidateAudioConfig(cfg); err != nil {
		return err
	}
	audioConfigMu.Lock()
	if cfg.Channels <= 0 {
		cfg.Channels = globalAudioConfig.Channels
	}
	if cfg.Volume <= 0 {
		cfg.Volume = globalAudioConfig.Volume
	}
	globalAudioConfig = cfg
	audioConfigMu.Unlock()

	select {
	case configChannel <- cfg:
	default:
	}

	return nil
}

// GetConfig retrieves global configuration.
func GetConfig() AudioConfig {
	audioConfigMu.RLock()
	defer audioConfigMu.RUnlock()
	return globalAudioConfig
}

// GetConfigUpdateChannel returns the config update channel.
func GetConfigUpdateChannel() <-chan AudioConfig {
	return configChannel
}

// ResetConfigToDefaults restores default configuration.
func ResetConfigToDefaults() AudioConfig {
	defaults := DefaultAudioConfig()
	_ = SetConfig(defaults)
	return defaults
}
