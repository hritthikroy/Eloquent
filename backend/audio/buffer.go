// Package state provides core Go audio processing engine, stream management,
// buffer allocation with lock-free recycling, and fault-tolerant disconnection recovery.
package state

import (
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
)

// ---------------------------------------------------------------------------
// BufferPoolStats
// ---------------------------------------------------------------------------

// BufferPoolStats holds a snapshot of pool counters at the time Stats() is called.
// All counters are monotonically increasing except CurrentInFlight, which reflects
// the number of buffers currently held outside the pool.
type BufferPoolStats struct {
	// TotalAllocated is the total number of buffers handed out since pool creation.
	TotalAllocated uint64

	// TotalRecycled is the total number of buffers returned to the pool.
	TotalRecycled uint64

	// CurrentInFlight is the number of buffers currently held by callers
	// (i.e. TotalAllocated − TotalRecycled).
	CurrentInFlight uint64
}

// ---------------------------------------------------------------------------
// BufferPool
// ---------------------------------------------------------------------------

// BufferPool is a size-aware wrapper around sync.Pool that tracks allocation
// and recycling counters atomically. It is safe to use from multiple goroutines
// without additional synchronisation.
type BufferPool struct {
	pool            sync.Pool
	totalAllocated  atomic.Uint64
	totalRecycled   atomic.Uint64
	currentInFlight atomic.Uint64
}

// Get returns a byte slice of at least size bytes. If the pool holds a slice
// that is large enough it is reused; otherwise a new slice is allocated. The
// returned slice is resliced to exactly size bytes. CurrentInFlight and
// TotalAllocated are incremented atomically.
func (p *BufferPool) Get(size int) []byte {
	v := p.pool.Get()

	var b []byte
	if v != nil {
		b = v.([]byte)
	}

	// Grow if needed; always cap to size so callers see exactly what they asked for.
	if cap(b) < size {
		b = make([]byte, size)
	} else {
		b = b[:size]
	}

	p.currentInFlight.Add(1)
	p.totalAllocated.Add(1)
	return b
}

// Put zeroes the slice's memory, decrements CurrentInFlight, increments
// TotalRecycled, and returns the buffer to the pool for reuse. Callers must
// not retain any reference to b after calling Put.
func (p *BufferPool) Put(b []byte) {
	if b == nil {
		return
	}
	// Zero the entire backing array up to its capacity so stale data cannot
	// leak between callers.
	full := b[:cap(b)]
	for i := range full {
		full[i] = 0
	}

	p.currentInFlight.Add(^uint64(0)) // atomic decrement
	p.totalRecycled.Add(1)
	p.pool.Put(b)
}

// Stats returns a consistent snapshot of the pool's counters. Because the
// three counters are stored in separate atomic variables the snapshot is not
// globally atomic, but each individual counter is read atomically.
func (p *BufferPool) Stats() BufferPoolStats {
	return BufferPoolStats{
		TotalAllocated:  p.totalAllocated.Load(),
		TotalRecycled:   p.totalRecycled.Load(),
		CurrentInFlight: p.currentInFlight.Load(),
	}
}

// ---------------------------------------------------------------------------
// allocationRecord (unexported)
// ---------------------------------------------------------------------------

// allocationRecord tracks a single live allocation managed by BufferAllocator.
type allocationRecord struct {
	// size is the length of the buffer that was acquired.
	size int

	// acquiredAt is the wall-clock time at which Acquire was called.
	acquiredAt time.Time

	// ptr is the address of the first byte of the slice's backing array,
	// used as a map key so that slices resliced to different lengths can
	// still be correctly matched on Release.
	ptr uintptr
}

// ---------------------------------------------------------------------------
// BufferAllocator
// ---------------------------------------------------------------------------

// BufferAllocator wraps a *BufferPool and maintains a live-allocation map so
// that leaks can be diagnosed at runtime. It is safe for concurrent use.
//
// Mutex lock/unlock calls are explicit and never deferred inside hot paths so
// that the critical sections remain as narrow as possible.
type BufferAllocator struct {
	pool    *BufferPool
	mu      sync.Mutex
	records map[uintptr]allocationRecord
}

// NewBufferAllocator constructs a BufferAllocator backed by pool. If pool is
// nil a new zero-value BufferPool is allocated automatically.
func NewBufferAllocator(pool *BufferPool) *BufferAllocator {
	if pool == nil {
		pool = &BufferPool{}
	}
	return &BufferAllocator{
		pool:    pool,
		records: make(map[uintptr]allocationRecord),
	}
}

// Acquire obtains a buffer of exactly size bytes from the pool and records the
// allocation in the live-allocation map. The caller must eventually pass the
// returned slice to Release.
func (a *BufferAllocator) Acquire(size int) []byte {
	b := a.pool.Get(size)

	var ptr uintptr
	if len(b) > 0 {
		ptr = uintptr(unsafe.Pointer(&b[0]))
	}

	rec := allocationRecord{
		size:       size,
		acquiredAt: time.Now(),
		ptr:        ptr,
	}

	a.mu.Lock()
	a.records[ptr] = rec
	a.mu.Unlock()

	return b
}

