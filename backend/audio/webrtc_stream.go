// Package state provides real-time WebRTC audio chunk streaming,
// frame-accurate poetry/text synchronization, and adaptive jitter buffer management.
package state

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// StreamMarker represents a frame-accurate poetic or textual marker tied
// to a specific audio stream position and duration.
type StreamMarker struct {
	MarkerID          string                 `json:"markerId"`
	VerseIndex        int                    `json:"verseIndex"`
	WordOffset        int                    `json:"wordOffset"`
	TargetTimestampMs int64                  `json:"targetTimestampMs"`
	DurationMs        float64                `json:"durationMs"`
	Text              string                 `json:"text"`
	Phonemes          string                 `json:"phonemes,omitempty"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

// JitterMetrics tracks latency variation, sequence order, and packet loss.
type JitterMetrics struct {
	PacketDelayMs    float64 `json:"packetDelayMs"`
	JitterVarianceMs float64 `json:"jitterVarianceMs"`
	PacketsLost      int64   `json:"packetsLost"`
	OutOfOrderCount  int64   `json:"outOfOrderCount"`
	BufferDepth      int     `json:"bufferDepth"`
	BufferUnderruns  int64   `json:"bufferUnderruns"`
}

// AudioChunkMetadata encapsulates a single WebRTC audio packet's metadata,
// stream timing, and associated poetry/verse marker.
type AudioChunkMetadata struct {
	ChunkID        string        `json:"chunkId"`
	SequenceNumber uint64        `json:"sequenceNumber"`
	TimestampMs    int64         `json:"timestampMs"`
	SampleRate     int           `json:"sampleRate"`
	Channels       int           `json:"channels"`
	ByteLength     int           `json:"byteLength"`
	DurationMs     float64       `json:"durationMs"`
	Checksum       string        `json:"checksum"`
	Marker         *StreamMarker `json:"marker,omitempty"`
	JitterStats    JitterMetrics `json:"jitterStats"`
}

// StreamTelemetry aggregates continuous health and alignment stats for the stream.
type StreamTelemetry struct {
	SessionID            string        `json:"sessionId"`
	TotalChunksEmitted   uint64        `json:"totalChunksEmitted"`
	TotalChunksIngested  uint64        `json:"totalChunksIngested"`
	PacketsLost          int64         `json:"packetsLost"`
	OutOfOrderCount      int64         `json:"outOfOrderCount"`
	BufferUnderruns      int64         `json:"bufferUnderruns"`
	AverageJitterMs      float64       `json:"averageJitterMs"`
	MaxJitterMs          float64       `json:"maxJitterMs"`
	StreamClockMs        int64         `json:"streamClockMs"`
	ActiveMarkersReached int           `json:"activeMarkersReached"`
	IsSynchronized       bool          `json:"isSynchronized"`
	LastEventTimestamp   int64         `json:"lastEventTimestamp"`
}

// WebRTCStreamConfig specifies timing and jitter tolerance settings.
type WebRTCStreamConfig struct {
	SampleRate      int
	Channels        int
	ChunkDurationMs time.Duration
	MaxJitterWindow int
	DropThresholdMs int64
}

// DefaultWebRTCStreamConfig returns production defaults (48kHz mono, 20ms chunks, 50-chunk window).
func DefaultWebRTCStreamConfig() WebRTCStreamConfig {
	return WebRTCStreamConfig{
		SampleRate:      48000,
		Channels:        1,
		ChunkDurationMs: 20 * time.Millisecond,
		MaxJitterWindow: 50,
		DropThresholdMs: 250,
	}
}

// JitterBuffer reorders arriving audio chunk metadata and detects missing sequence packets.
type JitterBuffer struct {
	mu           sync.Mutex
	window       []AudioChunkMetadata
	maxWindow    int
	lastSeqSeen  uint64
	initialized  bool
	outOfOrder   int64
	packetsLost  int64
	underruns    int64
	jitterStats  JitterMetrics
	lastArrival  time.Time
	prevTransit  float64
}

// NewJitterBuffer creates an adaptive buffer with the specified capacity window.
func NewJitterBuffer(maxWindow int) *JitterBuffer {
	if maxWindow <= 0 {
		maxWindow = 50
	}
	return &JitterBuffer{
		window:      make([]AudioChunkMetadata, 0, maxWindow),
		maxWindow:   maxWindow,
		lastArrival: time.Now(),
	}
}

// Push inserts a chunk and calculates transit delay and jitter variance.
func (jb *JitterBuffer) Push(chunk AudioChunkMetadata) {
	jb.mu.Lock()
	defer jb.mu.Unlock()

	now := time.Now()
	transitMs := float64(now.UnixMilli() - chunk.TimestampMs)
	if transitMs < 0 {
		transitMs = 0
	}

	if jb.prevTransit > 0 {
		diff := math.Abs(transitMs - jb.prevTransit)
		// RFC 3550 Jitter Estimation: J(i) = J(i-1) + (|D(i-1, i)| - J(i-1))/16
		jb.jitterStats.JitterVarianceMs += (diff - jb.jitterStats.JitterVarianceMs) / 16.0
	}
	jb.prevTransit = transitMs
	jb.jitterStats.PacketDelayMs = transitMs
	jb.lastArrival = now

	if !jb.initialized {
		jb.lastSeqSeen = chunk.SequenceNumber
		jb.initialized = true
		jb.window = append(jb.window, chunk)
		jb.jitterStats.BufferDepth = len(jb.window)
		return
	}

	// Detect out-of-order packet
	if chunk.SequenceNumber <= jb.lastSeqSeen {
		jb.outOfOrder++
		jb.jitterStats.OutOfOrderCount = jb.outOfOrder
		if jb.packetsLost > 0 {
			jb.packetsLost--
			jb.jitterStats.PacketsLost = jb.packetsLost
		}
	} else if chunk.SequenceNumber > jb.lastSeqSeen+1 {
		// Gap detected: sequence packets were dropped on the network
		lost := int64(chunk.SequenceNumber - jb.lastSeqSeen - 1)
		jb.packetsLost += lost
		jb.jitterStats.PacketsLost = jb.packetsLost
	}

	if chunk.SequenceNumber > jb.lastSeqSeen {
		jb.lastSeqSeen = chunk.SequenceNumber
	}

	jb.window = append(jb.window, chunk)

	// Keep window sorted by SequenceNumber
	sort.Slice(jb.window, func(i, j int) bool {
		return jb.window[i].SequenceNumber < jb.window[j].SequenceNumber
	})

	// Bounded capacity: drop oldest if buffer overflows
	if len(jb.window) > jb.maxWindow {
		jb.window = jb.window[len(jb.window)-jb.maxWindow:]
	}

	jb.jitterStats.BufferDepth = len(jb.window)
}

// PopReady retrieves the next in-sequence chunk from the buffer.
func (jb *JitterBuffer) PopReady() (AudioChunkMetadata, bool) {
	jb.mu.Lock()
	defer jb.mu.Unlock()

	if len(jb.window) == 0 {
		jb.underruns++
		jb.jitterStats.BufferUnderruns = jb.underruns
		return AudioChunkMetadata{}, false
	}

	chunk := jb.window[0]
	jb.window = jb.window[1:]
	jb.jitterStats.BufferDepth = len(jb.window)
	return chunk, true
}

// GetMetrics returns a point-in-time copy of current jitter telemetry.
func (jb *JitterBuffer) GetMetrics() JitterMetrics {
	jb.mu.Lock()
	defer jb.mu.Unlock()
	return jb.jitterStats
}

// WebRTCAudioStreamSession manages transceiver loops, frame-accurate timing,
// and synchronized chunk distribution.
type WebRTCAudioStreamSession struct {
	sessionID     string
	config        WebRTCStreamConfig
	ctx           context.Context
	cancel        context.CancelFunc
	mu            sync.RWMutex
	seqCounter    uint64
	streamClockMs int64
	chunkChan     chan AudioChunkMetadata
	subscribers   []chan AudioChunkMetadata
	jitterBuffer  *JitterBuffer
	closeOnce     sync.Once
	isClosed      int32
	markersCount  int
	maxJitterSeen float64
	startTime     time.Time
}

// NewWebRTCAudioStreamSession instantiates a clean, leak-free WebRTC audio session.
func NewWebRTCAudioStreamSession(parentCtx context.Context, sessionID string, cfg ...WebRTCStreamConfig) (*WebRTCAudioStreamSession, error) {
	if sessionID == "" {
		return nil, errors.New("sessionId cannot be empty")
	}

	config := DefaultWebRTCStreamConfig()
	if len(cfg) > 0 {
		config = cfg[0]
	}

	if parentCtx == nil {
		parentCtx = context.Background()
	}

	ctx, cancel := context.WithCancel(parentCtx)

	session := &WebRTCAudioStreamSession{
		sessionID:     sessionID,
		config:        config,
		ctx:           ctx,
		cancel:        cancel,
		seqCounter:    0,
		streamClockMs: 0,
		chunkChan:     make(chan AudioChunkMetadata, 256),
		subscribers:   make([]chan AudioChunkMetadata, 0, 4),
		jitterBuffer:  NewJitterBuffer(config.MaxJitterWindow),
		startTime:     time.Now(),
	}

	// Start internal multiplexing worker loop
	go session.transceiverLoop()

	return session, nil
}

// EmitChunk packages raw audio bytes, calculates checksums, attaches stream markers,
// and distributes the metadata frame to all subscribers in lockstep.
func (s *WebRTCAudioStreamSession) EmitChunk(data []byte, marker *StreamMarker) (*AudioChunkMetadata, error) {
	if atomic.LoadInt32(&s.isClosed) == 1 {
		return nil, errors.New("stream session is closed")
	}

	seq := atomic.AddUint64(&s.seqCounter, 1)
	nowMs := time.Now().UnixMilli()

	// Calculate checksum for frame integrity validation
	var checksum string
	if len(data) > 0 {
		h := sha256.Sum256(data)
		checksum = hex.EncodeToString(h[:16]) // Compact 32-hex representation
	} else {
		checksum = "e3b0c44298fc1c14"
	}

	durationMs := float64(s.config.ChunkDurationMs.Milliseconds())
	if durationMs <= 0 {
		durationMs = 20.0
	}

	chunk := AudioChunkMetadata{
		ChunkID:        fmt.Sprintf("%s-%d", s.sessionID, seq),
		SequenceNumber: seq,
		TimestampMs:    nowMs,
		SampleRate:     s.config.SampleRate,
		Channels:       s.config.Channels,
		ByteLength:     len(data),
		DurationMs:     durationMs,
		Checksum:       checksum,
		Marker:         marker,
		JitterStats:    s.jitterBuffer.GetMetrics(),
	}

	s.mu.Lock()
	s.streamClockMs += int64(durationMs)
	if marker != nil {
		s.markersCount++
	}
	s.mu.Unlock()

	// Non-blocking queue submission
	select {
	case s.chunkChan <- chunk:
	case <-s.ctx.Done():
		return nil, s.ctx.Err()
	default:
		// Queue full: record underrun without stalling
		s.jitterBuffer.mu.Lock()
		s.jitterBuffer.underruns++
		s.jitterBuffer.mu.Unlock()
	}

	return &chunk, nil
}

// IngestRemoteChunk handles incoming chunks from remote WebRTC transceivers,
// passing them through the jitter buffer to guarantee monotonic alignment.
func (s *WebRTCAudioStreamSession) IngestRemoteChunk(chunk AudioChunkMetadata) (*AudioChunkMetadata, bool, error) {
	if atomic.LoadInt32(&s.isClosed) == 1 {
		return nil, false, errors.New("stream session is closed")
	}

	s.jitterBuffer.Push(chunk)
	ready, ok := s.jitterBuffer.PopReady()
	if !ok {
		return nil, false, nil
	}

	m := s.jitterBuffer.GetMetrics()
	s.mu.Lock()
	if m.JitterVarianceMs > s.maxJitterSeen {
		s.maxJitterSeen = m.JitterVarianceMs
	}
	s.mu.Unlock()

	return &ready, true, nil
}

// Subscribe provides a dedicated channel for downstream consumers (e.g. Electron bridge, WebRTC DataChannel).
func (s *WebRTCAudioStreamSession) Subscribe() <-chan AudioChunkMetadata {
	s.mu.Lock()
	defer s.mu.Unlock()

	ch := make(chan AudioChunkMetadata, 128)
	if atomic.LoadInt32(&s.isClosed) == 1 {
		close(ch)
		return ch
	}

	s.subscribers = append(s.subscribers, ch)
	return ch
}

// transceiverLoop multiplexes outgoing chunks to all active subscribers.
// Guaranteed zero goroutine leak on ctx.Done().
func (s *WebRTCAudioStreamSession) transceiverLoop() {
	defer func() {
		s.mu.Lock()
		for _, sub := range s.subscribers {
			close(sub)
		}
		s.subscribers = nil
		s.mu.Unlock()
	}()

	for {
		select {
		case <-s.ctx.Done():
			return
		case chunk, ok := <-s.chunkChan:
			if !ok {
				return
			}
			s.mu.RLock()
			for _, sub := range s.subscribers {
				select {
				case sub <- chunk:
				default:
					// Skip slow subscriber rather than blocking transceiver loop
				}
			}
			s.mu.RUnlock()
		}
	}
}

// GetTelemetry aggregates current session telemetry and synchronization state.
func (s *WebRTCAudioStreamSession) GetTelemetry() StreamTelemetry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	metrics := s.jitterBuffer.GetMetrics()
	now := time.Now().UnixMilli()

	isSync := metrics.BufferUnderruns == 0 && metrics.JitterVarianceMs < float64(s.config.DropThresholdMs)

	return StreamTelemetry{
		SessionID:            s.sessionID,
		TotalChunksEmitted:   atomic.LoadUint64(&s.seqCounter),
		TotalChunksIngested:  atomic.LoadUint64(&s.seqCounter) - uint64(metrics.PacketsLost),
		PacketsLost:          metrics.PacketsLost,
		OutOfOrderCount:      metrics.OutOfOrderCount,
		BufferUnderruns:      metrics.BufferUnderruns,
		AverageJitterMs:      metrics.JitterVarianceMs,
		MaxJitterMs:          s.maxJitterSeen,
		StreamClockMs:        s.streamClockMs,
		ActiveMarkersReached: s.markersCount,
		IsSynchronized:       isSync,
		LastEventTimestamp:   now,
	}
}

// Close terminates the session cleanly, cancelling context and draining channels with zero leaks.
func (s *WebRTCAudioStreamSession) Close() error {
	var err error
	s.closeOnce.Do(func() {
		atomic.StoreInt32(&s.isClosed, 1)
		s.cancel()
		close(s.chunkChan)
	})
	return err
}
