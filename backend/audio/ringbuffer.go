// Package state provides ultra-low-latency, zero-serialization shared memory ring buffer
// primitives and lock-free circular queue management for real-time audio pipeline IPC.
package state

import (
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"sync/atomic"
	"time"
	"unsafe"
)

// Structural constants matching src/shared/constants.js
const (
	MagicBytes         uint32 = 0x454C5141 // "ELQA"
	ProtocolVersion    uint16 = 1
	DefaultHeaderSize  uint16 = 128
	DefaultSlotCount   uint32 = 256
	DefaultSlotSize    uint32 = 4096
	SlotHeaderSize     uint32 = 32
	MaxPayloadSize     uint32 = DefaultSlotSize - SlotHeaderSize // 4064 bytes
	TotalSegmentSize   int    = int(DefaultHeaderSize) + int(DefaultSlotCount*DefaultSlotSize) // 1,048,704 bytes
)

// Header byte offsets
const (
	OffsetMagic           = 0
	OffsetVersion         = 4
	OffsetHeaderSize      = 6
	OffsetWriteIndex      = 8
	OffsetReadIndex       = 16
	OffsetSlotCount       = 24
	OffsetSlotSize        = 28
	OffsetUnderrunCount   = 32
	OffsetOverrunCount    = 40
	OffsetPIDWriter       = 48
	OffsetPIDReader       = 52
	OffsetLastHeartbeatNs = 56
	OffsetStateFlags      = 64
	OffsetSampleRate      = 68
	OffsetChannels        = 72
)

// Slot header byte offsets (relative to slot start)
const (
	SlotOffsetFrameID     = 0
	SlotOffsetTimestampNs = 8
	SlotOffsetPayloadSize = 16
	SlotOffsetChannels    = 20
	SlotOffsetSampleRate  = 22
	SlotOffsetFlags       = 26
	SlotOffsetPayload     = 32
)

// Protocol state flags
const (
	StateFlagUninitialized   uint32 = 0x00
	StateFlagInitialized     uint32 = 0x01
	StateFlagProducerActive  uint32 = 0x02
	StateFlagConsumerActive  uint32 = 0x04
	StateFlagShutdown        uint32 = 0x08
	StateFlagOverrunDetected uint32 = 0x10
	StateFlagUnderrunDetected uint32 = 0x20
)

// Frame flags
const (
	FrameFlagPCM16LE      uint16 = 0x01
	FrameFlagSpeechActive uint16 = 0x02
	FrameFlagEndOfStream  uint16 = 0x04
	FrameFlagTelemetry    uint16 = 0x08
)

// Errors
var (
	ErrBufferEmpty        = errors.New("audio ring buffer empty (underrun)")
	ErrBufferFull         = errors.New("audio ring buffer full (overrun)")
	ErrPayloadTooLarge    = errors.New("audio payload exceeds maximum slot capacity")
	ErrCorruptSegment     = errors.New("shared memory segment header corrupt or invalid magic")
	ErrSegmentTooSmall    = errors.New("shared memory segment size is smaller than expected")
	ErrBufferShutdown     = errors.New("audio ring buffer is shut down")
	ErrOutOfBoundsPointer = errors.New("pointer bounds check failed during memory access")
)

// AudioRingFrame represents a single discrete audio chunk in the ring buffer.
type AudioRingFrame struct {
	FrameID     uint64 `json:"frameId"`
	TimestampNs int64  `json:"timestampNs"`
	SampleRate  uint32 `json:"sampleRate"`
	Channels    uint16 `json:"channels"`
	Flags       uint16 `json:"flags"`
	Data        []byte `json:"data"`
}

// RingBufferMetrics provides real-time telemetry on the shared memory queue.
type RingBufferMetrics struct {
	WriteIndex      uint64  `json:"writeIndex"`
	ReadIndex       uint64  `json:"readIndex"`
	QueueDepth      uint64  `json:"queueDepth"`
	SlotCapacity    uint32  `json:"slotCapacity"`
	FillPercent     float64 `json:"fillPercent"`
	UnderrunCount   uint64  `json:"underrunCount"`
	OverrunCount    uint64  `json:"overrunCount"`
	WriterPID       uint32  `json:"writerPid"`
	ReaderPID       uint32  `json:"readerPid"`
	LastHeartbeatNs int64   `json:"lastHeartbeatNs"`
	IsWriterAlive   bool    `json:"isWriterAlive"`
	StateFlags      uint32  `json:"stateFlags"`
	EstimatedLagMs  float64 `json:"estimatedLagMs"`
}

// MemorySegment abstracts cross-platform memory-mapped regions.
type MemorySegment interface {
	Bytes() []byte
	Sync() error
	Close() error
}

