// Package audio provides a high-performance, fault-tolerant Go audio processing service
// designed for real-time PCM ingestion, sub-millisecond telemetry, and stateless
// intent resolution bypassing LLM conversational buffers.
package audio

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var (
	// ErrNilPCMData is returned when a nil PCM byte buffer is passed for processing.
	ErrNilPCMData = errors.New("audio: pcm buffer cannot be nil")
	// ErrEmptyPCMData is returned when an empty byte buffer is passed for processing.
	ErrEmptyPCMData = errors.New("audio: pcm buffer cannot be empty")
	// ErrHandlerClosed is returned when an operation is attempted on a closed handler.
	ErrHandlerClosed = errors.New("audio: stream handler is closed")
	// ErrCaptureAlreadyActive is returned when InitCapture is called on an active handler.
	ErrCaptureAlreadyActive = errors.New("audio: capture stream is already active")
)

// IntentType categorizes the resolved execution intent.
type IntentType string

const (
	IntentTypeTechnicalTask IntentType = "technical_task"
	IntentTypeSystemCommand IntentType = "system_command"
	IntentTypeAudioControl  IntentType = "audio_control"
)

// TaskAction specifies the deterministic technical task to be executed.
type TaskAction string

const (
	TaskActionWriteGoAudioService TaskAction = "write_go_audio_service"
	TaskActionInitGoAudioService  TaskAction = "init_go_audio_service"
	TaskActionFixMemoryLoop       TaskAction = "fix_memory_loop"
	TaskActionWritePrompt         TaskAction = "write_prompt"
	TaskActionStartCapture        TaskAction = "start_audio_capture"
	TaskActionStopCapture         TaskAction = "stop_audio_capture"
	TaskActionGeneralTechnical    TaskAction = "general_technical_task"
)

