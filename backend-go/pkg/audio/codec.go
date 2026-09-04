// Package audio provides codecs for zero-copy and standard audio framing across IPC.
package audio

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"
)

// Common codec error definitions
var (
	ErrNilFrame          = errors.New("cannot encode nil audio frame")
	ErrEmptyPayload      = errors.New("audio payload is empty")
	ErrCorruptedHeader   = errors.New("corrupted or malformed audio header")
	ErrUnsupportedFormat = errors.New("unsupported audio codec format")
	ErrBufferTooShort    = errors.New("buffer is shorter than header size")
	ErrInvalidSampleRate = errors.New("invalid sample rate in header")
	ErrInvalidChannels   = errors.New("invalid channel count in header")
)

// AudioCodec defines the interface for encoding and decoding audio frames.
type AudioCodec interface {
	// Encode serializes an AudioFrame into a byte buffer.
	Encode(frame *AudioFrame) ([]byte, error)
	// Decode parses raw bytes into an AudioFrame.
	Decode(data []byte) (*AudioFrame, error)
	// Format returns the canonical codec format name.
	Format() string
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PCM16 Codec (Linear Little-Endian 16-bit PCM)
// ─────────────────────────────────────────────────────────────────────────────

// PCM16Codec implements raw 16-bit linear PCM serialization.
type PCM16Codec struct {
	DefaultSampleRate uint32
	DefaultChannels   uint16
}

// NewPCM16Codec creates a PCM16Codec with default sample rate and channels.
func NewPCM16Codec(sampleRate uint32, channels uint16) *PCM16Codec {
	if sampleRate == 0 {
		sampleRate = 48000
	}
	if channels == 0 {
		channels = 1
	}
	return &PCM16Codec{
		DefaultSampleRate: sampleRate,
		DefaultChannels:   channels,
	}
}

// Format returns "pcm16".
func (c *PCM16Codec) Format() string {
	return "pcm16"
}

// Encode returns the raw PCM byte payload of the frame.
func (c *PCM16Codec) Encode(frame *AudioFrame) ([]byte, error) {
	if frame == nil {
		return nil, ErrNilFrame
	}
	if len(frame.Data) == 0 {
		return nil, ErrEmptyPayload
	}
	// Return a copy to ensure immutability
	out := make([]byte, len(frame.Data))
	copy(out, frame.Data)
	return out, nil
}

// Decode wraps raw PCM 16-bit bytes into an AudioFrame and calculates RMS and peak.
func (c *PCM16Codec) Decode(data []byte) (*AudioFrame, error) {
	if len(data) == 0 {
		return nil, ErrEmptyPayload
	}
	if len(data)%2 != 0 {
		return nil, ErrCorruptedHeader
	}

	frame := &AudioFrame{
		TimestampNs: time.Now().UnixNano(),
		SampleRate:  c.DefaultSampleRate,
		Channels:    c.DefaultChannels,
		Data:        make([]byte, len(data)),
		ProcessedAt: time.Now(),
	}
	copy(frame.Data, data)

	// Compute RMS and peak
	numSamples := len(data) / 2
	var sumSquares float64
	var peak int16
	for i := 0; i < len(data)-1; i += 2 {
		val := int16(binary.LittleEndian.Uint16(data[i : i+2]))
		absVal := val
		if absVal < 0 {
			absVal = -absVal
		}
		if absVal > peak {
			peak = absVal
		}
		norm := float64(val) / 32768.0
		sumSquares += norm * norm
	}

	if numSamples > 0 {
		frame.RMS = math.Sqrt(sumSquares / float64(numSamples))
	}
	frame.Peak = peak
	frame.IsSpeech = frame.RMS >= 0.0028 || peak >= 700

	return frame, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. WAV Codec (Standard RIFF/WAVE Framing)
// ─────────────────────────────────────────────────────────────────────────────

const wavHeaderSize = 44

// WAVCodec encodes and decodes canonical 44-byte RIFF/WAVE formatted audio.
type WAVCodec struct{}

// NewWAVCodec creates a new WAVCodec instance.
func NewWAVCodec() *WAVCodec {
	return &WAVCodec{}
}

// Format returns "wav".
func (c *WAVCodec) Format() string {
	return "wav"
}

// Encode serializes an AudioFrame with a standard 44-byte RIFF/WAVE header.
func (c *WAVCodec) Encode(frame *AudioFrame) ([]byte, error) {
	if frame == nil {
		return nil, ErrNilFrame
	}
	if len(frame.Data) == 0 {
		return nil, ErrEmptyPayload
	}

	sr := frame.SampleRate
	if sr == 0 {
		sr = 48000
	}
	ch := frame.Channels
	if ch == 0 {
		ch = 1
	}

	dataLen := len(frame.Data)
	totalLen := wavHeaderSize + dataLen
	out := make([]byte, totalLen)

	// RIFF chunk descriptor
	copy(out[0:4], "RIFF")
	binary.LittleEndian.PutUint32(out[4:8], uint32(totalLen-8))
	copy(out[8:12], "WAVE")

	// "fmt " sub-chunk
	copy(out[12:16], "fmt ")
	binary.LittleEndian.PutUint32(out[16:20], 16) // Subchunk1Size = 16 for PCM
	binary.LittleEndian.PutUint16(out[20:22], 1)  // AudioFormat = 1 (PCM)
	binary.LittleEndian.PutUint16(out[22:24], ch)
	binary.LittleEndian.PutUint32(out[24:28], sr)
	byteRate := sr * uint32(ch) * 2
	binary.LittleEndian.PutUint32(out[28:32], byteRate)
	blockAlign := ch * 2
	binary.LittleEndian.PutUint16(out[32:34], blockAlign)
	binary.LittleEndian.PutUint16(out[34:36], 16) // 16 bits per sample

	// "data" sub-chunk
	copy(out[36:40], "data")
	binary.LittleEndian.PutUint32(out[40:44], uint32(dataLen))

	// Payload
	copy(out[44:], frame.Data)
	return out, nil
}

// Decode extracts PCM audio data and metadata from a 44-byte RIFF/WAVE buffer.
func (c *WAVCodec) Decode(data []byte) (*AudioFrame, error) {
	if len(data) < wavHeaderSize {
		return nil, ErrBufferTooShort
	}

	if string(data[0:4]) != "RIFF" || string(data[8:12]) != "WAVE" {
		return nil, ErrCorruptedHeader
	}
	if string(data[12:16]) != "fmt " {
		return nil, ErrCorruptedHeader
	}

	channels := binary.LittleEndian.Uint16(data[22:24])
	sampleRate := binary.LittleEndian.Uint32(data[24:28])
	bitsPerSample := binary.LittleEndian.Uint16(data[34:36])

	if channels == 0 {
		return nil, ErrInvalidChannels
	}
	if sampleRate == 0 {
		return nil, ErrInvalidSampleRate
	}
	if bitsPerSample != 16 {
		return nil, fmt.Errorf("%w: only 16-bit PCM supported, got %d", ErrUnsupportedFormat, bitsPerSample)
	}

	// Locate "data" chunk
	dataOffset := 36
	for dataOffset+8 <= len(data) {
		if string(data[dataOffset:dataOffset+4]) == "data" {
			break
		}
		chunkSize := int(binary.LittleEndian.Uint32(data[dataOffset+4 : dataOffset+8]))
		dataOffset += 8 + chunkSize
	}

	if dataOffset+8 > len(data) || string(data[dataOffset:dataOffset+4]) != "data" {
		return nil, ErrCorruptedHeader
	}

	payloadLen := int(binary.LittleEndian.Uint32(data[dataOffset+4 : dataOffset+8]))
	payloadStart := dataOffset + 8
	if payloadStart+payloadLen > len(data) {
		payloadLen = len(data) - payloadStart
	}

	pcmData := make([]byte, payloadLen)
	copy(pcmData, data[payloadStart:payloadStart+payloadLen])

	frame := &AudioFrame{
		TimestampNs: time.Now().UnixNano(),
		SampleRate:  sampleRate,
		Channels:    channels,
		Data:        pcmData,
		ProcessedAt: time.Now(),
	}

	// Calculate RMS and Peak
	numSamples := payloadLen / 2
	var sumSquares float64
	var peak int16
	for i := 0; i < payloadLen-1; i += 2 {
		val := int16(binary.LittleEndian.Uint16(pcmData[i : i+2]))
		absVal := val
		if absVal < 0 {
			absVal = -absVal
		}
		if absVal > peak {
			peak = absVal
		}
		norm := float64(val) / 32768.0
		sumSquares += norm * norm
	}

	if numSamples > 0 {
		frame.RMS = math.Sqrt(sumSquares / float64(numSamples))
	}
	frame.Peak = peak
	frame.IsSpeech = frame.RMS >= 0.0028 || peak >= 700

	return frame, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BinaryFrameCodec (ELQ1 Zero-Copy Protocol)
// ─────────────────────────────────────────────────────────────────────────────

const (
	// ELQ1Magic defines the 4-byte signature: 'E', 'L', 'Q', '1' (0x31514C45 little-endian)
	ELQ1Magic uint32 = 0x31514C45

	// BinaryHeaderSize is the fixed 32-byte header size
	BinaryHeaderSize = 32

	// FlagSpeech indicates VAD detected active voice in the frame
	FlagSpeech uint8 = 0x01
)

// BinaryFrameCodec implements the high-speed ELQ1 binary framing protocol.
//
// 32-byte Header Layout:
//
//	[0..3]   Magic "ELQ1" (0x31514C45)
//	[4..11]  Frame ID (uint64)
//	[12..19] Presentation Timestamp PTS in Ns (int64)
//	[20..23] Sample Rate (uint32)
//	[24..25] Channels (uint16)
//	[26..27] Peak Amplitude (int16)
//	[28]     Flags (uint8, bit 0: Speech)
//	[29..31] Payload Length (uint24 little-endian, up to 16MB)
type BinaryFrameCodec struct{}

// NewBinaryFrameCodec creates an instance of BinaryFrameCodec.
func NewBinaryFrameCodec() *BinaryFrameCodec {
	return &BinaryFrameCodec{}
}

// Format returns "elq1".
func (c *BinaryFrameCodec) Format() string {
	return "elq1"
}

// Encode serializes an AudioFrame into the ELQ1 binary format with 32-byte header.
func (c *BinaryFrameCodec) Encode(frame *AudioFrame) ([]byte, error) {
	if frame == nil {
		return nil, ErrNilFrame
	}
	payloadLen := len(frame.Data)
	if payloadLen == 0 {
		return nil, ErrEmptyPayload
	}
	if payloadLen > 0x00FFFFFF {
		return nil, fmt.Errorf("payload exceeds 16MB max limit: %d", payloadLen)
	}

	totalLen := BinaryHeaderSize + payloadLen
	buf := make([]byte, totalLen)

	// Magic: "ELQ1"
	binary.LittleEndian.PutUint32(buf[0:4], ELQ1Magic)
	// ID
	binary.LittleEndian.PutUint64(buf[4:12], frame.ID)
	// TimestampNs
	binary.LittleEndian.PutUint64(buf[12:20], uint64(frame.TimestampNs))
	// SampleRate
	binary.LittleEndian.PutUint32(buf[20:24], frame.SampleRate)
	// Channels
	binary.LittleEndian.PutUint16(buf[24:26], frame.Channels)
	// Peak
	binary.LittleEndian.PutUint16(buf[26:28], uint16(frame.Peak))

	// Flags
	var flags uint8
	if frame.IsSpeech {
		flags |= FlagSpeech
	}
	buf[28] = flags

	// Payload Length (24-bit little endian in bytes 29..31)
	buf[29] = byte(payloadLen)
	buf[30] = byte(payloadLen >> 8)
	buf[31] = byte(payloadLen >> 16)

	// Copy audio PCM data
	copy(buf[BinaryHeaderSize:], frame.Data)
	return buf, nil
}

// Decode deserializes an ELQ1 binary frame.
func (c *BinaryFrameCodec) Decode(data []byte) (*AudioFrame, error) {
	if len(data) < BinaryHeaderSize {
		return nil, ErrBufferTooShort
	}

	magic := binary.LittleEndian.Uint32(data[0:4])
	if magic != ELQ1Magic {
		return nil, ErrCorruptedHeader
	}

	id := binary.LittleEndian.Uint64(data[4:12])
	pts := int64(binary.LittleEndian.Uint64(data[12:20]))
	sampleRate := binary.LittleEndian.Uint32(data[20:24])
	channels := binary.LittleEndian.Uint16(data[24:26])
	peak := int16(binary.LittleEndian.Uint16(data[26:28]))
	flags := data[28]

	payloadLen := int(data[29]) | (int(data[30]) << 8) | (int(data[31]) << 16)
	if sampleRate == 0 {
		return nil, ErrInvalidSampleRate
	}
	if channels == 0 {
		return nil, ErrInvalidChannels
	}

	if len(data) < BinaryHeaderSize+payloadLen {
		return nil, ErrBufferTooShort
	}

	pcmData := make([]byte, payloadLen)
	copy(pcmData, data[BinaryHeaderSize:BinaryHeaderSize+payloadLen])

	numSamples := payloadLen / 2
	var sumSquares float64
	for i := 0; i < payloadLen-1; i += 2 {
		val := int16(binary.LittleEndian.Uint16(pcmData[i : i+2]))
		norm := float64(val) / 32768.0
		sumSquares += norm * norm
	}

	rms := 0.0
	if numSamples > 0 {
		rms = math.Sqrt(sumSquares / float64(numSamples))
	}

	return &AudioFrame{
		ID:          id,
		TimestampNs: pts,
		SampleRate:  sampleRate,
		Channels:    channels,
		Data:        pcmData,
		RMS:         rms,
		Peak:        peak,
		IsSpeech:    (flags & FlagSpeech) != 0,
		ProcessedAt: time.Now(),
	}, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Codec Registry
// ─────────────────────────────────────────────────────────────────────────────

// CodecRegistry provides thread-safe dynamic codec lookup and negotiation.
type CodecRegistry struct {
	mu     sync.RWMutex
	codecs map[string]AudioCodec
}

// NewCodecRegistry creates an empty CodecRegistry.
func NewCodecRegistry() *CodecRegistry {
	return &CodecRegistry{
		codecs: make(map[string]AudioCodec),
	}
}

// Register adds or replaces a codec in the registry.
func (r *CodecRegistry) Register(codec AudioCodec) {
	if codec == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.codecs[strings.ToLower(codec.Format())] = codec
}

// Get retrieves a codec by format name (case-insensitive).
func (r *CodecRegistry) Get(format string) (AudioCodec, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	codec, ok := r.codecs[strings.ToLower(format)]
	return codec, ok
}

// Formats returns a list of all registered format names.
func (r *CodecRegistry) Formats() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	formats := make([]string, 0, len(r.codecs))
	for f := range r.codecs {
		formats = append(formats, f)
	}
	return formats
}

// DefaultCodecRegistry initializes a registry populated with PCM16, WAV, and ELQ1 codecs.
func DefaultCodecRegistry() *CodecRegistry {
	r := NewCodecRegistry()
	r.Register(NewPCM16Codec(48000, 1))
	r.Register(NewWAVCodec())
	r.Register(NewBinaryFrameCodec())
	return r
}
