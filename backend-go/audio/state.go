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

	// Initialize default state
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
		// Recover safely on corrupted JSON
		return sm.saveStateAtomicLocked()
	}

	sm.state = loaded
	sm.checkAndResetRateLimitsLocked()
	return nil
}

// checkAndResetRateLimitsLocked resets rate-limit counters if window elapsed.
func (sm *StateManager) checkAndResetRateLimitsLocked() {
	now := time.Now().UnixMilli()
	if now >= sm.state.RateLimitInfo.ResetTimestamp {
		sm.state.RateLimitInfo.IsThrottled = false
		sm.state.RateLimitInfo.RequestsRemaining = 60
		sm.state.RateLimitInfo.ResetTimestamp = now + 60000
		sm.state.RateLimitInfo.BackoffMs = 0
	}
}

// saveStateAtomicLocked writes state JSON to a unique temporary file then renames.
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

// cloneStateLocked returns a deep copy of sm.state.
func (sm *StateManager) cloneStateLocked() ConversationalState {
	cloned := sm.state
	cloned.Participants = append([]string(nil), sm.state.Participants...)
	cloned.ContextBuffer = append([]TurnContext(nil), sm.state.ContextBuffer...)
	return cloned
}

// RPC Service Interface implementations for gRPC / RPC bridges:

type GetStateRequest struct{}
type SetStateRequest struct {
	State ConversationalState `json:"state"`
}
type SetStateResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// ServiceBridge exposes GetState and SetState handlers compatible with context-driven RPCs.
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

// ConversationPhase defines the active phase of the conversation turn.
type ConversationPhase string

const (
	PhaseIdle        ConversationPhase = "idle"
	PhaseListening   ConversationPhase = "listening"
	PhaseThinking    ConversationPhase = "thinking"
	PhaseSpeaking    ConversationPhase = "speaking"
	PhaseError       ConversationPhase = "error"
	PhaseRehydrating ConversationPhase = "rehydrating"
)

// AudioStreamState tracks the hardware and buffer state of the audio pipeline.
type AudioStreamState string

const (
	AudioStreamInactive    AudioStreamState = "inactive"
	AudioStreamCapturing   AudioStreamState = "capturing"
	AudioStreamBuffering   AudioStreamState = "buffering"
	AudioStreamProcessing  AudioStreamState = "processing"
	AudioStreamSynthesizing AudioStreamState = "synthesizing"
	AudioStreamDraining    AudioStreamState = "draining"
)

// StateChangeEvent represents an event broadcast to subscribers on state change.
type StateChangeEvent struct {
	SessionID   string            `json:"sessionId"`
	PrevPhase   ConversationPhase `json:"prevPhase"`
	NewPhase    ConversationPhase `json:"newPhase"`
	Speaker     string            `json:"speaker"`
	AudioState  AudioStreamState  `json:"audioState"`
	Timestamp   int64             `json:"timestamp"`
	TurnSeq     int64             `json:"turnSeq"`
	RateLimited bool              `json:"rateLimited"`
}

var (
	// ErrInvalidPhaseTransition indicates an illegal edge in the conversation FSM.
	ErrInvalidPhaseTransition = errors.New("invalid conversation phase transition")
)

var validPhaseTransitions = map[ConversationPhase]map[ConversationPhase]bool{
	PhaseIdle: {
		PhaseListening:   true,
		PhaseThinking:    true,
		PhaseRehydrating: true,
	},
	PhaseListening: {
		PhaseThinking: true,
		PhaseIdle:     true,
		PhaseError:    true,
	},
	PhaseThinking: {
		PhaseSpeaking: true,
		PhaseIdle:     true,
		PhaseError:    true,
	},
	PhaseSpeaking: {
		PhaseIdle:      true,
		PhaseListening: true,
		PhaseError:     true,
	},
	PhaseError: {
		PhaseIdle: true,
	},
	PhaseRehydrating: {
		PhaseIdle: true,
	},
}

