// Package state provides thread-safe conversational state persistence
// and synchronization across the Go audio backend, Electron, and UI renderer.
package state

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// TurnContext represents an individual conversational dialogue turn.
type TurnContext struct {
	Speaker   string                 `json:"speaker"`
	Text      string                 `json:"text"`
	Timestamp int64                  `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// RateLimitInfo tracks dynamic API throttling and token quotas.
type RateLimitInfo struct {
	RequestsRemaining int   `json:"requestsRemaining"`
	ResetTimestamp    int64 `json:"resetTimestamp"`
	IsThrottled       bool  `json:"isThrottled"`
	BackoffMs         int   `json:"backoffMs,omitempty"`
}

// ConversationalState is the root state schema matching config/stateSchema.json.
type ConversationalState struct {
	TurnID               string         `json:"turnId"`
	Participants         []string       `json:"participants"`
	LastMessageTimestamp int64          `json:"lastMessageTimestamp"`
	ContextBuffer        []TurnContext  `json:"contextBuffer"`
	RateLimitInfo        RateLimitInfo  `json:"rateLimitInfo"`
}

// StateManager provides thread-safe, concurrent access to conversational state
// with atomic disk persistence.
type StateManager struct {
	mu        sync.RWMutex
	state     ConversationalState
	filePath  string
	maxTurns  int
}

// NewStateManager initializes a StateManager targeting a specific state JSON path.
func NewStateManager(filePath string) (*StateManager, error) {
	if filePath == "" {
		filePath = filepath.Join("userData", "state.json")
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create state directory: %w", err)
	}

	sm := &StateManager{
		filePath: filePath,
		maxTurns: 50,
	}

	sm.state = ConversationalState{
		TurnID:               fmt.Sprintf("turn-%d", time.Now().UnixMilli()),
		Participants:         []string{"user", "Tuk Tuk", "Andrew"},
		LastMessageTimestamp: time.Now().UnixMilli(),
		ContextBuffer:        make([]TurnContext, 0),
		RateLimitInfo: RateLimitInfo{
			RequestsRemaining: 60,
			ResetTimestamp:    time.Now().Add(1 * time.Minute).UnixMilli(),
			IsThrottled:       false,
			BackoffMs:         0,
		},
	}

	_ = sm.LoadState()
	return sm, nil
}

// GetState returns a deep copy of current conversational state thread-safely.
func (sm *StateManager) GetState() ConversationalState {
	sm.mu.Lock()
	sm.checkAndResetRateLimitsLocked()
	copyState := sm.cloneStateLocked()
	sm.mu.Unlock()
	return copyState
}

// SetState updates the complete state atomically and saves to disk.
func (sm *StateManager) SetState(newState ConversationalState) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.state = newState
	sm.checkAndResetRateLimitsLocked()
	return sm.saveStateAtomicLocked()
}

// UpdateTurn records a new conversational turn and persists state atomically.
func (sm *StateManager) UpdateTurn(ctx TurnContext) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.checkAndResetRateLimitsLocked()

	if ctx.Timestamp == 0 {
		ctx.Timestamp = time.Now().UnixMilli()
	}

	sm.state.ContextBuffer = append(sm.state.ContextBuffer, ctx)
	if len(sm.state.ContextBuffer) > sm.maxTurns {
		sm.state.ContextBuffer = sm.state.ContextBuffer[len(sm.state.ContextBuffer)-sm.maxTurns:]
	}

	sm.state.LastMessageTimestamp = ctx.Timestamp
	sm.state.TurnID = fmt.Sprintf("turn-%d", time.Now().UnixMilli())

	return sm.saveStateAtomicLocked()
}

// LoadState loads conversational state from disk, recovering if file is missing or corrupted.
func (sm *StateManager) LoadState() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	data, err := os.ReadFile(sm.filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return sm.saveStateAtomicLocked()
		}
		return err
	}

	if len(data) == 0 {
		return sm.saveStateAtomicLocked()
	}

	var loaded ConversationalState
	if err := json.Unmarshal(data, &loaded); err != nil {
		return sm.saveStateAtomicLocked()
	}

	sm.state = loaded
	sm.checkAndResetRateLimitsLocked()
	return nil
}

func (sm *StateManager) checkAndResetRateLimitsLocked() {
	now := time.Now().UnixMilli()
	if now >= sm.state.RateLimitInfo.ResetTimestamp {
		sm.state.RateLimitInfo.IsThrottled = false
		sm.state.RateLimitInfo.RequestsRemaining = 60
		sm.state.RateLimitInfo.ResetTimestamp = now + 60000
		sm.state.RateLimitInfo.BackoffMs = 0
	}
}

func (sm *StateManager) saveStateAtomicLocked() error {
	data, err := json.MarshalIndent(sm.state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal state: %w", err)
	}

	tempPath := fmt.Sprintf("%s.tmp.%d", sm.filePath, time.Now().UnixNano())
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write temp state file: %w", err)
	}

	if err := os.Rename(tempPath, sm.filePath); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("failed to atomically rename state file: %w", err)
	}

	return nil
}

func (sm *StateManager) cloneStateLocked() ConversationalState {
	cloned := sm.state
	cloned.Participants = append([]string(nil), sm.state.Participants...)
	cloned.ContextBuffer = append([]TurnContext(nil), sm.state.ContextBuffer...)
	return cloned
}

type GetStateRequest struct{}
type SetStateRequest struct {
	State ConversationalState `json:"state"`
}
type SetStateResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type ServiceBridge struct {
	manager *StateManager
}

func NewServiceBridge(manager *StateManager) *ServiceBridge {
	return &ServiceBridge{manager: manager}
}

func (s *ServiceBridge) GetState(ctx context.Context, _ *GetStateRequest) (*ConversationalState, error) {
	st := s.manager.GetState()
	return &st, nil
}

func (s *ServiceBridge) SetState(ctx context.Context, req *SetStateRequest) (*SetStateResponse, error) {
	if req == nil {
		return &SetStateResponse{Success: false, Error: "request payload nil"}, errors.New("request nil")
	}
	if err := s.manager.SetState(req.State); err != nil {
		return &SetStateResponse{Success: false, Error: err.Error()}, err
	}
	return &SetStateResponse{Success: true}, nil
}
