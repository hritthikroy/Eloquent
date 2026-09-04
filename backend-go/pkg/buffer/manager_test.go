package buffer

import (
	"sync"
	"testing"
	"time"
	"unsafe"
)

func TestAllocAligned(t *testing.T) {
	sizes := []int{64, 128, 512, 1024, 1920, 4096}
	for _, size := range sizes {
		buf, err := AllocAligned(size)
		if err != nil {
			t.Fatalf("AllocAligned(%d) failed: %v", size, err)
		}
		if len(buf) != size {
			t.Fatalf("expected len %d, got %d", size, len(buf))
		}
		ptr := uintptr(unsafe.Pointer(&buf[0]))
		if !IsAligned(ptr, AlignSize) {
			t.Fatalf("ptr 0x%x is not aligned to %d bytes", ptr, AlignSize)
		}
	}
}

func TestAlignedBufferManager_AcquireRelease(t *testing.T) {
	mgr := NewAlignedBufferManager(1920)
	defer mgr.Close()

	buf, err := mgr.Acquire()
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}
	if len(buf) != 1920 {
		t.Fatalf("expected buffer length 1920, got %d", len(buf))
	}

	ptr := uintptr(unsafe.Pointer(&buf[0]))
	if !IsAligned(ptr, AlignSize) {
		t.Fatalf("acquired buffer pointer 0x%x is not aligned to %d", ptr, AlignSize)
	}

	stats := mgr.Stats()
	if stats.InFlight != 1 || stats.Acquired != 1 {
		t.Fatalf("unexpected stats: %+v", stats)
	}

	mgr.Release(buf)
	stats = mgr.Stats()
	if stats.InFlight != 0 || stats.Released != 1 {
		t.Fatalf("expected 0 inFlight after release, got: %+v", stats)
	}
}

func TestAlignedBufferManager_LeakDetection(t *testing.T) {
	mgr := NewAlignedBufferManager(1024)
	defer mgr.Close()

	buf, err := mgr.Acquire()
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}

	time.Sleep(10 * time.Millisecond)
	leaks := mgr.LeakedBuffers(5 * time.Millisecond)
	if len(leaks) != 1 {
		t.Fatalf("expected 1 leak detected, got %d", len(leaks))
	}

	mgr.Release(buf)
	leaks = mgr.LeakedBuffers(5 * time.Millisecond)
	if len(leaks) != 0 {
		t.Fatalf("expected 0 leaks after release, got %d", len(leaks))
	}
}

func TestAlignedBufferManager_ParallelStress(t *testing.T) {
	mgr := NewAlignedBufferManager(1920)
	defer mgr.Close()

	var wg sync.WaitGroup
	workers := 16
	iterations := 1000

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				b, err := mgr.Acquire()
				if err != nil {
					t.Errorf("Acquire failed: %v", err)
					return
				}
				b[0] = 0xAA
				b[len(b)-1] = 0xBB
				mgr.Release(b)
			}
		}()
	}

	wg.Wait()
	stats := mgr.Stats()
	if stats.InFlight != 0 {
		t.Fatalf("inFlight should be 0, got %d", stats.InFlight)
	}
	if stats.AlignmentFails != 0 {
		t.Fatalf("expected 0 alignment fails, got %d", stats.AlignmentFails)
	}
}
