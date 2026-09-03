package services

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// MemoryBridgeService provides Unix socket interface for shared memory access
// Allows Go audio backend to read/write agent state without Node.js serialization overhead
type MemoryBridgeService struct {
	socketPath    string
	listener      net.Listener
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	mu            sync.RWMutex
	stateCache    map[string]*AgentStateCache
	cacheExpiry   time.Duration
	maxBufferSize int
}

// AgentStateCache represents cached agent state
type AgentStateCache struct {
	AgentID     string          `json:"agent_id"`
	State       json.RawMessage `json:"state"`
	Version     uint32          `json:"version"`
	LastUpdated int64           `json:"last_updated"`
	ExpiresAt   time.Time       `json:"expires_at"`
}

// MessageType represents the type of IPC message
type MessageType uint8

const (
	MessageTypeReadRequest   MessageType = 0x01
	MessageTypeReadResponse  MessageType = 0x02
	MessageTypeWriteRequest  MessageType = 0x03
	MessageTypeWriteResponse MessageType = 0x04
	MessageTypeListRequest   MessageType = 0x05
	MessageTypeListResponse  MessageType = 0x06
	MessageTypeError         MessageType = 0xFF
)

// Message represents a memory bridge protocol message
type Message struct {
	Type    MessageType     `json:"type"`
	AgentID string          `json:"agent_id,omitempty"`
	State   json.RawMessage `json:"state,omitempty"`
	Version uint32          `json:"version,omitempty"`
	Error   string          `json:"error,omitempty"`
	Agents  []AgentMetadata `json:"agents,omitempty"`
}

// AgentMetadata represents agent metadata
type AgentMetadata struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     uint32 `json:"version"`
	LastUpdated int64  `json:"last_updated"`
	DataLength  uint32 `json:"data_length"`
}

// NewMemoryBridgeService creates a new memory bridge service
func NewMemoryBridgeService(socketPath string) *MemoryBridgeService {
	if socketPath == "" {
		socketPath = filepath.Join(os.TempDir(), "eloquent-memory-bridge.sock")
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &MemoryBridgeService{
		socketPath:    socketPath,
		ctx:           ctx,
		cancel:        cancel,
		stateCache:    make(map[string]*AgentStateCache),
		cacheExpiry:   5 * time.Second, // Cache for 5 seconds
		maxBufferSize: 1024 * 1024,     // 1MB max message size
	}
}

// Start begins listening on the Unix socket
func (s *MemoryBridgeService) Start() error {
	// Remove existing socket file if it exists
	if err := os.Remove(s.socketPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove existing socket: %w", err)
	}

	// Create Unix socket listener
	listener, err := net.Listen("unix", s.socketPath)
	if err != nil {
		return fmt.Errorf("failed to create Unix socket: %w", err)
	}

	s.listener = listener

	// Set socket permissions (owner read/write only)
	if err := os.Chmod(s.socketPath, 0600); err != nil {
		listener.Close()
		return fmt.Errorf("failed to set socket permissions: %w", err)
	}

	// Start accepting connections
	s.wg.Add(1)
	go s.acceptLoop()

	// Start cache cleanup routine
	s.wg.Add(1)
	go s.cacheCleanupLoop()

	return nil
}

// Stop gracefully shuts down the memory bridge service
func (s *MemoryBridgeService) Stop() error {
	s.cancel()

	if s.listener != nil {
		s.listener.Close()
	}

	// Wait for goroutines to finish
	s.wg.Wait()

	// Remove socket file
	os.Remove(s.socketPath)

	return nil
}

// acceptLoop accepts incoming connections
func (s *MemoryBridgeService) acceptLoop() {
	defer s.wg.Done()

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		conn, err := s.listener.Accept()
		if err != nil {
			select {
			case <-s.ctx.Done():
				return
			default:
				continue
			}
		}

		// Handle connection in goroutine
		s.wg.Add(1)
		go s.handleConnection(conn)
	}
}

