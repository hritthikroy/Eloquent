// Package audio provides the stream streaming pipeline connecting the Go audio
// backend with the Electron/Node.js bridge.
package audio

import (
	"context"
	"errors"
	"io"
	"sync/atomic"
	"time"
)

var (
	// ErrStreamClosed indicates the audio streamer has been closed.
	ErrStreamClosed = errors.New("audio streamer is closed")
	// ErrNilDispatchFunc indicates a missing dispatch callback.
	ErrNilDispatchFunc = errors.New("dispatch function cannot be nil")
)

// StreamerConfig defines stream buffer and pacing parameters.
type StreamerConfig struct {
	ChunkSize      int           `json:"chunkSize"`      // e.g. 1920 (20ms 48kHz mono)
	MaxConcurrency int           `json:"maxConcurrency"` // Parallel dispatch limit
	FlushTimeout   time.Duration `json:"flushTimeout"`
}

// StreamerMetrics provides telemetry on stream throughput and buffer lifecycles.
type StreamerMetrics struct {
	FramesStreamed   uint64  `json:"framesStreamed"`
	BytesStreamed    uint64  `json:"bytesStreamed"`
	FramesDropped    uint64  `json:"framesDropped"`
	AvgHandoffUs     float64 `json:"avgHandoffUs"`
	TotalHandoffNs   int64   `json:"totalHandoffNs"`
	IsStreaming      bool    `json:"isStreaming"`
}

// AudioStreamer coordinates stream reading and pooled buffer dispatch.
type AudioStreamer struct {
	processor *BufferProcessor
	config    StreamerConfig

	// Atomic telemetry
	framesStreamed atomic.Uint64
	bytesStreamed  atomic.Uint64
	framesDropped  atomic.Uint64
	totalHandoffNs atomic.Int64
	isStreaming    atomic.Bool
}

// NewAudioStreamer creates an AudioStreamer using the supplied BufferProcessor.
func NewAudioStreamer(processor *BufferProcessor, cfg StreamerConfig) *AudioStreamer {
	if cfg.ChunkSize <= 0 {
		cfg.ChunkSize = 1920 // Default 20ms frame at 48kHz
	}
	if cfg.MaxConcurrency <= 0 {
		cfg.MaxConcurrency = 8
	}

	return &AudioStreamer{
		processor: processor,
		config:    cfg,
	}
}

// StreamLoop reads continuous audio chunks from an io.Reader, acquires pooled buffers,
// dispatches them to the Electron bridge via dispatchFn, and explicitly returns the
// buffers to the pool immediately upon dispatch completion.
func (as *AudioStreamer) StreamLoop(ctx context.Context, reader io.Reader, dispatchFn func(data []byte) error) error {
	if dispatchFn == nil {
		return ErrNilDispatchFunc
	}

	as.isStreaming.Store(true)
	defer as.isStreaming.Store(false)

	chunkSize := as.config.ChunkSize

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// 1. Acquire pooled buffer to eliminate heap allocation
		buf := as.processor.AcquireBuffer(chunkSize)

		// 2. Read audio payload into pooled buffer
		n, err := io.ReadFull(reader, buf[:chunkSize])
		if n > 0 {
			startHandoff := time.Now()

			// 3. Dispatch to Electron bridge
			dispatchErr := dispatchFn(buf[:n])
			elapsed := time.Since(startHandoff).Nanoseconds()

			// 4. CRITICAL: Explicitly release buffer back to pool immediately after dispatch
			_ = as.processor.ReleaseBuffer(buf)

			if dispatchErr != nil {
				as.framesDropped.Add(1)
			} else {
				as.framesStreamed.Add(1)
				as.bytesStreamed.Add(uint64(n))
				as.totalHandoffNs.Add(elapsed)
			}
		} else {
			// If nothing was read, release the buffer back to the pool
			_ = as.processor.ReleaseBuffer(buf)
		}

		if err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				return nil
			}
			return err
		}
	}
}

// DispatchFrame manually dispatches a single frame using pooled buffer management.
// It acquires from the pool, copies the data, executes dispatchFn, and releases.
func (as *AudioStreamer) DispatchFrame(input []byte, dispatchFn func([]byte) error) error {
	if dispatchFn == nil {
		return ErrNilDispatchFunc
	}

	// 1. Acquire pooled buffer
	buf := as.processor.AcquireBuffer(len(input))
	copy(buf, input)

	startHandoff := time.Now()

	// 2. Dispatch frame
	err := dispatchFn(buf[:len(input)])
	elapsed := time.Since(startHandoff).Nanoseconds()

	// 3. Explicit return to pool
	_ = as.processor.ReleaseBuffer(buf)

	if err != nil {
		as.framesDropped.Add(1)
		return err
	}

	as.framesStreamed.Add(1)
	as.bytesStreamed.Add(uint64(len(input)))
	as.totalHandoffNs.Add(elapsed)

	return nil
}

// GetMetrics returns real-time streaming telemetry.
func (as *AudioStreamer) GetMetrics() StreamerMetrics {
	frames := as.framesStreamed.Load()
	totalNs := as.totalHandoffNs.Load()

	var avgHandoffUs float64
	if frames > 0 {
		avgHandoffUs = float64(totalNs) / float64(frames) / 1000.0
	}

	return StreamerMetrics{
		FramesStreamed: frames,
		BytesStreamed:  as.bytesStreamed.Load(),
		FramesDropped:  as.framesDropped.Load(),
		AvgHandoffUs:   avgHandoffUs,
		TotalHandoffNs: totalNs,
		IsStreaming:    as.isStreaming.Load(),
	}
}
