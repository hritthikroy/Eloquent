// Package audio provides iterative, stack-safe buffer management routines
// for the Jimmy BB audio pipeline, eliminating stack overflows and segmentation
// faults caused by deep recursion on high-frequency audio streams.
package audio

import (
	"errors"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"time"
)

var (
	// ErrNilBufferSlice indicates a nil or invalid buffer passed to processing.
	ErrNilBufferSlice = errors.New("cannot process nil buffer slice")
	// ErrBufferExhaustion indicates memory limits or queue saturation reached.
	ErrBufferExhaustion = errors.New("buffer memory limit or queue capacity reached")
	// ErrRecursionDepthExceeded is returned if a call chain exceeds safe depth.
	ErrRecursionDepthExceeded = errors.New("recursion depth limit exceeded (stack safety trip)")
)

// ChunkProcessingFn defines an iterative transformation callback.
type ChunkProcessingFn func(chunk []byte, index int) error

// ProcessedChunkInfo captures telemetry for processed audio segments.
type ProcessedChunkInfo struct {
	Index       int     `json:"index"`
	Size        int     `json:"size"`
	RMS         float64 `json:"rms"`
	Peak        int16   `json:"peak"`
	IsSpeech    bool    `json:"isSpeech"`
	TimestampNs int64   `json:"timestampNs"`
}

// TrampolineStep represents a single executable unit of work in a trampoline loop.
type TrampolineStep func() (TrampolineStep, error)

// ExecuteTrampoline executes steps iteratively on the heap, guaranteeing O(1) stack space.
func ExecuteTrampoline(initial TrampolineStep) error {
	step := initial
	for step != nil {
		next, err := step()
		if err != nil {
			return err
		}
		step = next
	}
	return nil
}

// JimmyBufferManagerConfig sets sizing, stack bounds, and heap safety margins.
type JimmyBufferManagerConfig struct {
	MaxChunkSize     int     `json:"maxChunkSize"`     // Default: 1920 (20ms at 48kHz)
	MaxStackDepth    int     `json:"maxStackDepth"`    // Maximum simulated recursion depth (Default: 500)
	SpeechThreshold  float64 `json:"speechThreshold"`  // RMS threshold for speech detection
	HeapSafeguardMB  float64 `json:"heapSafeguardMB"`  // Max memory before backpressure trip
	EnableTrampoline bool    `json:"enableTrampoline"` // Use trampoline for dynamic sub-segmentation
}

// DefaultJimmyConfig provides production-hardened defaults.
func DefaultJimmyConfig() JimmyBufferManagerConfig {
	return JimmyBufferManagerConfig{
		MaxChunkSize:     1920,
		MaxStackDepth:    500,
		SpeechThreshold:  0.003,
		HeapSafeguardMB:  200.0,
		EnableTrampoline: true,
	}
}

// JimmyBufferManager coordinates heap-safe audio buffer processing.
type JimmyBufferManager struct {
	cfg            JimmyBufferManagerConfig
	pool           sync.Pool
	chunksHandled  atomic.Uint64
	overflowTrips  atomic.Uint64
	trampolineRuns atomic.Uint64
	totalBytes     atomic.Uint64
	activeInFlight atomic.Int64
}

// NewJimmyBufferManager initializes a buffer manager with an internal sync.Pool.
func NewJimmyBufferManager(cfg JimmyBufferManagerConfig) *JimmyBufferManager {
	if cfg.MaxChunkSize <= 0 {
		cfg.MaxChunkSize = 1920
	}
	if cfg.MaxStackDepth <= 0 {
		cfg.MaxStackDepth = 500
	}
	if cfg.SpeechThreshold <= 0 {
		cfg.SpeechThreshold = 0.003
	}

	jbm := &JimmyBufferManager{
		cfg: cfg,
	}

	jbm.pool.New = func() interface{} {
		b := make([]byte, cfg.MaxChunkSize)
		return b
	}

	return jbm
}