// SharedRingBuffer coordinates lock-free, zero-copy inter-process audio streaming.
type SharedRingBuffer struct {
	segment    MemorySegment
	data       []byte
	slotCount  uint32
	slotSize   uint32
	mask       uint64
	headerSize uint32
	pid        uint32
}

// NewSharedRingBuffer attaches to or initializes a shared memory segment.
func NewSharedRingBuffer(segment MemorySegment, isCreator bool) (*SharedRingBuffer, error) {
	if segment == nil {
		return nil, errors.New("memory segment cannot be nil")
	}

	data := segment.Bytes()
	if len(data) < TotalSegmentSize {
		return nil, fmt.Errorf("%w: got %d, expected at least %d", ErrSegmentTooSmall, len(data), TotalSegmentSize)
	}

	rb := &SharedRingBuffer{
		segment:    segment,
		data:       data,
		slotCount:  DefaultSlotCount,
		slotSize:   DefaultSlotSize,
		mask:       uint64(DefaultSlotCount - 1),
		headerSize: uint32(DefaultHeaderSize),
		pid:        uint32(os.Getpid()),
	}

	if isCreator {
		rb.initializeHeader()
	} else {
		if err := rb.validateHeader(); err != nil {
			return nil, err
		}
	}

	return rb, nil
}

func (rb *SharedRingBuffer) atomicUint64Ptr(offset int) *uint64 {
	if offset < 0 || offset+8 > len(rb.data) {
		panic(fmt.Sprintf("internal fatal: out of bounds buffer offset %d", offset))
	}
	return (*uint64)(unsafe.Pointer(&rb.data[offset]))
}

func (rb *SharedRingBuffer) atomicInt64Ptr(offset int) *int64 {
	if offset < 0 || offset+8 > len(rb.data) {
		panic(fmt.Sprintf("internal fatal: out of bounds buffer offset %d", offset))
	}
	return (*int64)(unsafe.Pointer(&rb.data[offset]))
}

func (rb *SharedRingBuffer) atomicUint32Ptr(offset int) *uint32 {
	if offset < 0 || offset+4 > len(rb.data) {
		panic(fmt.Sprintf("internal fatal: out of bounds buffer offset %d", offset))
	}
	return (*uint32)(unsafe.Pointer(&rb.data[offset]))
}

// initializeHeader sets up the 128-byte global control header with safe defaults.
func (rb *SharedRingBuffer) initializeHeader() {
	binary.LittleEndian.PutUint32(rb.data[OffsetMagic:], MagicBytes)
	binary.LittleEndian.PutUint16(rb.data[OffsetVersion:], ProtocolVersion)
	binary.LittleEndian.PutUint16(rb.data[OffsetHeaderSize:], DefaultHeaderSize)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetWriteIndex), 0)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetReadIndex), 0)
	binary.LittleEndian.PutUint32(rb.data[OffsetSlotCount:], rb.slotCount)
	binary.LittleEndian.PutUint32(rb.data[OffsetSlotSize:], rb.slotSize)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetUnderrunCount), 0)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetOverrunCount), 0)
	atomic.StoreUint32(rb.atomicUint32Ptr(OffsetPIDWriter), rb.pid)
	atomic.StoreInt64(rb.atomicInt64Ptr(OffsetLastHeartbeatNs), time.Now().UnixNano())
	atomic.StoreUint32(rb.atomicUint32Ptr(OffsetStateFlags), StateFlagInitialized|StateFlagProducerActive)
	binary.LittleEndian.PutUint32(rb.data[OffsetSampleRate:], 48000)
	binary.LittleEndian.PutUint16(rb.data[OffsetChannels:], 1)
}

// validateHeader verifies the integrity of the memory segment header.
func (rb *SharedRingBuffer) validateHeader() error {
	magic := binary.LittleEndian.Uint32(rb.data[OffsetMagic:])
	if magic != MagicBytes {
		return fmt.Errorf("%w: expected 0x%X, got 0x%X", ErrCorruptSegment, MagicBytes, magic)
	}

	version := binary.LittleEndian.Uint16(rb.data[OffsetVersion:])
	if version != ProtocolVersion {
		return fmt.Errorf("unsupported ring buffer protocol version: %d", version)
	}

	slotCount := binary.LittleEndian.Uint32(rb.data[OffsetSlotCount:])
	if slotCount == 0 || (slotCount&(slotCount-1)) != 0 {
		return fmt.Errorf("invalid slot count (must be power of two): %d", slotCount)
	}

	rb.slotCount = slotCount
	rb.slotSize = binary.LittleEndian.Uint32(rb.data[OffsetSlotSize:])
	rb.mask = uint64(slotCount - 1)
	rb.headerSize = uint32(binary.LittleEndian.Uint16(rb.data[OffsetHeaderSize:]))

	return nil
}