// handleConnection processes a single client connection
func (s *MemoryBridgeService) handleConnection(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	// Set read/write timeouts
	conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(30 * time.Second))

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		// Read message
		msg, err := s.readMessage(conn)
		if err != nil {
			if err != io.EOF && !errors.Is(err, net.ErrClosed) {
				s.sendError(conn, fmt.Sprintf("read error: %v", err))
			}
			return
		}

		// Process message
		response := s.processMessage(msg)

		// Send response
		if err := s.writeMessage(conn, response); err != nil {
			return
		}

		// Reset deadline after successful operation
		conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
	}
}

// readMessage reads a message from the connection
// Protocol: [4 bytes length][payload]
func (s *MemoryBridgeService) readMessage(conn net.Conn) (*Message, error) {
	// Read length prefix (4 bytes, little-endian)
	var length uint32
	if err := binary.Read(conn, binary.LittleEndian, &length); err != nil {
		return nil, err
	}

	// Validate length
	if length == 0 || length > uint32(s.maxBufferSize) {
		return nil, fmt.Errorf("invalid message length: %d", length)
	}

	// Read payload
	payload := make([]byte, length)
	if _, err := io.ReadFull(conn, payload); err != nil {
		return nil, err
	}

	// Decode JSON
	var msg Message
	if err := json.Unmarshal(payload, &msg); err != nil {
		return nil, fmt.Errorf("invalid message format: %w", err)
	}

	return &msg, nil
}

// writeMessage writes a message to the connection
func (s *MemoryBridgeService) writeMessage(conn net.Conn, msg *Message) error {
	// Encode JSON
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	// Write length prefix
	length := uint32(len(payload))
	if err := binary.Write(conn, binary.LittleEndian, length); err != nil {
		return err
	}

	// Write payload
	if _, err := conn.Write(payload); err != nil {
		return err
	}

	return nil
}

// processMessage handles a message and returns a response
func (s *MemoryBridgeService) processMessage(msg *Message) *Message {
	switch msg.Type {
	case MessageTypeReadRequest:
		return s.handleReadRequest(msg)
	case MessageTypeWriteRequest:
		return s.handleWriteRequest(msg)
	case MessageTypeListRequest:
		return s.handleListRequest(msg)
	default:
		return &Message{
			Type:  MessageTypeError,
			Error: fmt.Sprintf("unknown message type: %d", msg.Type),
		}
	}
}

// handleReadRequest processes a read request
func (s *MemoryBridgeService) handleReadRequest(msg *Message) *Message {
	if msg.AgentID == "" {
		return &Message{
			Type:  MessageTypeError,
			Error: "agent_id is required",
		}
	}

	// Check cache first
	s.mu.RLock()
	cached, exists := s.stateCache[msg.AgentID]
	s.mu.RUnlock()

	if exists && time.Now().Before(cached.ExpiresAt) {
		return &Message{
			Type:    MessageTypeReadResponse,
			AgentID: cached.AgentID,
			State:   cached.State,
			Version: cached.Version,
		}
	}

	// Cache miss - would need to call into Node.js via IPC
	// For now, return error indicating state not available
	// In production, this would use a callback mechanism to Node.js
	return &Message{
		Type:  MessageTypeError,
		Error: fmt.Sprintf("agent state not in cache: %s (implement Node.js IPC bridge)", msg.AgentID),
	}
}

// handleWriteRequest processes a write request
func (s *MemoryBridgeService) handleWriteRequest(msg *Message) *Message {
	if msg.AgentID == "" {
		return &Message{
			Type:  MessageTypeError,
			Error: "agent_id is required",
		}
	}

	if len(msg.State) == 0 {
		return &Message{
			Type:  MessageTypeError,
			Error: "state is required",
		}
	}

	// Update cache
	s.mu.Lock()
	s.stateCache[msg.AgentID] = &AgentStateCache{
		AgentID:     msg.AgentID,
		State:       msg.State,
		Version:     msg.Version + 1,
		LastUpdated: time.Now().UnixMilli(),
		ExpiresAt:   time.Now().Add(s.cacheExpiry),
	}
	s.mu.Unlock()

	// In production, this would propagate to Node.js via IPC
	// For now, just acknowledge the write
	return &Message{
		Type:    MessageTypeWriteResponse,
		AgentID: msg.AgentID,
		Version: msg.Version + 1,
	}
}

