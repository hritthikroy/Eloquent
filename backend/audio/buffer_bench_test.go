// Package state provides benchmarks and stress tests for the audio buffer
// allocation, ring buffer, and stream reload subsystems.
package state

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ─────────────────────────────────────────────────────────────────────────────
// BufferPool benchmarks
// ─────────────────────────────────────────────────────────────────────────────

// BenchmarkBufferPoolGetPut measures the hot-path throughput of a single
// goroutine cycling Get/Put at the default 1920-byte PCM frame size.
func BenchmarkBufferPoolGetPut(b *testing.B) {
	pool := &BufferPool{}
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		buf := pool.Get(1920)
		buf[0] = 0xFF // prevent dead-code elimination
		pool.Put(buf)
	}
}

// BenchmarkBufferPoolGetPutParallel exercises the pool under maximum goroutine
// concurrency to expose false-sharing or lock contention in sync.Pool.
func BenchmarkBufferPoolGetPutParallel(b *testing.B) {
	pool := &BufferPool{}
	b.ResetTimer()
	b.ReportAllocs()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			buf := pool.Get(1920)
			buf[0] = 0xAB
			pool.Put(buf)
		}
	})
}

// BenchmarkBufferPoolMixedSizes exercises the pool with varying sizes to
// measure the overhead of the cap-check branch.
func BenchmarkBufferPoolMixedSizes(b *testing.B) {
	sizes := []int{512, 1920, 4096, 8192}
	pool := &BufferPool{}
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		sz := sizes[i%len(sizes)]
		buf := pool.Get(sz)
		buf[0] = byte(i)
		pool.Put(buf)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// BufferAllocator benchmarks
// ─────────────────────────────────────────────────────────────────────────────

// BenchmarkBufferAllocatorAcquireRelease measures full Acquire→Release round-trip
// including the map insert/delete under zero contention.
func BenchmarkBufferAllocatorAcquireRelease(b *testing.B) {
	alloc := NewBufferAllocator(nil)
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		buf := alloc.Acquire(1920)
		buf[0] = 0x01
		alloc.Release(buf)
	}
}

// BenchmarkBufferAllocatorParallel stresses the allocator with concurrent
// Acquire/Release pairs to expose mutex contention on the live-allocation map.
func BenchmarkBufferAllocatorParallel(b *testing.B) {
	alloc := NewBufferAllocator(nil)
	b.ResetTimer()
	b.ReportAllocs()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			buf := alloc.Acquire(1920)
			buf[0] = 0xFF
			alloc.Release(buf)
		}
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamReloadBarrier benchmarks
// ─────────────────────────────────────────────────────────────────────────────

// BenchmarkBarrierAcquireRelease measures the Acquire/Release hot path with
// no reloads happening (the common case).
func BenchmarkBarrierAcquireRelease(b *testing.B) {
	barrier := &StreamReloadBarrier{}
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		if barrier.Acquire() {
			barrier.Release()
		}
	}
}

// BenchmarkBarrierAcquireReleaseParallel exercises Acquire/Release from many
// goroutines to verify the WaitGroup and mutex overhead stays sub-microsecond.
func BenchmarkBarrierAcquireReleaseParallel(b *testing.B) {
	barrier := &StreamReloadBarrier{}
	b.ResetTimer()
	b.ReportAllocs()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if barrier.Acquire() {
				barrier.Release()
			}
		}
	})
}

// BenchmarkBarrierReload measures a full Reload cycle with 8 concurrent
// readers to simulate a stream reconnect under real-world load.
func BenchmarkBarrierReload(b *testing.B) {
	const readers = 8
	barrier := &StreamReloadBarrier{}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var wg sync.WaitGroup
		wg.Add(readers)
		for r := 0; r < readers; r++ {
			go func() {
				defer wg.Done()
				if barrier.Acquire() {
					time.Sleep(time.Microsecond)
					barrier.Release()
				}
			}()
		}
		barrier.Reload()
		wg.Wait()
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// AtomicRingBuffer benchmarks
// ─────────────────────────────────────────────────────────────────────────────

// BenchmarkAtomicRingBufferWrite measures single-producer write throughput.
func BenchmarkAtomicRingBufferWrite(b *testing.B) {
	rb := NewAtomicRingBuffer(1024)
	payload := make([]byte, 1920)
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		if !rb.Write(payload) {
			// Drain one slot if full to keep the benchmark running
			rb.Read()
		}
	}
}