// WriteFrame pushes an audio frame into the shared circular queue without JSON serialization.
func (rb *SharedRingBuffer) WriteFrame(frame *AudioRingFrame) error {
	if frame == nil {
		return errors.New("audio frame cannot be nil")
	}

	payloadLen := len(frame.Data)
	if payloadLen > int(MaxPayloadSize) {
		return fmt.Errorf("%w: got %d bytes, max allowed is %d", ErrPayloadTooLarge, payloadLen, MaxPayloadSize)
	}

	flags := atomic.LoadUint32(rb.atomicUint32Ptr(OffsetStateFlags))
	if flags&StateFlagShutdown != 0 {
		return ErrBufferShutdown
	}

	writeIdx := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetWriteIndex))
	readIdx := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetReadIndex))

	// Backpressure: Full queue check
	if writeIdx-readIdx >= uint64(rb.slotCount) {
		atomic.AddUint64(rb.atomicUint64Ptr(OffsetOverrunCount), 1)
		atomic.OrUint32(rb.atomicUint32Ptr(OffsetStateFlags), StateFlagOverrunDetected)
		return ErrBufferFull
	}

	// Calculate deterministic slot offset: Header + (Index & Mask) * SlotSize
	slotIdx := writeIdx & rb.mask
	slotOffset := int(rb.headerSize) + int(slotIdx*uint64(rb.slotSize))

	// Strict bounds check on segment boundary
	if slotOffset+int(rb.slotSize) > len(rb.data) {
		return ErrOutOfBoundsPointer
	}

	// Write slot header directly
	slotData := rb.data[slotOffset : slotOffset+int(rb.slotSize)]
	binary.LittleEndian.PutUint64(slotData[SlotOffsetFrameID:], frame.FrameID)
	binary.LittleEndian.PutUint64(slotData[SlotOffsetTimestampNs:], uint64(frame.TimestampNs))
	binary.LittleEndian.PutUint32(slotData[SlotOffsetPayloadSize:], uint32(payloadLen))
	binary.LittleEndian.PutUint16(slotData[SlotOffsetChannels:], frame.Channels)
	binary.LittleEndian.PutUint32(slotData[SlotOffsetSampleRate:], frame.SampleRate)
	binary.LittleEndian.PutUint16(slotData[SlotOffsetFlags:], frame.Flags)

	// Copy raw PCM byte payload (zero-copy memory pass-through)
	copy(slotData[SlotOffsetPayload:], frame.Data)

	// Update writer PID and heartbeat
	atomic.StoreUint32(rb.atomicUint32Ptr(OffsetPIDWriter), rb.pid)
	atomic.StoreInt64(rb.atomicInt64Ptr(OffsetLastHeartbeatNs), time.Now().UnixNano())

	// Memory barrier / Publish write cursor atomically
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetWriteIndex), writeIdx+1)

	return nil
}

// ReadFrame pops the next sequential audio frame from the ring buffer.
func (rb *SharedRingBuffer) ReadFrame() (*AudioRingFrame, error) {
	flags := atomic.LoadUint32(rb.atomicUint32Ptr(OffsetStateFlags))
	if flags&StateFlagShutdown != 0 {
		return nil, ErrBufferShutdown
	}

	writeIdx := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetWriteIndex))
	readIdx := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetReadIndex))

	// Underrun check
	if writeIdx == readIdx {
		atomic.AddUint64(rb.atomicUint64Ptr(OffsetUnderrunCount), 1)
		atomic.OrUint32(rb.atomicUint32Ptr(OffsetStateFlags), StateFlagUnderrunDetected)
		return nil, ErrBufferEmpty
	}

	// Calculate deterministic slot offset
	slotIdx := readIdx & rb.mask
	slotOffset := int(rb.headerSize) + int(slotIdx*uint64(rb.slotSize))

	if slotOffset+int(rb.slotSize) > len(rb.data) {
		return nil, ErrOutOfBoundsPointer
	}

	slotData := rb.data[slotOffset : slotOffset+int(rb.slotSize)]
	frameID := binary.LittleEndian.Uint64(slotData[SlotOffsetFrameID:])
	timestampNs := int64(binary.LittleEndian.Uint64(slotData[SlotOffsetTimestampNs:]))
	payloadSize := binary.LittleEndian.Uint32(slotData[SlotOffsetPayloadSize:])
	channels := binary.LittleEndian.Uint16(slotData[SlotOffsetChannels:])
	sampleRate := binary.LittleEndian.Uint32(slotData[SlotOffsetSampleRate:])
	frameFlags := binary.LittleEndian.Uint16(slotData[SlotOffsetFlags:])

	if payloadSize > MaxPayloadSize {
		return nil, fmt.Errorf("%w: slot payload size %d exceeds max %d", ErrCorruptSegment, payloadSize, MaxPayloadSize)
	}

	// Safe copy of audio payload to caller slice
	payload := make([]byte, payloadSize)
	copy(payload, slotData[SlotOffsetPayload:SlotOffsetPayload+payloadSize])

	// Update reader PID and commit read cursor atomically
	atomic.StoreUint32(rb.atomicUint32Ptr(OffsetPIDReader), rb.pid)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetReadIndex), readIdx+1)

	return &AudioRingFrame{
		FrameID:     frameID,
		TimestampNs: timestampNs,
		SampleRate:  sampleRate,
		Channels:    channels,
		Flags:       frameFlags,
		Data:        payload,
	}, nil
}

