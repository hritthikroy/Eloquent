// Package audio provides audio streaming, DSP processing, and prompt audio synthesis for Eloquent.
package audio

import (
	"errors"
	"math"
	"strings"
	"sync"
	"sync/atomic"
)

var (
	// ErrEmptyPromptText indicates that the prompt text provided for synthesis was empty.
	ErrEmptyPromptText = errors.New("prompt text cannot be empty or whitespace only")
	// ErrAudioServiceClosed indicates that the audio service instance is closed.
	ErrAudioServiceClosed = errors.New("audio prompt service is closed")
	// ErrAudioChannelFull indicates that the consumer audio channel buffer capacity was exceeded.
	ErrAudioChannelFull = errors.New("audio consumer frame channel is full")
)

// PromptAudioConfig configures stream parameters for prompt audio generation.
type PromptAudioConfig struct {
	SampleRate   int     // Audio sample rate in Hz (default: 16000)
	Channels     int     // Audio channel count (default: 1)
	FrameSizeMs  int     // Duration of each synthesized frame in ms (default: 20)
	ChannelCap   int     // Channel buffer capacity (default: 256)
	ToneFreqHz   float64 // Baseline acoustic synthesis frequency in Hz (default: 440.0)
	MaxTextBytes int     // Maximum permissible text length in bytes (default: 65536)
}

// PromptAudioMetrics tracks synthesis and frame throughput statistics.
type PromptAudioMetrics struct {
	PromptsGenerated  uint64 `json:"promptsGenerated"`
	FramesSynthesized uint64 `json:"framesSynthesized"`
	BytesSynthesized  uint64 `json:"bytesSynthesized"`
	IsActive          bool   `json:"isActive"`
}

// AudioService coordinates audio frame ingestion, buffer lifecycle, and voice-driven prompt synthesis.
type AudioService struct {
	mu                sync.RWMutex
	config            PromptAudioConfig
	framesChan        chan []byte
	isClosed          atomic.Bool
	promptsGenerated  atomic.Uint64
	framesSynthesized atomic.Uint64
	bytesSynthesized  atomic.Uint64
	bufferPool        sync.Pool
}

// NewAudioService initializes a new AudioService with standard audio synthesis parameters.
func NewAudioService(cfg ...PromptAudioConfig) *AudioService {
	var c PromptAudioConfig
	if len(cfg) > 0 {
		c = cfg[0]
	}

	if c.SampleRate <= 0 {
		c.SampleRate = 16000 // Standard 16kHz audio
	}
	if c.Channels <= 0 {
		c.Channels = 1 // Mono
	}
	if c.FrameSizeMs <= 0 {
		c.FrameSizeMs = 20 // 20ms audio frames
	}
	if c.ChannelCap <= 0 {
		c.ChannelCap = 256
	}
	if c.ToneFreqHz <= 0 {
		c.ToneFreqHz = 440.0
	}
	if c.MaxTextBytes <= 0 {
		c.MaxTextBytes = 65536
	}

	frameSizeBytes := (c.SampleRate * c.Channels * 2 * c.FrameSizeMs) / 1000

	s := &AudioService{
		config:     c,
		framesChan: make(chan []byte, c.ChannelCap),
		bufferPool: sync.Pool{
			New: func() interface{} {
				return make([]byte, frameSizeBytes)
			},
		},
	}

	return s
}

// Frames returns the read-only channel delivering synthesized prompt audio frames.
func (s *AudioService) Frames() <-chan []byte {
	return s.framesChan
}

// GeneratePromptAudio synthesizes audio frames from structured prompt text and dispatches them to the stream channel.
func (s *AudioService) GeneratePromptAudio(text string) error {
	if s.isClosed.Load() {
		return ErrAudioServiceClosed
	}

	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return ErrEmptyPromptText
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Truncate if exceeds max permissible text bounds
	if len(trimmed) > s.config.MaxTextBytes {
		trimmed = trimmed[:s.config.MaxTextBytes]
	}

	sampleRate := s.config.SampleRate
	channels := s.config.Channels
	frameMs := s.config.FrameSizeMs
	samplesPerFrame := (sampleRate * frameMs) / 1000
	bytesPerFrame := samplesPerFrame * channels * 2

	// Compute synthesized frame count based on text character volume (simulate acoustic duration)
	durationSeconds := math.Max(0.1, float64(len(trimmed))*0.02) // ~50 chars/second pace
	totalFrames := int(math.Ceil(durationSeconds * 1000.0 / float64(frameMs)))
	if totalFrames <= 0 {
		totalFrames = 1
	}

	var generatedBytes uint64

	for f := 0; f < totalFrames; f++ {
		frame := s.bufferPool.Get().([]byte)
		if len(frame) != bytesPerFrame {
			frame = make([]byte, bytesPerFrame)
		}

		// Generate 16-bit PCM sinusoidal acoustic payload
		for i := 0; i < samplesPerFrame; i++ {
			sampleIndex := f*samplesPerFrame + i
			t := float64(sampleIndex) / float64(sampleRate)
			// Smooth tone with gentle decay
			amp := 0.25 * math.Sin(2.0*math.Pi*s.config.ToneFreqHz*t)
			val := int16(amp * 32767.0)

			byteOffset := i * 2
			frame[byteOffset] = byte(val & 0xFF)
			frame[byteOffset+1] = byte((val >> 8) & 0xFF)
		}

		select {
		case s.framesChan <- frame:
			s.framesSynthesized.Add(1)
			s.bytesSynthesized.Add(uint64(len(frame)))
			generatedBytes += uint64(len(frame))
		default:
			// Non-blocking drop if channel capacity saturated
			s.bufferPool.Put(frame)
		}
	}

	s.promptsGenerated.Add(1)
	return nil
}

// GetMetrics returns a snapshot of audio synthesis telemetry metrics.
func (s *AudioService) GetMetrics() PromptAudioMetrics {
	return PromptAudioMetrics{
		PromptsGenerated:  s.promptsGenerated.Load(),
		FramesSynthesized: s.framesSynthesized.Load(),
		BytesSynthesized:  s.bytesSynthesized.Load(),
		IsActive:          !s.isClosed.Load(),
	}
}

// Close gracefully closes the audio service and releases the frame channel.
func (s *AudioService) Close() error {
	if s.isClosed.CompareAndSwap(false, true) {
		s.mu.Lock()
		defer s.mu.Unlock()
		close(s.framesChan)
	}
	return nil
}
