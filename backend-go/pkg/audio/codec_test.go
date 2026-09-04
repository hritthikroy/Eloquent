package audio

import (
	"encoding/binary"
	"math"
	"sync"
	"testing"
	"time"
)

func TestPCM16Codec_RoundTrip(t *testing.T) {
	codec := NewPCM16Codec(48000, 1)
	if codec.Format() != "pcm16" {
		t.Fatalf("expected format pcm16, got %s", codec.Format())
	}

	// 1. Valid frame
	pcmData := make([]byte, 1920)
	for i := 0; i < len(pcmData)-1; i += 2 {
		val := int16(1000 * math.Sin(float64(i)))
		binary.LittleEndian.PutUint16(pcmData[i:i+2], uint16(val))
	}

	frame := &AudioFrame{
		ID:          42,
		TimestampNs: time.Now().UnixNano(),
		SampleRate:  48000,
		Channels:    1,
		Data:        pcmData,
	}

	encoded, err := codec.Encode(frame)
	if err != nil {
		t.Fatalf("unexpected encode error: %v", err)
	}
	if len(encoded) != len(pcmData) {
		t.Fatalf("expected encoded len %d, got %d", len(pcmData), len(encoded))
	}

	decoded, err := codec.Decode(encoded)
	if err != nil {
		t.Fatalf("unexpected decode error: %v", err)
	}
	if len(decoded.Data) != len(pcmData) {
		t.Fatalf("expected decoded data len %d, got %d", len(pcmData), len(decoded.Data))
	}
	if decoded.SampleRate != 48000 {
		t.Fatalf("expected sample rate 48000, got %d", decoded.SampleRate)
	}

	// 2. Error cases
	if _, err := codec.Encode(nil); err != ErrNilFrame {
		t.Fatalf("expected ErrNilFrame, got %v", err)
	}
	if _, err := codec.Encode(&AudioFrame{Data: nil}); err != ErrEmptyPayload {
		t.Fatalf("expected ErrEmptyPayload, got %v", err)
	}
	if _, err := codec.Decode(nil); err != ErrEmptyPayload {
		t.Fatalf("expected ErrEmptyPayload, got %v", err)
	}
	if _, err := codec.Decode([]byte{0x01}); err != ErrCorruptedHeader {
		t.Fatalf("expected ErrCorruptedHeader on odd bytes, got %v", err)
	}
}

func TestWAVCodec_RoundTrip(t *testing.T) {
	codec := NewWAVCodec()
	if codec.Format() != "wav" {
		t.Fatalf("expected format wav, got %s", codec.Format())
	}

	pcmData := make([]byte, 960)
	for i := 0; i < len(pcmData)-1; i += 2 {
		val := int16(i * 10)
		binary.LittleEndian.PutUint16(pcmData[i:i+2], uint16(val))
	}

	frame := &AudioFrame{
		ID:          100,
		TimestampNs: time.Now().UnixNano(),
		SampleRate:  48000,
		Channels:    1,
		Data:        pcmData,
	}

	encoded, err := codec.Encode(frame)
	if err != nil {
		t.Fatalf("WAV encode failed: %v", err)
	}
	if len(encoded) != 44+len(pcmData) {
		t.Fatalf("expected WAV size %d, got %d", 44+len(pcmData), len(encoded))
	}

	decoded, err := codec.Decode(encoded)
	if err != nil {
		t.Fatalf("WAV decode failed: %v", err)
	}
	if len(decoded.Data) != len(pcmData) {
		t.Fatalf("expected data len %d, got %d", len(pcmData), len(decoded.Data))
	}
	if decoded.SampleRate != 48000 {
		t.Fatalf("expected sample rate 48000, got %d", decoded.SampleRate)
	}
	if decoded.Channels != 1 {
		t.Fatalf("expected channels 1, got %d", decoded.Channels)
	}

	// Test default fallbacks when SampleRate/Channels are 0
	frameZero := &AudioFrame{
		Data: pcmData,
	}
	encodedZero, err := codec.Encode(frameZero)
	if err != nil {
		t.Fatalf("unexpected error with zero SR/Ch: %v", err)
	}
	decodedZero, err := codec.Decode(encodedZero)
	if err != nil {
		t.Fatalf("unexpected decode error: %v", err)
	}
	if decodedZero.SampleRate != 48000 || decodedZero.Channels != 1 {
		t.Fatalf("expected defaults 48000/1, got %d/%d", decodedZero.SampleRate, decodedZero.Channels)
	}
}