// handleListRequest processes a list request
func (s *MemoryBridgeService) handleListRequest(msg *Message) *Message {
	s.mu.RLock()
	defer s.mu.RUnlock()

	agents := make([]AgentMetadata, 0, len(s.stateCache))
	for _, cached := range s.stateCache {
		if time.Now().Before(cached.ExpiresAt) {
			agents = append(agents, AgentMetadata{
				ID:          cached.AgentID,
				Name:        cached.AgentID,
				Version:     cached.Version,
				LastUpdated: cached.LastUpdated,
				DataLength:  uint32(len(cached.State)),
			})
		}
	}

	return &Message{
		Type:   MessageTypeListResponse,
		Agents: agents,
	}
}

// sendError sends an error message
func (s *MemoryBridgeService) sendError(conn net.Conn, errorMsg string) {
	msg := &Message{
		Type:  MessageTypeError,
		Error: errorMsg,
	}
	s.writeMessage(conn, msg)
}

// cacheCleanupLoop periodically cleans expired cache entries
func (s *MemoryBridgeService) cacheCleanupLoop() {
	defer s.wg.Done()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.cleanupExpiredCache()
		}
	}
}

// cleanupExpiredCache removes expired cache entries
func (s *MemoryBridgeService) cleanupExpiredCache() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for agentID, cached := range s.stateCache {
		if now.After(cached.ExpiresAt) {
			delete(s.stateCache, agentID)
		}
	}
}

// UpdateCache updates the cache with new state (called from Node.js IPC)
func (s *MemoryBridgeService) UpdateCache(agentID string, state json.RawMessage, version uint32) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stateCache[agentID] = &AgentStateCache{
		AgentID:     agentID,
		State:       state,
		Version:     version,
		LastUpdated: time.Now().UnixMilli(),
		ExpiresAt:   time.Now().Add(s.cacheExpiry),
	}
}

// GetSocketPath returns the Unix socket path
func (s *MemoryBridgeService) GetSocketPath() string {
	return s.socketPath
}

// ReadAgentState reads agent state from cache (synchronous, cache-only)
func (s *MemoryBridgeService) ReadAgentState(agentID string) (json.RawMessage, uint32, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cached, exists := s.stateCache[agentID]
	if !exists {
		return nil, 0, fmt.Errorf("agent not in cache: %s", agentID)
	}

	if time.Now().After(cached.ExpiresAt) {
		return nil, 0, fmt.Errorf("cached state expired for agent: %s", agentID)
	}

	return cached.State, cached.Version, nil
}

// WriteAgentState writes agent state to cache (will be synced to shared memory)
func (s *MemoryBridgeService) WriteAgentState(agentID string, state json.RawMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cached, exists := s.stateCache[agentID]
	version := uint32(0)
	if exists {
		version = cached.Version
	}

	s.stateCache[agentID] = &AgentStateCache{
		AgentID:     agentID,
		State:       state,
		Version:     version + 1,
		LastUpdated: time.Now().UnixMilli(),
		ExpiresAt:   time.Now().Add(s.cacheExpiry),
	}

	return nil
}

// GetCachedAgents returns list of cached agents
func (s *MemoryBridgeService) GetCachedAgents() []AgentMetadata {
	s.mu.RLock()
	defer s.mu.RUnlock()

	agents := make([]AgentMetadata, 0, len(s.stateCache))
	now := time.Now()

	for _, cached := range s.stateCache {
		if now.Before(cached.ExpiresAt) {
			agents = append(agents, AgentMetadata{
				ID:          cached.AgentID,
				Name:        cached.AgentID,
				Version:     cached.Version,
				LastUpdated: cached.LastUpdated,
				DataLength:  uint32(len(cached.State)),
			})
		}
	}

	return agents
}
