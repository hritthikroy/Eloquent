package state

// InMemorySegment implements MemorySegment in pure RAM without filesystem access.
// Useful for isolated unit testing, mocking, and environments with restricted filesystems.
type InMemorySegment struct {
	data   []byte
	closed bool
}

// NewInMemorySegment creates a pure in-memory segment of the specified size.
func NewInMemorySegment(size int) *InMemorySegment {
	if size <= 0 {
		size = TotalSegmentSize
	}
	return &InMemorySegment{
		data: make([]byte, size),
	}
}

func (s *InMemorySegment) Bytes() []byte {
	return s.data
}

func (s *InMemorySegment) Sync() error {
	return nil
}

func (s *InMemorySegment) Close() error {
	s.closed = true
	return nil
}

// Ensure interface compliance
var _ MemorySegment = (*InMemorySegment)(nil)