// ProcessIterative processes an arbitrary buffer of audio data by slicing it into
// fixed chunks iteratively. This eliminates stack frame accumulation.
func (m *JimmyBufferManager) ProcessIterative(data []byte, chunkSize int) ([]ProcessedChunkInfo, error) {
	if len(data) == 0 {
		return nil, nil
	}
	if chunkSize <= 0 {
		chunkSize = m.cfg.MaxChunkSize
	}

	totalLen := len(data)
	numChunks := (totalLen + chunkSize - 1) / chunkSize
	results := make([]ProcessedChunkInfo, 0, numChunks)

	// Strictly iterative loop (no recursion)
	for offset := 0; offset < totalLen; offset += chunkSize {
		end := offset + chunkSize
		if end > totalLen {
			end = totalLen
		}
		chunk := data[offset:end]
		info := m.analyzeChunk(chunk, len(results))
		results = append(results, info)

		m.chunksHandled.Add(1)
		m.totalBytes.Add(uint64(len(chunk)))
	}

	return results, nil
}

// ProcessWithTrampoline processes a sequence of audio operations using the trampoline pattern,
// ensuring that arbitrary subdivision of audio data runs in constant stack space.
func (m *JimmyBufferManager) ProcessWithTrampoline(data []byte, chunkSize int, onChunk ChunkProcessingFn) error {
	if len(data) == 0 {
		return nil
	}
	if chunkSize <= 0 {
		chunkSize = m.cfg.MaxChunkSize
	}

	offset := 0
	chunkIdx := 0
	totalLen := len(data)

	// Define step function closing over heap state (trampoline node)
	var step TrampolineStep
	step = func() (TrampolineStep, error) {
		if offset >= totalLen {
			return nil, nil // Done
		}

		end := offset + chunkSize
		if end > totalLen {
			end = totalLen
		}

		slice := data[offset:end]
		if onChunk != nil {
			if err := onChunk(slice, chunkIdx); err != nil {
				return nil, err
			}
		}

		m.chunksHandled.Add(1)
		m.totalBytes.Add(uint64(len(slice)))

		offset += chunkSize
		chunkIdx++

		// Return next step to trampoline runner without growing the call stack
		return step, nil
	}

	m.trampolineRuns.Add(1)
	return ExecuteTrampoline(step)
}

// SimulateRecursiveSafe converts what would be a deep recursion into a bounded loop,
// returning ErrRecursionDepthExceeded if depth exceeds MaxStackDepth.
func (m *JimmyBufferManager) SimulateRecursiveSafe(depth int, callback func(currentDepth int) error) error {
	if depth < 0 {
		return errors.New("depth cannot be negative")
	}

	// Check boundary guard
	if depth > m.cfg.MaxStackDepth {
		m.overflowTrips.Add(1)
		return fmt.Errorf("%w: depth %d > limit %d", ErrRecursionDepthExceeded, depth, m.cfg.MaxStackDepth)
	}

	// Iterative traversal of simulated depth
	for i := 0; i < depth; i++ {
		if callback != nil {
			if err := callback(i); err != nil {
				return err
			}
		}
	}
	return nil
}

// analyzeChunk evaluates RMS and Peak for PCM audio in O(1) stack space.
func (m *JimmyBufferManager) analyzeChunk(chunk []byte, index int) ProcessedChunkInfo {
	var sumSq float64
	var peak int16
	sampleCount := len(chunk) / 2

	for i := 0; i < len(chunk)-1; i += 2 {
		val := int16(uint16(chunk[i]) | (uint16(chunk[i+1]) << 8))
		absVal := val
		if absVal < 0 {
			absVal = -absVal
		}
		if absVal > peak {
			peak = absVal
		}
		norm := float64(val) / 32768.0
		sumSq += norm * norm
	}

	var rms float64
	if sampleCount > 0 {
		rms = math.Sqrt(sumSq / float64(sampleCount))
	}

	return ProcessedChunkInfo{
		Index:       index,
		Size:        len(chunk),
		RMS:         rms,
		Peak:        peak,
		IsSpeech:    rms >= m.cfg.SpeechThreshold,
		TimestampNs: time.Now().UnixNano(),
	}
}

// GetMetrics returns real-time processing statistics.
func (m *JimmyBufferManager) GetMetrics() map[string]interface{} {
	return map[string]interface{}{
		"chunksHandled":  m.chunksHandled.Load(),
		"overflowTrips":  m.overflowTrips.Load(),
		"trampolineRuns": m.trampolineRuns.Load(),
		"totalBytes":     m.totalBytes.Load(),
		"activeInFlight": m.activeInFlight.Load(),
	}
}