// SessionManager coordinates concurrency-safe conversation phases, audio stream states, and event broadcasting.
type SessionManager struct {
	mu            sync.RWMutex
	sessionID     string
	currentPhase  ConversationPhase
	audioState    AudioStreamState
	activeSpeaker string
	turnSeq       int64
	stateManager  *StateManager

	subscribersMu sync.RWMutex
	subscribers   map[chan StateChangeEvent]struct{}

	// Rate limit exponential backoff
	backoffMu     sync.RWMutex
	attemptCount  int
	baseBackoffMs int
	maxBackoffMs  int
	isThrottled   bool
	resetTime     time.Time
}

// NewSessionManager creates a SessionManager initialized to PhaseIdle and AudioStreamInactive.
func NewSessionManager(sessionID string, stateMgr *StateManager) *SessionManager {
	if sessionID == "" {
		sessionID = fmt.Sprintf("session-%d", time.Now().UnixMilli())
	}

	return &SessionManager{
		sessionID:     sessionID,
		currentPhase:  PhaseIdle,
		audioState:    AudioStreamInactive,
		activeSpeaker: "user",
		turnSeq:       0,
		stateManager:  stateMgr,
		subscribers:   make(map[chan StateChangeEvent]struct{}),
		baseBackoffMs: 500,
		maxBackoffMs:  30000,
		isThrottled:   false,
		resetTime:     time.Now(),
	}
}

// GetSessionID returns the unique session ID.
func (sm *SessionManager) GetSessionID() string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.sessionID
}

// GetCurrentPhase returns the active conversation phase.
func (sm *SessionManager) GetCurrentPhase() ConversationPhase {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.currentPhase
}

// GetAudioStreamState returns the current audio stream state.
func (sm *SessionManager) GetAudioStreamState() AudioStreamState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.audioState
}

// GetActiveSpeaker returns the participant currently holding the floor.
func (sm *SessionManager) GetActiveSpeaker() string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.activeSpeaker
}

// GetTurnSequence returns the monotonic turn sequence number.
func (sm *SessionManager) GetTurnSequence() int64 {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.turnSeq
}

// TransitionPhase validates the FSM transition and broadcasts the event to subscribers.
func (sm *SessionManager) TransitionPhase(newPhase ConversationPhase) error {
	sm.mu.Lock()
	prev := sm.currentPhase
	if prev == newPhase {
		sm.mu.Unlock()
		return nil
	}

	allowedTransitions, exists := validPhaseTransitions[prev]
	if !exists || !allowedTransitions[newPhase] {
		sm.mu.Unlock()
		return fmt.Errorf("%w: cannot transition from %s to %s", ErrInvalidPhaseTransition, prev, newPhase)
	}

	sm.currentPhase = newPhase
	event := StateChangeEvent{
		SessionID:   sm.sessionID,
		PrevPhase:   prev,
		NewPhase:    newPhase,
		Speaker:     sm.activeSpeaker,
		AudioState:  sm.audioState,
		Timestamp:   time.Now().UnixMilli(),
		TurnSeq:     sm.turnSeq,
		RateLimited: sm.isThrottledLocked(),
	}
	sm.mu.Unlock()

	sm.broadcastEvent(event)
	return nil
}

// SetAudioStreamState updates audio stream status and notifies subscribers.
func (sm *SessionManager) SetAudioStreamState(newState AudioStreamState) {
	sm.mu.Lock()
	sm.audioState = newState
	event := StateChangeEvent{
		SessionID:   sm.sessionID,
		PrevPhase:   sm.currentPhase,
		NewPhase:    sm.currentPhase,
		Speaker:     sm.activeSpeaker,
		AudioState:  newState,
		Timestamp:   time.Now().UnixMilli(),
		TurnSeq:     sm.turnSeq,
		RateLimited: sm.isThrottledLocked(),
	}
	sm.mu.Unlock()

	sm.broadcastEvent(event)
}

