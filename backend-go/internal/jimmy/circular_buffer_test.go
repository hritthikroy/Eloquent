package audio

import (
	"bytes"
	"testing"
)

func TestCircularAudioBuffer_BasicOperations(t *testing.T) {
	cb := NewCircularAudioBuffer(8, 16)

	// Pop empty buffer -> ErrCircularBufferEmpty
	dest := make([]byte, 16)
	_, err := cb.Pop(dest)
	if err != ErrCircularBufferEmpty {
		t.Fatalf("expected ErrCircularBufferEmpty, got %v", err)
	}

	// Push 4 items
	for i := 0; i < 4; i++ {
		payload := bytes.Repeat([]byte{byte(i + 1)}, 16)
		if err := cb.Push(payload, false); err != nil {
			t.Fatalf("Push %d failed: %v", i, err)
		}
	}

	if depth := cb.Depth(); depth != 4 {
		t.Fatalf("expected depth 4, got %d", depth)
	}

	// Pop first 2 items
	for i := 0; i < 2; i++ {
		n, err := cb.Pop(dest)
		if err != nil {
			t.Fatalf("Pop %d failed: %v", i, err)
		}
		if n != 16 || dest[0] != byte(i+1) {
			t.Fatalf("unexpected content at %d: %v", i, dest)
		}
	}

	if depth := cb.Depth(); depth != 2 {
		t.Fatalf("expected depth 2, got %d", depth)
	}
}

func TestCircularAudioBuffer_OverwriteOldest(t *testing.T) {
	cb := NewCircularAudioBuffer(4, 8)

	// Fill to capacity
	for i := 0; i < 4; i++ {
		payload := bytes.Repeat([]byte{byte(i + 1)}, 8)
		if err := cb.Push(payload, false); err != nil {
			t.Fatalf("Push %d failed: %v", i, err)
		}
	}

	// Push 5th item with overwrite=false -> ErrCircularBufferFull
	extra := bytes.Repeat([]byte{0xFF}, 8)
	if err := cb.Push(extra, false); err != ErrCircularBufferFull {
		t.Fatalf("expected ErrCircularBufferFull, got %v", err)
	}

	// Push with overwrite=true -> should drop oldest (1) and append
	if err := cb.Push(extra, true); err != nil {
		t.Fatalf("Push with overwrite failed: %v", err)
	}

	dest := make([]byte, 8)
	_, _ = cb.Pop(dest)
	// Oldest remaining item should be 2 (since 1 was overwritten)
	if dest[0] != 2 {
		t.Fatalf("expected oldest item to be 2, got %d", dest[0])
	}
}
