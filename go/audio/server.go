package main

import (
	"context"
	"fmt"
	"net"
	"sync"
)

// LearnerServer wraps LearnerService registration and network server lifecycle.
type LearnerServer struct {
	mu             sync.Mutex
	learnerService *LearnerService
	listener       net.Listener
	isServing      bool
}

// NewLearnerServer creates a new LearnerServer registering LearnerService.
func NewLearnerServer(service *LearnerService) *LearnerServer {
	if service == nil {
		service = NewLearnerService()
	}
	return &LearnerServer{
		learnerService: service,
	}
}

// Service returns the underlying LearnerService instance.
func (s *LearnerServer) Service() *LearnerService {
	return s.learnerService
}

// Start initializes the Go audio learner server listener on a given address.
func (s *LearnerServer) Start(addr string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isServing {
		return nil
	}

	if addr == "" {
		addr = ":9095"
	}

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to start LearnerServer listener: %w", err)
	}

	s.listener = lis
	s.isServing = true

	go func() {
		for {
			conn, err := lis.Accept()
			if err != nil {
				s.mu.Lock()
				serving := s.isServing
				s.mu.Unlock()
				if !serving {
					return
				}
				continue
			}
			_ = conn.Close()
		}
	}()

	return nil
}

// Stop gracefully shuts down the LearnerServer listener.
func (s *LearnerServer) Stop(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isServing {
		return nil
	}

	s.isServing = false
	if s.listener != nil {
		_ = s.listener.Close()
		s.listener = nil
	}
	return nil
}