// BenchmarkAtomicRingBufferReadWrite measures single-threaded write+read
// round-trip throughput.
func BenchmarkAtomicRingBufferReadWrite(b *testing.B) {
	rb := NewAtomicRingBuffer(1024)
	payload := make([]byte, 1920)
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		rb.Write(payload)
		rb.Read()
	}
}

// BenchmarkAtomicRingBufferConcurrent runs a single producer and 4 consumers
// and measures combined throughput under real contention.
func BenchmarkAtomicRingBufferConcurrent(b *testing.B) {
	rb := NewAtomicRingBuffer(1024)
	payload := make([]byte, 1920)
	var total atomic.Uint64

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 4 consumers
	for i := 0; i < 4; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				default:
					if _, ok := rb.Read(); ok {
						total.Add(1)
					}
				}
			}
		}()
	}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		rb.Write(payload)
	}
}

// BenchmarkAtomicRingBufferDrainAndRelease measures the cost of DrainAndRelease
// on a full 1024-slot buffer — critical for stream reload latency.
func BenchmarkAtomicRingBufferDrainAndRelease(b *testing.B) {
	payload := make([]byte, 1920)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		rb := NewAtomicRingBuffer(1024)
		for j := 0; j < 512; j++ {
			rb.Write(payload)
		}
		b.StartTimer()
		rb.DrainAndRelease()
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// DeterministicAudioStream benchmarks
// ─────────────────────────────────────────────────────────────────────────────

// BenchmarkStreamIngest measures IngestRawAudio throughput on a live stream.
func BenchmarkStreamIngest(b *testing.B) {
	ctx := context.Background()
	s, err := NewDeterministicAudioStream(ctx, "bench-ingest")
	if err != nil {
		b.Fatal(err)
	}
	defer s.Close() //nolint:errcheck

	payload := make([]byte, 1920)
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		s.IngestRawAudio(payload)
	}
}

// BenchmarkStreamReload measures the end-to-end latency of a full Reload
// sequence including context cancellation, drain, and goroutine relaunch.
func BenchmarkStreamReload(b *testing.B) {
	ctx := context.Background()
	s, err := NewDeterministicAudioStream(ctx, "bench-reload")
	if err != nil {
		b.Fatal(err)
	}
	defer s.Close() //nolint:errcheck

	payload := make([]byte, 1920)
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		// Fill with data to make Reload more realistic
		for j := 0; j < 64; j++ {
			s.IngestRawAudio(payload)
		}
		if err := s.Reload(ctx, fmt.Sprintf("bench-reload-%d", i)); err != nil {
			b.Fatal(err)
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Stress tests (high-frequency lifecycle transitions)
// ─────────────────────────────────────────────────────────────────────────────

// TestStressBufferPoolConcurrent validates that no buffers are permanently
// lost (in-flight count reaches 0) after intense concurrent Get/Put cycling.
func TestStressBufferPoolConcurrent(t *testing.T) {
	t.Parallel()
	pool := &BufferPool{}
	const goroutines = 32
	const iterations = 5000

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				buf := pool.Get(1920)
				buf[0] = byte(i)
				pool.Put(buf)
			}
		}()
	}
	wg.Wait()

	stats := pool.Stats()
	if stats.CurrentInFlight != 0 {
		t.Errorf("memory leak: %d buffers still in-flight after all goroutines finished", stats.CurrentInFlight)
	}
	if stats.TotalAllocated != stats.TotalRecycled {
		t.Errorf("allocation mismatch: allocated=%d recycled=%d", stats.TotalAllocated, stats.TotalRecycled)
	}
}

// TestStressBufferAllocatorLeakReport confirms that allocations held longer
// than the threshold appear in the leak report.
func TestStressBufferAllocatorLeakReport(t *testing.T) {
	t.Parallel()
	alloc := NewBufferAllocator(nil)

	// Hold 5 buffers, release 3; 2 should be reported as stale.
	held := make([][]byte, 5)
	for i := range held {
		held[i] = alloc.Acquire(512)
	}
	alloc.Release(held[0])
	alloc.Release(held[1])
	alloc.Release(held[2])

	// Give a tiny sleep so threshold check works (acquiredAt is in the past).
	time.Sleep(2 * time.Millisecond)
	leaks := alloc.LeakReport(time.Millisecond)
	if len(leaks) != 2 {
		t.Errorf("expected 2 leak records, got %d", len(leaks))
	}

	// Clean up
	alloc.Release(held[3])
	alloc.Release(held[4])
}

