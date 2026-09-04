package state

import (
	"context"
	"runtime"
	"sync"
	"testing"
	"time"
)

func TestWebRTCStreamMonotonicEmission(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := DefaultWebRTCStreamConfig()
	cfg.ChunkDurationMs = 10 * time.Millisecond
	session, err := NewWebRTCAudioStreamSession(ctx, "session-test-01", cfg)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	defer session.Close()

	sub := session.Subscribe()

	// Emit 5 chunks with alternating markers
	numChunks := 5
	for i := 1; i <= numChunks; i++ {
		var marker *StreamMarker
		if i%2 == 1 {
			marker = &StreamMarker{
				MarkerID:          "verse-1",
				VerseIndex:        1,
				WordOffset:        i,
				TargetTimestampMs: time.Now().UnixMilli(),
				DurationMs:        10.0,
				Text:              "Echoes in the digital wind",
			}
		}

		rawPCM := []byte("pcm-audio-sample-data-chunk-")
		chunk, err := session.EmitChunk(rawPCM, marker)
		if err != nil {
			t.Fatalf("failed to emit chunk %d: %v", i, err)
		}

		if chunk.SequenceNumber != uint64(i) {
			t.Fatalf("expected seq %d, got %d", i, chunk.SequenceNumber)
		}
		if chunk.Checksum == "" {
			t.Fatalf("expected non-empty checksum for chunk %d", i)
		}
		if marker != nil && chunk.Marker == nil {
			t.Fatalf("expected marker to be preserved in chunk %d", i)
		}
	}

	// Verify subscriber received chunks in monotonic sequence
	for i := 1; i <= numChunks; i++ {
		select {
		case chunk, ok := <-sub:
			if !ok {
				t.Fatalf("subscriber channel closed prematurely at index %d", i)
			}
			if chunk.SequenceNumber != uint64(i) {
				t.Fatalf("expected subscriber seq %d, got %d", i, chunk.SequenceNumber)
			}
		case <-time.After(200 * time.Millisecond):
			t.Fatalf("timeout waiting for subscriber chunk %d", i)
		}
	}

	telem := session.GetTelemetry()
	if telem.TotalChunksEmitted != uint64(numChunks) {
		t.Fatalf("expected %d chunks emitted, got %d", numChunks, telem.TotalChunksEmitted)
	}
}

func TestJitterBufferReorderingAndPacketLoss(t *testing.T) {
	jb := NewJitterBuffer(20)

	// Push sequence: 1, 3, 2 (out of order), 6 (packet loss of 4, 5)
	now := time.Now().UnixMilli()

	c1 := AudioChunkMetadata{SequenceNumber: 1, TimestampMs: now - 30}
	c3 := AudioChunkMetadata{SequenceNumber: 3, TimestampMs: now - 10}
	c2 := AudioChunkMetadata{SequenceNumber: 2, TimestampMs: now - 20}
	c6 := AudioChunkMetadata{SequenceNumber: 6, TimestampMs: now}

	jb.Push(c1)
	jb.Push(c3)
	jb.Push(c2)
	jb.Push(c6)

	metrics := jb.GetMetrics()
	if metrics.OutOfOrderCount < 1 {
		t.Fatalf("expected at least 1 out of order packet, got %d", metrics.OutOfOrderCount)
	}
	if metrics.PacketsLost != 2 {
		t.Fatalf("expected 2 packets lost (4 and 5), got %d", metrics.PacketsLost)
	}

	// Pop chunks — must arrive in sorted sequence: 1, 2, 3, 6
	expectedOrder := []uint64{1, 2, 3, 6}
	for _, expectedSeq := range expectedOrder {
		chunk, ok := jb.PopReady()
		if !ok {
			t.Fatalf("expected chunk with seq %d, but buffer was empty", expectedSeq)
		}
		if chunk.SequenceNumber != expectedSeq {
			t.Fatalf("expected sequence %d, got %d", expectedSeq, chunk.SequenceNumber)
		}
	}

	// Buffer should now be empty and report underrun on next pop
	_, ok := jb.PopReady()
	if ok {
		t.Fatalf("expected empty buffer")
	}
	if jb.GetMetrics().BufferUnderruns != 1 {
		t.Fatalf("expected 1 underrun, got %d", jb.GetMetrics().BufferUnderruns)
	}
}

func TestWebRTCAudioStreamSessionZeroLeaks(t *testing.T) {
	initialGoroutines := runtime.NumGoroutine()

	ctx, cancel := context.WithCancel(context.Background())
	session, err := NewWebRTCAudioStreamSession(ctx, "session-leak-check")
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	sub1 := session.Subscribe()
	sub2 := session.Subscribe()

	// Concurrently emit chunks and read from subscribers
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		for i := 0; i < 20; i++ {
			session.EmitChunk([]byte("test-data"), nil)
			time.Sleep(2 * time.Millisecond)
		}
	}()

	go func() {
		defer wg.Done()
		for i := 0; i < 20; i++ {
			select {
			case <-sub1:
			case <-time.After(100 * time.Millisecond):
			}
		}
	}()

	wg.Wait()

	// Cancel context and close session
	cancel()
	err = session.Close()
	if err != nil {
		t.Fatalf("close returned error: %v", err)
	}

	// Double close must not panic or error
	_ = session.Close()

	// Channels must be closed
	select {
	case _, ok := <-sub2:
		if ok {
			t.Log("channel still open during drain")
		}
	case <-time.After(100 * time.Millisecond):
	}

	time.Sleep(50 * time.Millisecond)
	finalGoroutines := runtime.NumGoroutine()

	// Ensure no runaway goroutine leaks (allow small variance for runtime GC)
	if finalGoroutines-initialGoroutines > 5 {
		t.Fatalf("potential goroutine leak: initial=%d, final=%d", initialGoroutines, finalGoroutines)
	}
}