func TestWAVCodec_ErrorCases(t *testing.T) {
	codec := NewWAVCodec()

	// Encode errors
	if _, err := codec.Encode(nil); err != ErrNilFrame {
		t.Fatalf("expected ErrNilFrame, got %v", err)
	}
	if _, err := codec.Encode(&AudioFrame{Data: nil}); err != ErrEmptyPayload {
		t.Fatalf("expected ErrEmptyPayload, got %v", err)
	}

	// Decode errors
	if _, err := codec.Decode([]byte{0x00, 0x01}); err != ErrBufferTooShort {
		t.Fatalf("expected ErrBufferTooShort, got %v", err)
	}

	// Bad RIFF/WAVE header
	badHeader := make([]byte, 44)
	copy(badHeader[0:4], "NOPE")
	if _, err := codec.Decode(badHeader); err != ErrCorruptedHeader {
		t.Fatalf("expected ErrCorruptedHeader, got %v", err)
	}

	// Bad fmt sub-chunk
	badFmt := make([]byte, 44)
	copy(badFmt[0:4], "RIFF")
	copy(badFmt[8:12], "WAVE")
	copy(badFmt[12:16], "xxxx")
	if _, err := codec.Decode(badFmt); err != ErrCorruptedHeader {
		t.Fatalf("expected ErrCorruptedHeader for bad fmt, got %v", err)
	}

	// Valid header with zero channels
	zeroCh := make([]byte, 44)
	copy(zeroCh[0:4], "RIFF")
	copy(zeroCh[8:12], "WAVE")
	copy(zeroCh[12:16], "fmt ")
	binary.LittleEndian.PutUint16(zeroCh[20:22], 1)
	binary.LittleEndian.PutUint16(zeroCh[22:24], 0) // channels = 0
	binary.LittleEndian.PutUint32(zeroCh[24:28], 48000)
	binary.LittleEndian.PutUint16(zeroCh[34:36], 16)
	copy(zeroCh[36:40], "data")
	if _, err := codec.Decode(zeroCh); err != ErrInvalidChannels {
		t.Fatalf("expected ErrInvalidChannels, got %v", err)
	}

	// Valid header with zero sample rate
	zeroSr := make([]byte, 44)
	copy(zeroSr[0:4], "RIFF")
	copy(zeroSr[8:12], "WAVE")
	copy(zeroSr[12:16], "fmt ")
	binary.LittleEndian.PutUint16(zeroSr[20:22], 1)
	binary.LittleEndian.PutUint16(zeroSr[22:24], 1)
	binary.LittleEndian.PutUint32(zeroSr[24:28], 0) // sampleRate = 0
	binary.LittleEndian.PutUint16(zeroSr[34:36], 16)
	copy(zeroSr[36:40], "data")
	if _, err := codec.Decode(zeroSr); err != ErrInvalidSampleRate {
		t.Fatalf("expected ErrInvalidSampleRate, got %v", err)
	}

	// Unsupported bits per sample (e.g. 24-bit)
	badBits := make([]byte, 44)
	copy(badBits[0:4], "RIFF")
	copy(badBits[8:12], "WAVE")
	copy(badBits[12:16], "fmt ")
	binary.LittleEndian.PutUint16(badBits[20:22], 1)
	binary.LittleEndian.PutUint16(badBits[22:24], 1)
	binary.LittleEndian.PutUint32(badBits[24:28], 48000)
	binary.LittleEndian.PutUint16(badBits[34:36], 24) // 24 bits
	copy(badBits[36:40], "data")
	if _, err := codec.Decode(badBits); err == nil {
		t.Fatal("expected error for 24-bit audio, got nil")
	}

	// Missing data sub-chunk
	noData := make([]byte, 44)
	copy(noData[0:4], "RIFF")
	copy(noData[8:12], "WAVE")
	copy(noData[12:16], "fmt ")
	binary.LittleEndian.PutUint16(noData[20:22], 1)
	binary.LittleEndian.PutUint16(noData[22:24], 1)
	binary.LittleEndian.PutUint32(noData[24:28], 48000)
	binary.LittleEndian.PutUint16(noData[34:36], 16)
	copy(noData[36:40], "xxxx") // missing "data"
	if _, err := codec.Decode(noData); err != ErrCorruptedHeader {
		t.Fatalf("expected ErrCorruptedHeader for missing data chunk, got %v", err)
	}
}

