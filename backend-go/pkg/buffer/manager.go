// Package buffer provides memory alignment and bounded buffer pooling utilities
// to eliminate memory flag contention, pointer misalignment, and false sharing
// during zero-copy audio stream handoffs between Go and Node.js.
package buffer

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
)

// Structural alignment constraints
const (
	// AlignSize defines cache-line alignment boundary (64 bytes) to prevent false sharing.
	AlignSize = 64
	// MinBufferSize represents the minimum allowable buffer slice size.
	MinBufferSize = 64
	// MaxBufferSize sets a strict safety ceiling of 4MB per buffer to prevent OOM allocations.
	MaxBufferSize = 1 << 22
)

// AlignmentError reports failure during pointer alignment assertions.
type AlignmentError struct {
	Ptr       uintptr
	Alignment int
	Msg       string
}

func (e *AlignmentError) Error() string {
	return fmt.Sprintf("alignment violation: ptr 0x%x is not aligned to %d bytes: %s", e.Ptr, e.Alignment, e.Msg)
}

// IsAligned checks if an arbitrary memory address satisfies alignment requirements.
func IsAligned(ptr uintptr, alignment int) bool {
	if alignment <= 0 || (alignment&(alignment-1)) != 0 {
		return false
	}
	return ptr&uintptr(alignment-1) == 0
}

// AllocAligned allocates a byte slice whose starting memory address is guaranteed
// to be aligned to AlignSize (64 bytes). It uses unsafe pointer arithmetic over
// an over-allocated raw slice.
func AllocAligned(size int) ([]byte, error) {
	if size <= 0 {
		return nil, errors.New("buffer size must be greater than zero")
	}
	if size > MaxBufferSize {
		return nil, fmt.Errorf("buffer size %d exceeds maximum allowed %d", size, MaxBufferSize)
	}

	// Over-allocate by AlignSize bytes so we have room to shift the slice start
	totalBytes := size + AlignSize
	raw := make([]byte, totalBytes)

	ptr := uintptr(unsafe.Pointer(&raw[0]))
	offset := 0
	remainder := int(ptr & uintptr(AlignSize-1))
	if remainder != 0 {
		offset = AlignSize - remainder
	}

	alignedSlice := raw[offset : offset+size]
	alignedPtr := uintptr(unsafe.Pointer(&alignedSlice[0]))

	if !IsAligned(alignedPtr, AlignSize) {
		return nil, &AlignmentError{
			Ptr:       alignedPtr,
			Alignment: AlignSize,
			Msg:       "failed internal assertion after offset calculation",
		}
	}

	return alignedSlice, nil
}

// AlignedManagerStats captures live operational counters from AlignedBufferManager.
type AlignedManagerStats struct {
	Acquired       uint64 `json:"acquired"`
	Released       uint64 `json:"released"`
	InFlight       int64  `json:"inFlight"`
	AlignmentFails uint64 `json:"alignmentFails"`
	PeakInFlight   int64  `json:"peakInFlight"`
	LeakedCount    int    `json:"leakedCount"`
}

// AlignedBufferManager coordinates pooled, cache-line aligned byte buffers with
// deterministic tracking to resolve memory flag contention and identify leaks.
type AlignedBufferManager struct {
	pool           sync.Pool
	bufSize        int
	acquired       atomic.Uint64
	released       atomic.Uint64
	inFlight       atomic.Int64
	alignmentFails atomic.Uint64
	peakInFlight   atomic.Int64

	mu      sync.Mutex
	leakMap map[uintptr]time.Time
}

// NewAlignedBufferManager instantiates a buffer manager for fixed-size aligned slices.
func NewAlignedBufferManager(bufSize int) *AlignedBufferManager {
	if bufSize <= 0 {
		bufSize = 1920 // Default 20ms mono 48kHz PCM frame
	}

	m := &AlignedBufferManager{
		bufSize: bufSize,
		leakMap: make(map[uintptr]time.Time),
	}

	m.pool.New = func() interface{} {
		buf, err := AllocAligned(m.bufSize)
		if err != nil {
			return make([]byte, m.bufSize)
		}
		return buf
	}

	return m
}

// Acquire pulls an aligned buffer slice from the pool or allocates a fresh aligned buffer.
func (m *AlignedBufferManager) Acquire() ([]byte, error) {
	obj := m.pool.Get()
	buf, ok := obj.([]byte)
	if !ok || len(buf) < m.bufSize {
		var err error
		buf, err = AllocAligned(m.bufSize)
		if err != nil {
			return nil, err
		}
	}

	ptr := uintptr(unsafe.Pointer(&buf[0]))
	if !IsAligned(ptr, AlignSize) {
		m.alignmentFails.Add(1)
		var err error
		buf, err = AllocAligned(m.bufSize)
		if err != nil {
			return nil, err
		}
		ptr = uintptr(unsafe.Pointer(&buf[0]))
	}

	now := time.Now()
	m.mu.Lock()
	m.leakMap[ptr] = now
	m.mu.Unlock()

	m.acquired.Add(1)
	currInFlight := m.inFlight.Add(1)

	for {
		peak := m.peakInFlight.Load()
		if currInFlight <= peak {
			break
		}
		if m.peakInFlight.CompareAndSwap(peak, currInFlight) {
			break
		}
	}

	return buf[:m.bufSize], nil
}

// Release zeroes memory to prevent sensitive residue and returns the slice to the pool.
func (m *AlignedBufferManager) Release(b []byte) {
	if len(b) == 0 {
		return
	}

	ptr := uintptr(unsafe.Pointer(&b[0]))

	for i := range b {
		b[i] = 0
	}

	m.mu.Lock()
	delete(m.leakMap, ptr)
	m.mu.Unlock()

	m.inFlight.Add(-1)
	m.released.Add(1)

	if cap(b) >= m.bufSize {
		m.pool.Put(b[:m.bufSize])
	}
}

// LeakedBuffers identifies buffers that have been held without release past the threshold.
func (m *AlignedBufferManager) LeakedBuffers(threshold time.Duration) []uintptr {
	cutoff := time.Now().Add(-threshold)
	m.mu.Lock()
	defer m.mu.Unlock()

	var leaks []uintptr
	for ptr, acquiredAt := range m.leakMap {
		if acquiredAt.Before(cutoff) {
			leaks = append(leaks, ptr)
		}
	}
	return leaks
}

// Stats returns a snapshot of allocation, release, and leak metrics.
func (m *AlignedBufferManager) Stats() AlignedManagerStats {
	m.mu.Lock()
	leakedCount := len(m.leakMap)
	m.mu.Unlock()

	return AlignedManagerStats{
		Acquired:       m.acquired.Load(),
		Released:       m.released.Load(),
		InFlight:       m.inFlight.Load(),
		AlignmentFails: m.alignmentFails.Load(),
		PeakInFlight:   m.peakInFlight.Load(),
		LeakedCount:    leakedCount,
	}
}

// Close resets tracking structures and clears tracked pointers.
func (m *AlignedBufferManager) Close() {
	m.mu.Lock()
	m.leakMap = make(map[uintptr]time.Time)
	m.mu.Unlock()
}
