// Package audio provides circular ring buffer primitives for the Jimmy BB audio
// pipeline, replacing dynamic allocations during high-frequency audio stream ingestion.
package audio

import (
	"errors"
	"sync"
	"sync/atomic"
)

var (
	// ErrCircularBufferFull indicates overrun when writing to a saturated circular buffer.
	ErrCircularBufferFull = errors.New("circular audio buffer is full (overrun)")
	// ErrCircularBufferEmpty indicates underrun when reading from an empty circular buffer.
	ErrCircularBufferEmpty = errors.New("circular audio buffer is empty (underrun)")
)

// CircularAudioBuffer implements a lock-free, fixed-capacity ring buffer for raw audio chunks.
type CircularAudioBuffer struct {
	slots     [][]byte
	capacity  uint64
	mask      uint64
	writeIdx  atomic.Uint64
	readIdx   atomic.Uint64
	overruns  atomic.Uint64
	underruns atomic.Uint64
	mu        sync.Mutex
}

// NewCircularAudioBuffer instantiates a circular ring buffer with a power-of-two capacity.
func NewCircularAudioBuffer(capacity uint64, slotSize int) *CircularAudioBuffer {
	if capacity == 0 || (capacity&(capacity-1)) != 0 {
		capacity = 256 // Power of two default
	}
	if slotSize <= 0 {
		slotSize = 1920
	}

	slots := make([][]byte, capacity)
	for i := range slots {
		slots[i] = make([]byte, slotSize)
	}

	return &CircularAudioBuffer{
		slots:    slots,
		capacity: capacity,
		mask:     capacity - 1,
	}
}

// Push writes an incoming audio chunk into the circular buffer.
// If overwriteOldest is true, older chunks are discarded during saturation instead of erroring.
func (cb *CircularAudioBuffer) Push(data []byte, overwriteOldest bool) error {
	w := cb.writeIdx.Load()
	r := cb.readIdx.Load()

	if w-r >= cb.capacity {
		if !overwriteOldest {
			cb.overruns.Add(1)
			return ErrCircularBufferFull
		}
		// Overwrite oldest slot by bumping read pointer
		cb.readIdx.Add(1)
		cb.overruns.Add(1)
	}

	slot := w & cb.mask
	copy(cb.slots[slot], data)
	cb.writeIdx.Add(1)
	return nil
}

// Pop reads and extracts the next sequential audio chunk.
func (cb *CircularAudioBuffer) Pop(dest []byte) (int, error) {
	w := cb.writeIdx.Load()
	r := cb.readIdx.Load()

	if r >= w {
		cb.underruns.Add(1)
		return 0, ErrCircularBufferEmpty
	}

	slot := r & cb.mask
	n := copy(dest, cb.slots[slot])
	cb.readIdx.Add(1)
	return n, nil
}

// Depth returns the current number of queued audio chunks.
func (cb *CircularAudioBuffer) Depth() uint64 {
	w := cb.writeIdx.Load()
	r := cb.readIdx.Load()
	if w >= r {
		return w - r
	}
	return 0
}

// Reset clears read and write indices atomically.
func (cb *CircularAudioBuffer) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.writeIdx.Store(0)
	cb.readIdx.Store(0)
	cb.overruns.Store(0)
	cb.underruns.Store(0)
}

// Stats returns a telemetry snapshot of circular buffer operations.
func (cb *CircularAudioBuffer) Stats() map[string]interface{} {
	return map[string]interface{}{
		"capacity":  cb.capacity,
		"depth":     cb.Depth(),
		"overruns":  cb.overruns.Load(),
		"underruns": cb.underruns.Load(),
	}
}
