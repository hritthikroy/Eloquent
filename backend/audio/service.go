// Package state provides core Go audio processing engine, stream management,
// buffer allocation, and linguistic text normalization service integration.
package state

import (
	"sync"
	"sync/atomic"
)

// AudioTextService provides text normalization and validation for audio streams,
// transcription pipelines, and neural TTS synthesis inputs.
type AudioTextService struct {
	mu                 sync.RWMutex
	normalizedCount    atomic.Uint64
	transcriptionCount atomic.Uint64
	ttsCount           atomic.Uint64
}

var (
	defaultTextService     *AudioTextService
	defaultTextServiceOnce sync.Once
)

// GetAudioTextService returns the singleton AudioTextService instance.
func GetAudioTextService() *AudioTextService {
	defaultTextServiceOnce.Do(func() {
		defaultTextService = &AudioTextService{}
	})
	return defaultTextService
}

// ProcessTranscription cleans and normalizes raw audio transcription text
// before it is persisted or dispatched to the Electron main process.
func (s *AudioTextService) ProcessTranscription(rawTranscript string) string {
	s.transcriptionCount.Add(1)
	normalized := NormalizeBanglaText(rawTranscript)
	if normalized != rawTranscript {
		s.normalizedCount.Add(1)
	}
	return normalized
}

// ProcessTTSInput cleans and normalizes text meant for neural speech synthesis (TTS)
// to ensure standard pronunciation and prevent acoustic stutter from broken conjuncts.
func (s *AudioTextService) ProcessTTSInput(rawInput string) string {
	s.ttsCount.Add(1)
	normalized := NormalizeBanglaText(rawInput)
	if normalized != rawInput {
		s.normalizedCount.Add(1)
	}
	return normalized
}

// NormalizeAudioStreamText normalizes a text string passing through the audio pipeline.
func (s *AudioTextService) NormalizeAudioStreamText(rawText string) string {
	return NormalizeBanglaText(rawText)
}

// Stats returns the telemetry metrics of the text normalization service.
func (s *AudioTextService) Stats() (normalized uint64, transcriptions uint64, tts uint64) {
	return s.normalizedCount.Load(), s.transcriptionCount.Load(), s.ttsCount.Load()
}

// Package-level convenience helpers for direct invocation
func ProcessTranscription(rawTranscript string) string {
	return GetAudioTextService().ProcessTranscription(rawTranscript)
}

func ProcessTTSInput(rawInput string) string {
	return GetAudioTextService().ProcessTTSInput(rawInput)
}
