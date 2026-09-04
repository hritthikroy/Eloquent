//go:build windows

package state

import (
	"fmt"
	"os"
)

// WindowsFileSegment implements MemorySegment backed by a synchronized file on Windows.
type WindowsFileSegment struct {
	file *os.File
	data []byte
	path string
}

// OpenSharedMemorySegment opens or creates a shared memory segment file on Windows.
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
		return nil, fmt.Errorf("failed to open shared memory file %s on Windows: %w", path, err)
	}

	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to stat shared memory file: %w", err)
	}

	if info.Size() < int64(size) {
		if err := file.Truncate(int64(size)); err != nil {
			file.Close()
			return nil, fmt.Errorf("failed to truncate shared memory file: %w", err)
		}
	}

	data := make([]byte, size)
	if _, err := file.ReadAt(data, 0); err != nil && info.Size() > 0 {
		// Non-fatal if newly created empty file
	}

	return &WindowsFileSegment{
		file: file,
		data: data,
		path: path,
	}, nil
}

func (s *WindowsFileSegment) Bytes() []byte {
	return s.data
}

func (s *WindowsFileSegment) Sync() error {
	if s.file != nil && len(s.data) > 0 {
		_, err := s.file.WriteAt(s.data, 0)
		if err != nil {
			return err
		}
		return s.file.Sync()
	}
	return nil
}

func (s *WindowsFileSegment) Close() error {
	var syncErr error
	if s.file != nil {
		syncErr = s.Sync()
		closeErr := s.file.Close()
		s.file = nil
		if syncErr != nil {
			return syncErr
		}
		return closeErr
	}
	return nil
}
