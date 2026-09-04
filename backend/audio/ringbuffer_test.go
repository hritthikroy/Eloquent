package state

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestSharedRingBufferInitialization(t *testing.T) {
	seg := NewInMemorySegment(TotalSegmentSize)
	rb, err := NewSharedRingBuffer(seg, true)
	if err != nil {
		t.Fatalf("failed to create shared ring buffer: %v", err)
	}
	defer rb.Close()

	metrics := rb.GetMetrics()
	if metrics.WriteIndex != 0 {
		t.Errorf("expected writeIndex 0, got %d", metrics.WriteIndex)
	}
	if metrics.ReadIndex != 0 {
		t.Errorf("expected readIndex 0, got %d", metrics.ReadIndex)
	}
	if metrics.SlotCapacity != DefaultSlotCount {
		t.Errorf("expected slot capacity %d, got %d", DefaultSlotCount, metrics.SlotCapacity)
	}
	if !metrics.IsWriterAlive {
		t.Errorf("expected writer to be declared alive")
	}

	// Validate reader attachment
	rbReader, err := NewSharedRingBuffer(seg, false)
	if err != nil {
		t.Fatalf("failed to attach reader to existing segment: %v", err)
	}
	defer rbReader.Close()
}

func TestSharedRingBufferReadWriteSequential(t *testing.T) {
	seg := NewInMemorySegment(TotalSegmentSize)
	rb, err := NewSharedRingBuffer(seg, true)
	if err != nil {
		t.Fatalf("failed to create ring buffer: %v", err)
	}
	defer rb.Close()

	// 1. Read from empty buffer should return ErrBufferEmpty
	_, err = rb.ReadFrame()
	if err != ErrBufferEmpty {
		t.Fatalf("expected ErrBufferEmpty on empty queue, got %v", err)
	}

	metrics := rb.GetMetrics()
	if metrics.UnderrunCount != 1 {
		t.Errorf("expected underrun count 1, got %d", metrics.UnderrunCount)
	}

	// 2. Write 5 discrete audio frames
	samplePayload := []byte("48khz-pcm-16bit-mono-audio-sample-data-chunk")
	for i := uint64(1); i <= 5; i++ {
		frame := &AudioRingFrame{
			FrameID:     i,
			TimestampNs: time.Now().UnixNano(),
			SampleRate:  48000,
			Channels:    1,
			Flags:       FrameFlagPCM16LE | FrameFlagSpeechActive,
			Data:        samplePayload,
		}
		if err := rb.WriteFrame(frame); err != nil {
			t.Fatalf("WriteFrame %d failed: %v", i, err)
		}
	}

	metrics = rb.GetMetrics()
	if metrics.QueueDepth != 5 {
		t.Errorf("expected queue depth 5, got %d", metrics.QueueDepth)
	}

	// 3. Read back 5 frames and verify bit-for-bit integrity
	for i := uint64(1); i <= 5; i++ {
		readFrame, err := rb.ReadFrame()
		if err != nil {
			t.Fatalf("ReadFrame %d failed: %v", i, err)
		}
		if readFrame.FrameID != i {
			t.Errorf("expected frameID %d, got %d", i, readFrame.FrameID)
		}
		if !bytes.Equal(readFrame.Data, samplePayload) {
			t.Errorf("payload mismatch on frame %d", i)
		}
	}

	// Queue should now be empty
	if rb.GetMetrics().QueueDepth != 0 {
		t.Errorf("expected empty queue after reading all frames, got %d", rb.GetMetrics().QueueDepth)
	}
}

func TestSharedRingBufferOverrunBackpressure(t *testing.T) {
	seg := NewInMemorySegment(TotalSegmentSize)
	rb, err := NewSharedRingBuffer(seg, true)
	if err != nil {
		t.Fatalf("failed to create ring buffer: %v", err)
	}
	defer rb.Close()

	payload := []byte("audio-chunk")

	// Fill buffer completely (DefaultSlotCount = 256)
	for i := uint32(0); i < DefaultSlotCount; i++ {
		err := rb.WriteFrame(&AudioRingFrame{
			FrameID: uint64(i + 1),
			Data:    payload,
		})
		if err != nil {
			t.Fatalf("unexpected write error at slot %d: %v", i, err)
		}
	}

	metrics := rb.GetMetrics()
	if metrics.QueueDepth != uint64(DefaultSlotCount) {
		t.Fatalf("expected queue depth %d, got %d", DefaultSlotCount, metrics.QueueDepth)
	}

	// 257th write should trigger ErrBufferFull
	err = rb.WriteFrame(&AudioRingFrame{
		FrameID: 9999,
		Data:    payload,
	})
	if err != ErrBufferFull {
		t.Fatalf("expected ErrBufferFull on full queue, got %v", err)
	}

	metrics = rb.GetMetrics()
	if metrics.OverrunCount != 1 {
		t.Errorf("expected overrun count 1, got %d", metrics.OverrunCount)
	}
}