func TestBinaryFrameCodec_RoundTrip(t *testing.T) {
	codec := NewBinaryFrameCodec()
	if codec.Format() != "elq1" {
		t.Fatalf("expected format elq1, got %s", codec.Format())
	}

	pcmData := make([]byte, 1920)
	for i := range pcmData {
		pcmData[i] = byte(i % 256)
	}

	frame := &AudioFrame{
		ID:          987654321,
		TimestampNs: 12345678901234,
		SampleRate:  48000,
		Channels:    2,
		Peak:        2400,
		IsSpeech:    true,
		Data:        pcmData,
	}

	encoded, err := codec.Encode(frame)
	if err != nil {
		t.Fatalf("ELQ1 encode failed: %v", err)
	}
	if len(encoded) != BinaryHeaderSize+len(pcmData) {
		t.Fatalf("expected size %d, got %d", BinaryHeaderSize+len(pcmData), len(encoded))
	}

	decoded, err := codec.Decode(encoded)
	if err != nil {
		t.Fatalf("ELQ1 decode failed: %v", err)
	}

	if decoded.ID != frame.ID {
		t.Fatalf("expected ID %d, got %d", frame.ID, decoded.ID)
	}
	if decoded.TimestampNs != frame.TimestampNs {
		t.Fatalf("expected PTS %d, got %d", frame.TimestampNs, decoded.TimestampNs)
	}
	if decoded.SampleRate != frame.SampleRate {
		t.Fatalf("expected SampleRate %d, got %d", frame.SampleRate, decoded.SampleRate)
	}
	if decoded.Channels != frame.Channels {
		t.Fatalf("expected Channels %d, got %d", frame.Channels, decoded.Channels)
	}
	if decoded.Peak != frame.Peak {
		t.Fatalf("expected Peak %d, got %d", frame.Peak, decoded.Peak)
	}
	if decoded.IsSpeech != frame.IsSpeech {
		t.Fatalf("expected IsSpeech %v, got %v", frame.IsSpeech, decoded.IsSpeech)
	}
	if len(decoded.Data) != len(pcmData) {
		t.Fatalf("expected data len %d, got %d", len(pcmData), len(decoded.Data))
	}
}