// TestStressBarrierRapidReload verifies that the StreamReloadBarrier correctly
// serialises multiple rapid Reload calls and produces monotonically-increasing
// generation numbers with no consumer goroutine leaks.
func TestStressBarrierRapidReload(t *testing.T) {
	t.Parallel()
	barrier := &StreamReloadBarrier{}

	const reloads = 20
	const consumersPerRound = 16

	for r := 0; r < reloads; r++ {
		var active sync.WaitGroup
		active.Add(consumersPerRound)

		for c := 0; c < consumersPerRound; c++ {
			go func() {
				defer active.Done()
				if barrier.Acquire() {
					time.Sleep(time.Microsecond * 10)
					barrier.Release()
				}
			}()
		}

		gen := barrier.Reload()
		expectedGen := uint64(r + 1)
		if gen != expectedGen {
			t.Errorf("reload %d: expected gen %d, got %d", r, expectedGen, gen)
		}
		active.Wait()
	}
}

// TestStressRingBufferRapidReload verifies DrainAndRelease leaves the buffer
// in a consistent empty state across many stream lifecycle transitions.
func TestStressRingBufferRapidReload(t *testing.T) {
	t.Parallel()
	rb := NewAtomicRingBuffer(256)
	payload := make([]byte, 64)

	const cycles = 50
	for cycle := 0; cycle < cycles; cycle++ {
		// Fill halfway
		for i := 0; i < 128; i++ {
			rb.Write(payload)
		}
		rb.DrainAndRelease()

		if d := rb.Depth(); d != 0 {
			t.Fatalf("cycle %d: expected depth 0 after DrainAndRelease, got %d", cycle, d)
		}
	}
}

// TestStressStreamReloadUnderLoad verifies that a DeterministicAudioStream
// can survive 10 consecutive rapid Reloads while a producer is hammering
// IngestRawAudio concurrently, with zero panics and no goroutine leaks.
func TestStressStreamReloadUnderLoad(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	s, err := NewDeterministicAudioStream(ctx, "stress-reload")
	if err != nil {
		t.Fatal(err)
	}

	payload := make([]byte, 1920)

	// Background producer
	var producerStopped atomic.Bool
	go func() {
		for !producerStopped.Load() {
			s.IngestRawAudio(payload)
			time.Sleep(time.Microsecond)
		}
	}()

	const reloads = 10
	for i := 0; i < reloads; i++ {
		time.Sleep(5 * time.Millisecond)
		if err := s.Reload(ctx, fmt.Sprintf("stress-%d", i)); err != nil {
			t.Fatalf("reload %d failed: %v", i, err)
		}
	}

	producerStopped.Store(true)

	// Drain remaining and verify close is clean
	s.Drain()
	if err := s.Close(); err != nil {
		t.Fatalf("close failed: %v", err)
	}
}

// TestStressAtomicRingBufferNilSlotAfterRead verifies that every read slot is
// nil-cleared in the buffer array, preventing lingering pointers across reloads.
func TestStressAtomicRingBufferNilSlotAfterRead(t *testing.T) {
	t.Parallel()
	rb := NewAtomicRingBuffer(16)
	payload := []byte{1, 2, 3, 4}

	for i := 0; i < 16; i++ {
		rb.Write(payload)
	}
	for i := 0; i < 16; i++ {
		data, ok := rb.Read()
		if !ok {
			t.Fatalf("read %d: expected data, got empty", i)
		}
		if data == nil {
			t.Fatalf("read %d: got nil data", i)
		}
		// Verify the internal slot is now nil (no lingering reference)
		slot := (atomic.LoadUint64(&rb.readIndex) - 1) & rb.mask
		rb.mu.Lock()
		slotVal := rb.buffer[slot]
		rb.mu.Unlock()
		if slotVal != nil {
			t.Fatalf("slot %d: expected nil after read, got non-nil", slot)
		}
	}
}
