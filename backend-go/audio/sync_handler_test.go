package state

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestSyncHandlerCheckpoint(t *testing.T) {
	sh := NewSyncHandler(SyncHandlerConfig{
		BaseInterval:      20 * time.Millisecond,
		MinInterval:       10 * time.Millisecond,
		MaxInterval:       50 * time.Millisecond,
		AdaptiveBuffering: true,
	})

	// Test audio buffer hashing
	testBuffer := []byte("audio-sample-pcm-data-stream-48000")
	sh.UpdateAudioBuffer(testBuffer)

	sh.UpdateLastToken("Antigravity", time.Now().UnixMilli())

	cp := sh.GetCheckpoint()
	if cp.EventType != "SYNC_CHECKPOINT" {
		t.Fatalf("expected eventType 'SYNC_CHECKPOINT', got %s", cp.EventType)
	}
	if cp.BufferLength != len(testBuffer) {
		t.Fatalf("expected buffer length %d, got %d", len(testBuffer), cp.BufferLength)
	}
	if cp.LastProcessedToken != "Antigravity" {
		t.Fatalf("expected token 'Antigravity', got %s", cp.LastProcessedToken)
	}
	if len(cp.BufferHash) != 64 {
		t.Fatalf("expected 64-char sha256 hash, got %s", cp.BufferHash)
	}

	// Test periodic emission
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	var receivedCount int64
	sh.Start(ctx, func(checkpoint SyncCheckpoint) {
		atomic.AddInt64(&receivedCount, 1)
	})

	time.Sleep(75 * time.Millisecond)
	sh.Stop()

	if atomic.LoadInt64(&receivedCount) < 2 {
		t.Fatalf("expected at least 2 checkpoints within 75ms, got %d", atomic.LoadInt64(&receivedCount))
	}
}

func TestSyncHandlerPausedAndAdaptive(t *testing.T) {
	sh := NewSyncHandler()
	sh.SetPaused(true)

	cp := sh.GetCheckpoint()
	if !cp.IsPaused {
		t.Fatalf("expected IsPaused to be true")
	}

	adaptive := sh.AdaptiveInterval()
	if adaptive != 150*time.Millisecond {
		t.Fatalf("expected 150ms interval when paused, got %v", adaptive)
	}
}
