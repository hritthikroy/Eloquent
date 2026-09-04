// Package config provides configuration loading and validation for the
// Eloquent audio backend service.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

// AudioServiceConfig configures audio stream ingestion, networking, and memory thresholds.
type AudioServiceConfig struct {
	SampleRate      int           `json:"sampleRate"`      // AUDIO_SAMPLE_RATE (default: 48000)
	Channels        int           `json:"channels"`        // AUDIO_CHANNELS (default: 1)
	BufferSize      int           `json:"bufferSize"`      // AUDIO_BUFFER_SIZE (default: 1920)
	BindAddr        string        `json:"bindAddr"`        // AUDIO_BIND_ADDR (default: ":9090")
	WSPath          string        `json:"wsPath"`          // AUDIO_WS_PATH (default: "/audio/stream")
	StatusPath      string        `json:"statusPath"`      // AUDIO_STATUS_PATH (default: "/audio/status")
	MaxClients      int           `json:"maxClients"`      // AUDIO_MAX_CLIENTS (default: 32)
	ShutdownTimeout time.Duration `json:"shutdownTimeout"` // AUDIO_SHUTDOWN_TIMEOUT_MS (default: 5000ms)
	HeapWarningMB   float64       `json:"heapWarningMB"`   // AUDIO_HEAP_WARNING_MB (default: 200.0)
	VADThresholdRMS float64       `json:"vadThresholdRMS"` // AUDIO_VAD_THRESHOLD (default: 0.003)
	DropOldest      bool          `json:"dropOldest"`      // AUDIO_DROP_OLDEST (default: true)
}

// LoadFromEnv extracts configuration parameters from environmental variables
// with safe fallback defaults.
func LoadFromEnv() AudioServiceConfig {
	cfg := AudioServiceConfig{
		SampleRate:      48000,
		Channels:        1,
		BufferSize:      1920,
		BindAddr:        ":9090",
		WSPath:          "/audio/stream",
		StatusPath:      "/audio/status",
		MaxClients:      32,
		ShutdownTimeout: 5 * time.Second,
		HeapWarningMB:   200.0,
		VADThresholdRMS: 0.003,
		DropOldest:      true,
	}

	if val := os.Getenv("AUDIO_SAMPLE_RATE"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			cfg.SampleRate = n
		}
	}
	if val := os.Getenv("AUDIO_CHANNELS"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			cfg.Channels = n
		}
	}
	if val := os.Getenv("AUDIO_BUFFER_SIZE"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			cfg.BufferSize = n
		}
	}
	if val := os.Getenv("AUDIO_BIND_ADDR"); val != "" {
		cfg.BindAddr = val
	}
	if val := os.Getenv("AUDIO_WS_PATH"); val != "" {
		cfg.WSPath = val
	}
	if val := os.Getenv("AUDIO_STATUS_PATH"); val != "" {
		cfg.StatusPath = val
	}
	if val := os.Getenv("AUDIO_MAX_CLIENTS"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			cfg.MaxClients = n
		}
	}
	if val := os.Getenv("AUDIO_SHUTDOWN_TIMEOUT_MS"); val != "" {
		if ms, err := strconv.Atoi(val); err == nil && ms > 0 {
			cfg.ShutdownTimeout = time.Duration(ms) * time.Millisecond
		}
	}
	if val := os.Getenv("AUDIO_HEAP_WARNING_MB"); val != "" {
		if f, err := strconv.ParseFloat(val, 64); err == nil && f > 0 {
			cfg.HeapWarningMB = f
		}
	}
	if val := os.Getenv("AUDIO_VAD_THRESHOLD"); val != "" {
		if f, err := strconv.ParseFloat(val, 64); err == nil && f > 0 {
			cfg.VADThresholdRMS = f
		}
	}
	if val := os.Getenv("AUDIO_DROP_OLDEST"); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			cfg.DropOldest = b
		}
	}

	return cfg
}

// Validate checks configuration sanity and returns an error if any parameter
// violates system bounds.
func Validate(cfg AudioServiceConfig) error {
	if cfg.SampleRate < 8000 || cfg.SampleRate > 192000 {
		return fmt.Errorf("invalid sample rate %d (must be between 8000 and 192000 Hz)", cfg.SampleRate)
	}
	if cfg.Channels < 1 || cfg.Channels > 8 {
		return fmt.Errorf("invalid channels count %d (must be between 1 and 8)", cfg.Channels)
	}
	if cfg.BufferSize < 64 || cfg.BufferSize > (1<<20) {
		return fmt.Errorf("invalid buffer size %d (must be between 64 bytes and 1MB)", cfg.BufferSize)
	}
	if cfg.BindAddr == "" {
		return errors.New("bind address cannot be empty")
	}
	if cfg.MaxClients <= 0 {
		return errors.New("max clients must be greater than zero")
	}
	return nil
}
