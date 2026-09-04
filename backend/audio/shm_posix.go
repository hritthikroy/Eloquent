//go:build !windows

package state

import (
	"fmt"
	"os"
	"syscall"
)

// PosixMmapSegment implements MemorySegment backed by a memory-mapped file or /dev/shm.
type PosixMmapSegment struct {
	file *os.File
	data []byte
	path string
}

// OpenSharedMemorySegment opens or creates a memory-mapped shared memory file.
func OpenSharedMemorySegment(path string, size int, create bool) (MemorySegment, error) {
	if size <= 0 {
		size = TotalSegmentSize
	}

	flags := os.O_RDWR
	if create {
		flags |= os.O_CREATE
	}

	file, err := os.OpenFile(path, flags, 0666)
	if err != nil {
		return nil, fmt.Errorf("failed to open shared memory file %s: %w", path, err)
	}

	// Ensure file is at least 'size' bytes
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to stat shared memory file: %w", err)
	}

	if info.Size() < int64(size) {
		if err := file.Truncate(int64(size)); err != nil {
			file.Close()
			return nil, fmt.Errorf("failed to truncate shared memory file to %d bytes: %w", size, err)
		}
	}

	// Memory map the segment
	data, err := syscall.Mmap(int(file.Fd()), 0, size, syscall.PROT_READ|syscall.PROT_WRITE, syscall.MAP_SHARED)
	if err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to mmap shared memory file: %w", err)
	}

	return &PosixMmapSegment{
		file: file,
		data: data,
		path: path,
	}, nil
}

// Bytes returns the direct memory-mapped byte slice.
func (s *PosixMmapSegment) Bytes() []byte {
	return s.data
}

// Sync flushes memory dirty pages.
func (s *PosixMmapSegment) Sync() error {
	if s.file != nil {
		return s.file.Sync()
	}
	return nil
}

// Close unmaps memory and closes file descriptor.
func (s *PosixMmapSegment) Close() error {
	var mmapErr, fileErr error
	if len(s.data) > 0 {
		mmapErr = syscall.Munmap(s.data)
		s.data = nil
	}
	if s.file != nil {
		fileErr = s.file.Close()
		s.file = nil
	}
	if mmapErr != nil {
		return mmapErr
	}
	return fileErr
}