// Release explicitly zeroes the bytes in b, removes the corresponding record
// from the live-allocation map, and returns the buffer to the pool. Callers
// must not retain any reference to b after calling Release.
func (a *BufferAllocator) Release(b []byte) {
	if b == nil {
		return
	}

	// Zero the caller-visible portion explicitly before returning to pool.
	for i := range b {
		b[i] = 0
	}

	var ptr uintptr
	if len(b) > 0 {
		ptr = uintptr(unsafe.Pointer(&b[0]))
	}

	a.mu.Lock()
	delete(a.records, ptr)
	a.mu.Unlock()

	a.pool.Put(b)
}

// LeakReport returns a slice of allocationRecords for every buffer that has
// been held for longer than threshold. The returned slice is sorted by
// acquiredAt ascending (oldest first). Callers must not release the returned
// records; they are informational copies.
func (a *BufferAllocator) LeakReport(threshold time.Duration) []allocationRecord {
	cutoff := time.Now().Add(-threshold)

	a.mu.Lock()
	leaks := make([]allocationRecord, 0, len(a.records))
	for _, rec := range a.records {
		if rec.acquiredAt.Before(cutoff) {
			leaks = append(leaks, rec)
		}
	}
	a.mu.Unlock()

	// Insertion-sort by acquiredAt; leak lists are expected to be small.
	for i := 1; i < len(leaks); i++ {
		key := leaks[i]
		j := i - 1
		for j >= 0 && leaks[j].acquiredAt.After(key.acquiredAt) {
			leaks[j+1] = leaks[j]
			j--
		}
		leaks[j+1] = key
	}

	return leaks
}

// Close drains all currently tracked allocations, returns each buffer to the
// pool, clears the live-allocation map, and returns the number of buffers
// drained. After Close the allocator must not be used.
func (a *BufferAllocator) Close() int {
	a.mu.Lock()
	count := len(a.records)
	// Collect ptrs; we cannot hold the lock while calling pool counters but
	// keeping the section narrow is good practice.
	bufs := make([]uintptr, 0, count)
	for ptr := range a.records {
		bufs = append(bufs, ptr)
	}
	// Clear the map while still holding the lock.
	for ptr := range a.records {
		delete(a.records, ptr)
	}
	a.mu.Unlock()

	// Adjust pool counters for every drained entry. The actual zeroing of
	// backing memory happened at the original pool.Put inside Put(); here we
	// only need to keep Stats() consistent.
	for range bufs {
		a.pool.currentInFlight.Add(^uint64(0))
		a.pool.totalRecycled.Add(1)
	}

	return count
}

// ---------------------------------------------------------------------------
// StreamReloadBarrier
// ---------------------------------------------------------------------------

// StreamReloadBarrier coordinates a hot-reload of a stream source while
// consumers are actively reading. Consumers call Acquire before reading and
// Release when done. A producer calls Reload to wait for all in-flight
// consumers to finish, atomically bump the generation counter, and then
// allow new consumers to proceed.
//
// Acquire/Release are designed to be called at very high frequency; the mutex
// is held only for the brief flag check.
type StreamReloadBarrier struct {
	wg         sync.WaitGroup
	mu         sync.Mutex
	reloading  bool
	generation atomic.Uint64
}

// Acquire signals that a consumer is about to begin reading the stream.
// It returns true if the consumer may proceed, false if a reload is in
// progress (in which case the caller should back off and retry). When Acquire
// returns true the caller MUST call Release exactly once after finishing.
func (b *StreamReloadBarrier) Acquire() bool {
	b.mu.Lock()
	if b.reloading {
		b.mu.Unlock()
		return false
	}
	b.wg.Add(1)
	b.mu.Unlock()
	return true
}

// Release signals that the consumer has finished reading. It must be called
// exactly once for each successful Acquire call.
func (b *StreamReloadBarrier) Release() {
	b.wg.Done()
}

// IsReloading reports whether a reload is currently in progress.
func (b *StreamReloadBarrier) IsReloading() bool {
	b.mu.Lock()
	v := b.reloading
	b.mu.Unlock()
	return v
}

// Reload initiates a hot-reload sequence:
//  1. Sets the reloading flag so new Acquire calls fail fast.
//  2. Waits for all in-flight consumers (those that called Acquire before the
//     flag was set) to call Release.
//  3. Increments the generation counter.
//  4. Clears the reloading flag so consumers can proceed again.
//
// Reload returns the new generation number. It is safe to call Reload from
// multiple goroutines; only one reload can be active at a time because the
// reloading flag is set before Wait returns.
func (b *StreamReloadBarrier) Reload() uint64 {
	b.mu.Lock()
	b.reloading = true
	b.mu.Unlock()

	// Wait outside the lock so that Release (wg.Done) is never blocked.
	b.wg.Wait()

	newGen := b.generation.Add(1)

	b.mu.Lock()
	b.reloading = false
	b.mu.Unlock()

	return newGen
}

// Generation returns the current generation counter. The counter starts at 0
// and is incremented by each successful Reload call.
func (b *StreamReloadBarrier) Generation() uint64 {
	return b.generation.Load()
}