// Intent represents a structured, stateless intent emitted to the Node.js bridge.
type Intent struct {
	ID              string                 `json:"id"`
	Type            IntentType             `json:"type"`
	Action          TaskAction             `json:"action"`
	Confidence      float64                `json:"confidence"`
	RawInput        string                 `json:"raw_input"`
	NormalizedInput string                 `json:"normalized_input"`
	IsTruncated     bool                   `json:"is_truncated"`
	BypassLLM       bool                   `json:"bypass_llm"`
	TargetService   string                 `json:"target_service"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	TimestampNs     int64                  `json:"timestamp_ns"`
}

// ProcessedFrame holds audio telemetry derived from raw PCM buffers.
type ProcessedFrame struct {
	Size        int     `json:"size"`
	RMS         float64 `json:"rms"`
	Peak        int16   `json:"peak"`
	IsSpeech    bool    `json:"is_speech"`
	TimestampNs int64   `json:"timestamp_ns"`
}

// AudioConfig defines the capture and DSP parameters.
type AudioConfig struct {
	SampleRate      int     `json:"sample_rate"`      // e.g. 16000 Hz
	Channels        int     `json:"channels"`         // 1 (Mono)
	BitDepth        int     `json:"bit_depth"`        // 16-bit
	FrameSize       int     `json:"frame_size"`       // Frame size in bytes (e.g. 512, 1024)
	SpeechThreshold float64 `json:"speech_threshold"` // RMS threshold for voice detection
	ChannelCapacity int     `json:"channel_capacity"` // Non-blocking queue capacity
}

// DefaultConfig returns optimal DSP defaults for low-latency voice capture.
func DefaultConfig() AudioConfig {
	return AudioConfig{
		SampleRate:      16000,
		Channels:        1,
		BitDepth:        16,
		FrameSize:       512,
		SpeechThreshold: 0.015,
		ChannelCapacity: 256,
	}
}

// Pre-compiled regexes for deterministic, microsecond-level intent matching.
var (
	reTruncatedChatter = regexp.MustCompile(`(?i)\bchatter\b(?:\.?\s*chatter\s*(?:for)?)?\.?$`)
	reFixMemoryLoop    = regexp.MustCompile(`(?i)\bfix\s+memory\s+loop\b`)
	reWritePrompt      = regexp.MustCompile(`(?i)\bwrite\s+prompt\b`)
	reGoService        = regexp.MustCompile(`(?i)\bgo\s+(?:audio\s+)?service\b`)
	reListenCommand    = regexp.MustCompile(`(?i)^\s*listen[\s\.\!\?]*$`)
)

// AudioStreamHandler manages the lifecycle of the audio ingestion goroutine,
// DSP frame processing, and zero-latency intent emissions.
type AudioStreamHandler struct {
	config     AudioConfig
	mu         sync.RWMutex
	ctx        context.Context
	cancel     context.CancelFunc
	frameChan  chan []byte
	intentChan chan Intent

	active          atomic.Bool
	processedFrames atomic.Uint64
	emittedIntents  atomic.Uint64
	droppedFrames   atomic.Uint64

	writer   io.Writer
	writerMu sync.Mutex
	wg       sync.WaitGroup
}

// NewAudioStreamHandler creates an instance of AudioStreamHandler.
// If writer is nil, os.Stdout is used by default.
func NewAudioStreamHandler(config AudioConfig, writer io.Writer) *AudioStreamHandler {
	if config.SampleRate <= 0 {
		config.SampleRate = 16000
	}
	if config.BitDepth <= 0 {
		config.BitDepth = 16
	}
	if config.Channels <= 0 {
		config.Channels = 1
	}
	if config.SpeechThreshold <= 0 {
		config.SpeechThreshold = 0.015
	}
	if config.ChannelCapacity <= 0 {
		config.ChannelCapacity = 256
	}
	if writer == nil {
		writer = os.Stdout
	}

	return &AudioStreamHandler{
		config: config,
		writer: writer,
	}
}

// InitCapture initializes the stream capture goroutine with non-blocking channels
// and panic-recovery wrappers.
func (h *AudioStreamHandler) InitCapture(ctx context.Context) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("audio: recovered from InitCapture panic: %v", r)
		}
	}()

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.active.Load() {
		return ErrCaptureAlreadyActive
	}

	if ctx == nil {
		ctx = context.Background()
	}
	h.ctx, h.cancel = context.WithCancel(ctx)
	h.frameChan = make(chan []byte, h.config.ChannelCapacity)
	h.intentChan = make(chan Intent, h.config.ChannelCapacity)
	h.active.Store(true)

	h.wg.Add(1)
	go func() {
		defer h.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				fmt.Fprintf(os.Stderr, "[AudioStreamHandler] Recovered from worker panic: %v\n", r)
			}
		}()
		h.workerLoop()
	}()

	return nil
}

// workerLoop processes queued audio frames in the background.
func (h *AudioStreamHandler) workerLoop() {
	for {
		select {
		case <-h.ctx.Done():
			return
		case data, ok := <-h.frameChan:
			if !ok {
				return
			}
			if len(data) > 0 {
				_, _ = h.calculateDSP(data)
			}
		}
	}
}

// ProcessFrame processes a raw PCM audio chunk with strict nil/empty checks,
// calculates sub-millisecond RMS and peak telemetry, and returns a ProcessedFrame.
// It is protected by a panic-recovery wrapper to ensure uninterrupted service.
func (h *AudioStreamHandler) ProcessFrame(pcmData []byte) (frame *ProcessedFrame, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("audio: recovered from ProcessFrame panic: %v", r)
		}
	}()

	if pcmData == nil {
		return nil, ErrNilPCMData
	}
	if len(pcmData) == 0 {
		return nil, ErrEmptyPCMData
	}

	frame, err = h.calculateDSP(pcmData)
	if err != nil {
		return nil, err
	}

	h.processedFrames.Add(1)

	// Non-blocking handoff to capture worker loop if stream is active
	if h.active.Load() && h.frameChan != nil {
		select {
		case h.frameChan <- pcmData:
		default:
			// Frame dropped to maintain zero-latency SLA without stalling caller
			h.droppedFrames.Add(1)
		}
	}

	return frame, nil
}

// calculateDSP computes RMS and Peak amplitude from 16-bit linear PCM byte buffers.
func (h *AudioStreamHandler) calculateDSP(pcmData []byte) (*ProcessedFrame, error) {
	sampleCount := len(pcmData) / 2
	if sampleCount == 0 {
		return &ProcessedFrame{
			Size:        len(pcmData),
			RMS:         0,
			Peak:        0,
			IsSpeech:    false,
			TimestampNs: time.Now().UnixNano(),
		}, nil
	}

	var sumSquares float64
	var peak int16

	for i := 0; i < len(pcmData)-1; i += 2 {
		val := int16(binary.LittleEndian.Uint16(pcmData[i : i+2]))
		if val > peak {
			peak = val
		} else if -val > peak {
			peak = -val
		}

		norm := float64(val) / 32768.0
		sumSquares += norm * norm
	}

	rms := math.Sqrt(sumSquares / float64(sampleCount))
	isSpeech := rms >= h.config.SpeechThreshold

	return &ProcessedFrame{
		Size:        len(pcmData),
		RMS:         rms,
		Peak:        peak,
		IsSpeech:    isSpeech,
		TimestampNs: time.Now().UnixNano(),
	}, nil
}

// ResolveSemanticIntent parses transcribed text and maps high-confidence technical
// commands and truncated instructions directly to deterministic tasks.
// Returns (Intent, true) when mapped, or (Intent{}, false) for unhandled chatter.
func (h *AudioStreamHandler) ResolveSemanticIntent(transcript string) (Intent, bool) {
	trimmed := strings.TrimSpace(transcript)
	if trimmed == "" {
		return Intent{}, false
	}

	normalized := strings.ToLower(trimmed)
	normalized = strings.Join(strings.Fields(normalized), " ")

	nowNs := time.Now().UnixNano()

	// 1. Detect truncated instruction gap ("Chatter. Chatter for.", "Chatter for.", "Chatter.")
	if reTruncatedChatter.MatchString(normalized) || strings.HasPrefix(normalized, "chatter") {
		return Intent{
			ID:              generateIntentID(),
			Type:            IntentTypeTechnicalTask,
			Action:          TaskActionWriteGoAudioService,
			Confidence:      0.99,
			RawInput:        transcript,
			NormalizedInput: normalized,
			IsTruncated:     true,
			BypassLLM:       true,
			TargetService:   "services/audio",
			Metadata: map[string]interface{}{
				"detected_gap": "truncated_instruction",
				"target_task":  "write_go_audio_service",
			},
			TimestampNs: nowNs,
		}, true
	}

	// 2. High-confidence technical keywords: "Listen" -> triggers Go audio service initialization
	if reListenCommand.MatchString(trimmed) {
		return Intent{
			ID:              generateIntentID(),
			Type:            IntentTypeTechnicalTask,
			Action:          TaskActionInitGoAudioService,
			Confidence:      0.99,
			RawInput:        transcript,
			NormalizedInput: normalized,
			IsTruncated:     false,
			BypassLLM:       true,
			TargetService:   "services/audio",
			Metadata: map[string]interface{}{
				"command":     "listen",
				"target_task": "init_go_audio_service",
			},
			TimestampNs: nowNs,
		}, true
	}

	// 3. Technical task: "fix memory loop"
	if reFixMemoryLoop.MatchString(normalized) {
		return Intent{
			ID:              generateIntentID(),
			Type:            IntentTypeTechnicalTask,
			Action:          TaskActionFixMemoryLoop,
			Confidence:      0.99,
			RawInput:        transcript,
			NormalizedInput: normalized,
			IsTruncated:     false,
			BypassLLM:       true,
			TargetService:   "services/state",
			Metadata: map[string]interface{}{
				"target_task": "fix_memory_loop",
			},
			TimestampNs: nowNs,
		}, true
	}

	// 4. Technical task: "write prompt"
	if reWritePrompt.MatchString(normalized) {
		return Intent{
			ID:              generateIntentID(),
			Type:            IntentTypeTechnicalTask,
			Action:          TaskActionWritePrompt,
			Confidence:      0.99,
			RawInput:        transcript,
			NormalizedInput: normalized,
			IsTruncated:     false,
			BypassLLM:       true,
			TargetService:   "services/prompt",
			Metadata: map[string]interface{}{
				"target_task": "write_prompt",
			},
			TimestampNs: nowNs,
		}, true
	}

	// 5. Technical task: "Go service" / "Go audio service"
	if reGoService.MatchString(normalized) {
		return Intent{
			ID:              generateIntentID(),
			Type:            IntentTypeTechnicalTask,
			Action:          TaskActionWriteGoAudioService,
			Confidence:      0.99,
			RawInput:        transcript,
			NormalizedInput: normalized,
			IsTruncated:     false,
			BypassLLM:       true,
			TargetService:   "services/audio",
			Metadata: map[string]interface{}{
				"target_task": "write_go_audio_service",
			},
			TimestampNs: nowNs,
		}, true
	}

	return Intent{}, false
}

// EmitIntent serializes a structured JSON intent object and outputs it to the Node.js bridge.
// Protected with panic-recovery and mutex-guarded writer access.
func (h *AudioStreamHandler) EmitIntent(intent Intent) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("audio: recovered from EmitIntent panic: %v", r)
		}
	}()

	if intent.ID == "" {
		intent.ID = generateIntentID()
	}
	if intent.TimestampNs == 0 {
		intent.TimestampNs = time.Now().UnixNano()
	}

	payload, err := json.Marshal(intent)
	if err != nil {
		return fmt.Errorf("audio: failed to marshal intent: %w", err)
	}

	var buf bytes.Buffer
	buf.Write(payload)
	buf.WriteByte('\n')

	h.writerMu.Lock()
	if h.writer != nil {
		_, err = h.writer.Write(buf.Bytes())
	}
	h.writerMu.Unlock()

	if err != nil {
		return fmt.Errorf("audio: failed to write intent to stream: %w", err)
	}

	h.emittedIntents.Add(1)

	// Non-blocking notification on intent channel if active
	if h.active.Load() && h.intentChan != nil {
		select {
		case h.intentChan <- intent:
		default:
		}
	}

	return nil
}

// Close terminates active capture goroutines and releases resources.
func (h *AudioStreamHandler) Close() error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if !h.active.Load() {
		return nil
	}

	h.active.Store(false)
	if h.cancel != nil {
		h.cancel()
	}

	h.wg.Wait()

	if h.frameChan != nil {
		close(h.frameChan)
		h.frameChan = nil
	}
	if h.intentChan != nil {
		close(h.intentChan)
		h.intentChan = nil
	}

	return nil
}

// IsActive returns whether the audio stream capture goroutine is running.
func (h *AudioStreamHandler) IsActive() bool {
	return h.active.Load()
}

// Stats returns a snapshot of frame and intent counters.
func (h *AudioStreamHandler) Stats() (processed uint64, emitted uint64, dropped uint64) {
	return h.processedFrames.Load(), h.emittedIntents.Load(), h.droppedFrames.Load()
}

// IntentChannel returns the read-only channel for emitted intents.
func (h *AudioStreamHandler) IntentChannel() <-chan Intent {
	return h.intentChan
}

// generateIntentID creates a unique cryptographically random hex identifier.
func generateIntentID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("intent-%d", time.Now().UnixNano())
	}
	return "intent-" + hex.EncodeToString(b)
}