func TestBinaryFrameCodec_ErrorCases(t *testing.T) {
	codec := NewBinaryFrameCodec()

	// Encode errors
	if _, err := codec.Encode(nil); err != ErrNilFrame {
		t.Fatalf("expected ErrNilFrame, got %v", err)
	}
	if _, err := codec.Encode(&AudioFrame{Data: nil}); err != ErrEmptyPayload {
		t.Fatalf("expected ErrEmptyPayload, got %v", err)
	}

	// Too short
	if _, err := codec.Decode([]byte{0x01, 0x02}); err != ErrBufferTooShort {
		t.Fatalf("expected ErrBufferTooShort, got %v", err)
	}

	// Corrupted magic
	badBuf := make([]byte, BinaryHeaderSize+10)
	binary.LittleEndian.PutUint32(badBuf[0:4], 0xDEADBEEF)
	if _, err := codec.Decode(badBuf); err != ErrCorruptedHeader {
		t.Fatalf("expected ErrCorruptedHeader, got %v", err)
	}

	// Truncated payload
	validHeaderBuf := make([]byte, BinaryHeaderSize+5)
	binary.LittleEndian.PutUint32(validHeaderBuf[0:4], ELQ1Magic)
	binary.LittleEndian.PutUint32(validHeaderBuf[20:24], 48000)
	binary.LittleEndian.PutUint16(validHeaderBuf[24:26], 1)
	// Declare payload len = 100 but only provide 5
	validHeaderBuf[29] = 100
	if _, err := codec.Decode(validHeaderBuf); err != ErrBufferTooShort {
		t.Fatalf("expected ErrBufferTooShort for truncated payload, got %v", err)
	}

	// Invalid sample rate or channels
	zeroSrBuf := make([]byte, BinaryHeaderSize+10)
	binary.LittleEndian.PutUint32(zeroSrBuf[0:4], ELQ1Magic)
	binary.LittleEndian.PutUint32(zeroSrBuf[20:24], 0) // SR = 0
	binary.LittleEndian.PutUint16(zeroSrBuf[24:26], 1)
	if _, err := codec.Decode(zeroSrBuf); err != ErrInvalidSampleRate {
		t.Fatalf("expected ErrInvalidSampleRate, got %v", err)
	}

	zeroChBuf := make([]byte, BinaryHeaderSize+10)
	binary.LittleEndian.PutUint32(zeroChBuf[0:4], ELQ1Magic)
	binary.LittleEndian.PutUint32(zeroChBuf[20:24], 48000)
	binary.LittleEndian.PutUint16(zeroChBuf[24:26], 0) // Channels = 0
	if _, err := codec.Decode(zeroChBuf); err != ErrInvalidChannels {
		t.Fatalf("expected ErrInvalidChannels, got %v", err)
	}
}

func TestCodecRegistry(t *testing.T) {
	reg := DefaultCodecRegistry()
	if reg == nil {
		t.Fatal("expected non-nil default registry")
	}

	formats := reg.Formats()
	if len(formats) < 3 {
		t.Fatalf("expected at least 3 formats, got %d", len(formats))
	}

	// Test Get case-insensitive
	pcmCodec, ok := reg.Get("PCM16")
	if !ok || pcmCodec == nil {
		t.Fatal("expected to find PCM16 codec")
	}
	wavCodec, ok := reg.Get("wav")
	if !ok || wavCodec == nil {
		t.Fatal("expected to find wav codec")
	}
	elqCodec, ok := reg.Get("ELQ1")
	if !ok || elqCodec == nil {
		t.Fatal("expected to find elq1 codec")
	}

	_, ok = reg.Get("unknown_format")
	if ok {
		t.Fatal("expected unknown format to return false")
	}

	// Register nil guard
	reg.Register(nil)
}

func TestCodecs_ConcurrencyAndRace(t *testing.T) {
	reg := DefaultCodecRegistry()
	var wg sync.WaitGroup

	numWorkers := 8
	iterations := 100

	samplePCM := make([]byte, 960)
	for i := range samplePCM {
		samplePCM[i] = byte(i)
	}

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				frame := &AudioFrame{
					ID:          uint64(id*1000 + i),
					TimestampNs: time.Now().UnixNano(),
					SampleRate:  48000,
					Channels:    1,
					Data:        samplePCM,
				}

				// Encode with ELQ1
				elq, _ := reg.Get("elq1")
				b, err := elq.Encode(frame)
				if err != nil {
					t.Errorf("concurrent encode failed: %v", err)
				}
				_, err = elq.Decode(b)
				if err != nil {
					t.Errorf("concurrent decode failed: %v", err)
				}

				// Encode with WAV
				wav, _ := reg.Get("wav")
				wb, err := wav.Encode(frame)
				if err != nil {
					t.Errorf("concurrent wav encode failed: %v", err)
				}
				_, err = wav.Decode(wb)
				if err != nil {
					t.Errorf("concurrent wav decode failed: %v", err)
				}
			}
		}(w)
	}

	wg.Wait()
}