// RecordTurn records an active conversational turn with sequential ordering and persistence.
func (sm *SessionManager) RecordTurn(speaker, text string) (int64, error) {
	sm.mu.Lock()
	sm.turnSeq++
	seq := sm.turnSeq
	sm.activeSpeaker = speaker
	sm.mu.Unlock()

	turnCtx := TurnContext{
		Speaker:   speaker,
		Text:      text,
		Timestamp: time.Now().UnixMilli(),
		Metadata: map[string]interface{}{
			"turnSeq": seq,
		},
	}

	if sm.stateManager != nil {
		if err := sm.stateManager.UpdateTurn(turnCtx); err != nil {
			return seq, err
		}
	}

	sm.mu.RLock()
	event := StateChangeEvent{
		SessionID:   sm.sessionID,
		PrevPhase:   sm.currentPhase,
		NewPhase:    sm.currentPhase,
		Speaker:     speaker,
		AudioState:  sm.audioState,
		Timestamp:   turnCtx.Timestamp,
		TurnSeq:     seq,
		RateLimited: sm.isThrottledLocked(),
	}
	sm.mu.RUnlock()

	sm.broadcastEvent(event)
	return seq, nil
}

// SubscribeStateChanges returns a channel that receives state change events until ctx is cancelled.
func (sm *SessionManager) SubscribeStateChanges(ctx context.Context, bufferSize int) <-chan StateChangeEvent {
	if bufferSize <= 0 {
		bufferSize = 16
	}
	ch := make(chan StateChangeEvent, bufferSize)

	sm.subscribersMu.Lock()
	sm.subscribers[ch] = struct{}{}
	sm.subscribersMu.Unlock()

	go func() {
		<-ctx.Done()
		sm.subscribersMu.Lock()
		delete(sm.subscribers, ch)
		close(ch)
		sm.subscribersMu.Unlock()
	}()

	return ch
}

func (sm *SessionManager) broadcastEvent(event StateChangeEvent) {
	sm.subscribersMu.RLock()
	defer sm.subscribersMu.RUnlock()

	for ch := range sm.subscribers {
		select {
		case ch <- event:
		default:
			// Non-blocking drop if consumer buffer is full
		}
	}
}

// RecordRateLimitHit calculates exponential backoff delay and flags throttling.
func (sm *SessionManager) RecordRateLimitHit(_ error) time.Duration {
	sm.backoffMu.Lock()
	defer sm.backoffMu.Unlock()

	sm.attemptCount++
	multiplier := 1 << (sm.attemptCount - 1)
	backoffMs := sm.baseBackoffMs * multiplier
	if backoffMs > sm.maxBackoffMs {
		backoffMs = sm.maxBackoffMs
	}

	duration := time.Duration(backoffMs) * time.Millisecond
	sm.isThrottled = true
	sm.resetTime = time.Now().Add(duration)

	if sm.stateManager != nil {
		st := sm.stateManager.GetState()
		st.RateLimitInfo.IsThrottled = true
		st.RateLimitInfo.BackoffMs = backoffMs
		st.RateLimitInfo.ResetTimestamp = sm.resetTime.UnixMilli()
		_ = sm.stateManager.SetState(st)
	}

	return duration
}

// ResetRateLimit clears rate-limit throttling after successful API responses.
func (sm *SessionManager) ResetRateLimit() {
	sm.backoffMu.Lock()
	defer sm.backoffMu.Unlock()

	sm.attemptCount = 0
	sm.isThrottled = false
	sm.resetTime = time.Now()

	if sm.stateManager != nil {
		st := sm.stateManager.GetState()
		st.RateLimitInfo.IsThrottled = false
		st.RateLimitInfo.BackoffMs = 0
		_ = sm.stateManager.SetState(st)
	}
}

// IsThrottled checks if rate-limiting is actively throttling requests.
func (sm *SessionManager) IsThrottled() bool {
	sm.backoffMu.RLock()
	defer sm.backoffMu.RUnlock()
	return sm.isThrottledLocked()
}

func (sm *SessionManager) isThrottledLocked() bool {
	if !sm.isThrottled {
		return false
	}
	if time.Now().After(sm.resetTime) {
		sm.isThrottled = false
		return false
	}
	return true
}