// GetMetrics returns a real-time snapshot of ring buffer telemetry.
func (rb *SharedRingBuffer) GetMetrics() RingBufferMetrics {
	writeIdx := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetWriteIndex))
	readIdx := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetReadIndex))
	underruns := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetUnderrunCount))
	overruns := atomic.LoadUint64(rb.atomicUint64Ptr(OffsetOverrunCount))
	writerPID := atomic.LoadUint32(rb.atomicUint32Ptr(OffsetPIDWriter))
	readerPID := atomic.LoadUint32(rb.atomicUint32Ptr(OffsetPIDReader))
	lastHeartbeat := atomic.LoadInt64(rb.atomicInt64Ptr(OffsetLastHeartbeatNs))
	stateFlags := atomic.LoadUint32(rb.atomicUint32Ptr(OffsetStateFlags))

	depth := uint64(0)
	if writeIdx >= readIdx {
		depth = writeIdx - readIdx
	}

	fillPercent := 0.0
	if rb.slotCount > 0 {
		fillPercent = (float64(depth) / float64(rb.slotCount)) * 100.0
	}

	now := time.Now().UnixNano()
	isAlive := (now - lastHeartbeat) < (5 * int64(time.Second))

	// Approximate 20ms per frame
	estimatedLagMs := float64(depth) * 20.0

	return RingBufferMetrics{
		WriteIndex:      writeIdx,
		ReadIndex:       readIdx,
		QueueDepth:      depth,
		SlotCapacity:    rb.slotCount,
		FillPercent:     fillPercent,
		UnderrunCount:   underruns,
		OverrunCount:    overruns,
		WriterPID:       writerPID,
		ReaderPID:       readerPID,
		LastHeartbeatNs: lastHeartbeat,
		IsWriterAlive:   isAlive,
		StateFlags:      stateFlags,
		EstimatedLagMs:  estimatedLagMs,
	}
}

// Reset resets read and write indices to zero.
func (rb *SharedRingBuffer) Reset() {
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetWriteIndex), 0)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetReadIndex), 0)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetUnderrunCount), 0)
	atomic.StoreUint64(rb.atomicUint64Ptr(OffsetOverrunCount), 0)
	atomic.StoreInt64(rb.atomicInt64Ptr(OffsetLastHeartbeatNs), time.Now().UnixNano())
}

// RecoverStaleState inspects whether a crashed producer orphaned the buffer and safely resets it.
func (rb *SharedRingBuffer) RecoverStaleState(maxStaleNs int64) bool {
	if maxStaleNs <= 0 {
		maxStaleNs = 5 * int64(time.Second)
	}

	lastHb := atomic.LoadInt64(rb.atomicInt64Ptr(OffsetLastHeartbeatNs))
	elapsed := time.Now().UnixNano() - lastHb

	if elapsed > maxStaleNs {
		// Stale condition met, reset buffer
		rb.Reset()
		return true
	}
	return false
}

// UpdateHeartbeat updates the writer timestamp to declare active health.
func (rb *SharedRingBuffer) UpdateHeartbeat() {
	atomic.StoreInt64(rb.atomicInt64Ptr(OffsetLastHeartbeatNs), time.Now().UnixNano())
}

// Close gracefully sets the shutdown flag and unmaps the memory segment.
func (rb *SharedRingBuffer) Close() error {
	atomic.OrUint32(rb.atomicUint32Ptr(OffsetStateFlags), StateFlagShutdown)
	if rb.segment != nil {
		return rb.segment.Close()
	}
	return nil
}