func TestSharedRingBufferConcurrentMultiProducerConsumer(t *testing.T) {
	seg := NewInMemorySegment(TotalSegmentSize)
	writerRB, err := NewSharedRingBuffer(seg, true)
	if err != nil {
		t.Fatalf("failed to create writer ring buffer: %v", err)
	}
	defer writerRB.Close()

	readerRB, err := NewSharedRingBuffer(seg, false)
	if err != nil {
		t.Fatalf("failed to create reader ring buffer: %v", err)
	}
	defer readerRB.Close()

	totalFrames := 500
	var wg sync.WaitGroup
	wg.Add(2)

	// Producer goroutine
	go func() {
		defer wg.Done()
		for i := 1; i <= totalFrames; i++ {
			data := []byte(fmt.Sprintf("pcm-frame-data-%d", i))
			for {
				err := writerRB.WriteFrame(&AudioRingFrame{
					FrameID:     uint64(i),
					TimestampNs: time.Now().UnixNano(),
					SampleRate:  48000,
					Channels:    1,
					Data:        data,
				})
				if err == nil {
					break
				}
				// Yield on overrun
				time.Sleep(50 * time.Microsecond)
			}
		}
	}()

	// Consumer goroutine
	consumedFrames := 0
	go func() {
		defer wg.Done()
		for consumedFrames < totalFrames {
			frame, err := readerRB.ReadFrame()
			if err == nil {
				expectedPrefix := fmt.Sprintf("pcm-frame-data-%d", frame.FrameID)
				if string(frame.Data) != expectedPrefix {
					t.Errorf("frame data corrupted: got %s, expected %s", string(frame.Data), expectedPrefix)
				}
				consumedFrames++
			} else {
				time.Sleep(50 * time.Microsecond)
			}
		}
	}()

	wg.Wait()

	if consumedFrames != totalFrames {
		t.Fatalf("expected %d consumed frames, got %d", totalFrames, consumedFrames)
	}
}

func TestSharedRingBufferOversizePayloadRejection(t *testing.T) {
	seg := NewInMemorySegment(TotalSegmentSize)
	rb, err := NewSharedRingBuffer(seg, true)
	if err != nil {
		t.Fatalf("failed to create ring buffer: %v", err)
	}
	defer rb.Close()

	oversizeData := make([]byte, MaxPayloadSize+100)
	err = rb.WriteFrame(&AudioRingFrame{
		FrameID: 1,
		Data:    oversizeData,
	})
	if !errors.Is(err, ErrPayloadTooLarge) {
		t.Fatalf("expected ErrPayloadTooLarge, got %v", err)
	}
}

func TestSharedRingBufferFileMmap(t *testing.T) {
	tempDir := t.TempDir()
	shmPath := filepath.Join(tempDir, "test_audio_shm.bin")

	// 1. Create file-mapped segment
	seg, err := OpenSharedMemorySegment(shmPath, TotalSegmentSize, true)
	if err != nil {
		t.Fatalf("OpenSharedMemorySegment failed: %v", err)
	}

	rbWriter, err := NewSharedRingBuffer(seg, true)
	if err != nil {
		t.Fatalf("NewSharedRingBuffer writer failed: %v", err)
	}

	// 2. Write frame via writer
	sampleData := []byte("mmap-audio-frame-test")
	err = rbWriter.WriteFrame(&AudioRingFrame{
		FrameID:     101,
		TimestampNs: 123456789,
		SampleRate:  48000,
		Channels:    1,
		Data:        sampleData,
	})
	if err != nil {
		t.Fatalf("WriteFrame failed: %v", err)
	}

	// 3. Attach independent reader via second segment mapping
	readerSeg, err := OpenSharedMemorySegment(shmPath, TotalSegmentSize, false)
	if err != nil {
		t.Fatalf("OpenSharedMemorySegment reader failed: %v", err)
	}

	rbReader, err := NewSharedRingBuffer(readerSeg, false)
	if err != nil {
		t.Fatalf("NewSharedRingBuffer reader failed: %v", err)
	}

	frame, err := rbReader.ReadFrame()
	if err != nil {
		t.Fatalf("ReadFrame from mmap segment failed: %v", err)
	}

	if frame.FrameID != 101 {
		t.Errorf("expected frameID 101, got %d", frame.FrameID)
	}
	if !bytes.Equal(frame.Data, sampleData) {
		t.Errorf("mmap data mismatch")
	}

	rbWriter.Close()
	rbReader.Close()
	os.Remove(shmPath)
}

func TestSharedRingBufferCrashRecovery(t *testing.T) {
	seg := NewInMemorySegment(TotalSegmentSize)
	rb, err := NewSharedRingBuffer(seg, true)
	if err != nil {
		t.Fatalf("failed to create ring buffer: %v", err)
	}
	defer rb.Close()

	// Fill some items
	rb.WriteFrame(&AudioRingFrame{FrameID: 1, Data: []byte("frame-1")})
	rb.WriteFrame(&AudioRingFrame{FrameID: 2, Data: []byte("frame-2")})

	if rb.GetMetrics().QueueDepth != 2 {
		t.Fatalf("expected queue depth 2")
	}

	// Simulate stale heartbeat (10s old)
	staleHeartbeat := time.Now().Add(-10 * time.Second).UnixNano()
	binary.LittleEndian.PutUint64(seg.Bytes()[OffsetLastHeartbeatNs:], uint64(staleHeartbeat))

	recovered := rb.RecoverStaleState(2 * int64(time.Second))
	if !recovered {
		t.Fatalf("expected RecoverStaleState to recover stale buffer")
	}

	if rb.GetMetrics().QueueDepth != 0 {
		t.Errorf("expected queue depth 0 after recovery, got %d", rb.GetMetrics().QueueDepth)
	}
}
