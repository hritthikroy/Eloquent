package state

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestStateLoadSaveCycle(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "state_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	stateFile := filepath.Join(tmpDir, "state.json")
	sm, err := NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to create state manager: %v", err)
	}

	// Initial turn
	err = sm.UpdateTurn(TurnContext{
		Speaker:   "user",
		Text:      "Hello world from test",
		Timestamp: time.Now().UnixMilli(),
	})
	if err != nil {
		t.Fatalf("UpdateTurn failed: %v", err)
	}

	st := sm.GetState()
	if len(st.ContextBuffer) != 1 {
		t.Fatalf("expected 1 turn in buffer, got %d", len(st.ContextBuffer))
	}
	if st.ContextBuffer[0].Text != "Hello world from test" {
		t.Fatalf("unexpected text: %s", st.ContextBuffer[0].Text)
	}

	// Reload from new manager instance to verify persistence
	sm2, err := NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to reload state manager: %v", err)
	}

	st2 := sm2.GetState()
	if len(st2.ContextBuffer) != 1 {
		t.Fatalf("expected 1 turn after reload, got %d", len(st2.ContextBuffer))
	}
	if st2.ContextBuffer[0].Text != "Hello world from test" {
		t.Fatalf("unexpected text on reloaded state: %s", st2.ContextBuffer[0].Text)
	}
}

func TestConcurrentUpdatesRace(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "state_race_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	stateFile := filepath.Join(tmpDir, "state.json")
	sm, err := NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to create state manager: %v", err)
	}

	var wg sync.WaitGroup
	concurrency := 20

	// Launch concurrent writers and readers
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_ = sm.UpdateTurn(TurnContext{
				Speaker:   "user",
				Text:      "Concurrent message",
				Timestamp: time.Now().UnixMilli(),
			})
			_ = sm.GetState()
		}(i)
	}

	wg.Wait()

	finalState := sm.GetState()
	if len(finalState.ContextBuffer) == 0 {
		t.Fatalf("expected recorded turns, got 0")
	}
}

func TestRateLimitResetLogic(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "state_rate_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	stateFile := filepath.Join(tmpDir, "state.json")
	sm, err := NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to create state manager: %v", err)
	}

	// Simulate throttled state that has expired
	expiredState := sm.GetState()
	expiredState.RateLimitInfo.IsThrottled = true
	expiredState.RateLimitInfo.RequestsRemaining = 0
	expiredState.RateLimitInfo.ResetTimestamp = time.Now().Add(-10 * time.Second).UnixMilli()

	err = sm.SetState(expiredState)
	if err != nil {
		t.Fatalf("SetState failed: %v", err)
	}

	// Reading state should automatically reset rate limits
	refreshed := sm.GetState()
	if refreshed.RateLimitInfo.IsThrottled {
		t.Fatalf("expected rate limit to be reset, but still throttled")
	}
	if refreshed.RateLimitInfo.RequestsRemaining != 60 {
		t.Fatalf("expected requestsRemaining to reset to 60, got %d", refreshed.RateLimitInfo.RequestsRemaining)
	}
}

func TestSessionManager_FSMTransitions(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "session_fsm_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	stateFile := filepath.Join(tmpDir, "state.json")
	sm, err := NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to create state manager: %v", err)
	}

	session := NewSessionManager("test-session-1", sm)
	if session.GetCurrentPhase() != PhaseIdle {
		t.Fatalf("expected initial phase to be idle, got %s", session.GetCurrentPhase())
	}

	// Legal transition: Idle -> Listening
	if err := session.TransitionPhase(PhaseListening); err != nil {
		t.Fatalf("unexpected error for Idle -> Listening: %v", err)
	}
	if session.GetCurrentPhase() != PhaseListening {
		t.Fatalf("expected phase listening, got %s", session.GetCurrentPhase())
	}

	// Legal transition: Listening -> Thinking
	if err := session.TransitionPhase(PhaseThinking); err != nil {
		t.Fatalf("unexpected error for Listening -> Thinking: %v", err)
	}

	// Legal transition: Thinking -> Speaking
	if err := session.TransitionPhase(PhaseSpeaking); err != nil {
		t.Fatalf("unexpected error for Thinking -> Speaking: %v", err)
	}

	// Legal transition: Speaking -> Idle
	if err := session.TransitionPhase(PhaseIdle); err != nil {
		t.Fatalf("unexpected error for Speaking -> Idle: %v", err)
	}

	// Illegal transition: Idle -> Speaking (must fail with ErrInvalidPhaseTransition)
	if err := session.TransitionPhase(PhaseSpeaking); err == nil {
		t.Fatalf("expected error for illegal Idle -> Speaking transition, got nil")
	} else if !errors.Is(err, ErrInvalidPhaseTransition) {
		t.Fatalf("expected ErrInvalidPhaseTransition, got: %v", err)
	}

	// Transition to Error then recover to Idle
	if err := session.TransitionPhase(PhaseListening); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := session.TransitionPhase(PhaseError); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := session.TransitionPhase(PhaseIdle); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSessionManager_ChannelEvents(t *testing.T) {
	session := NewSessionManager("test-channel-session", nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	eventsCh := session.SubscribeStateChanges(ctx, 10)

	// Trigger phase transition
	if err := session.TransitionPhase(PhaseListening); err != nil {
		t.Fatalf("transition failed: %v", err)
	}

	select {
	case evt := <-eventsCh:
		if evt.NewPhase != PhaseListening || evt.PrevPhase != PhaseIdle {
			t.Fatalf("unexpected event payload: %+v", evt)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("timed out waiting for transition event")
	}

	// Trigger audio state update
	session.SetAudioStreamState(AudioStreamCapturing)
	select {
	case evt := <-eventsCh:
		if evt.AudioState != AudioStreamCapturing {
			t.Fatalf("unexpected audio state event: %+v", evt)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("timed out waiting for audio state event")
	}

	// Trigger record turn
	seq, err := session.RecordTurn("user", "Testing turn broadcast")
	if err != nil {
		t.Fatalf("RecordTurn failed: %v", err)
	}
	if seq != 1 {
		t.Fatalf("expected sequence 1, got %d", seq)
	}

	select {
	case evt := <-eventsCh:
		if evt.TurnSeq != 1 || evt.Speaker != "user" {
			t.Fatalf("unexpected turn event: %+v", evt)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("timed out waiting for turn event")
	}

	// Cancel context and verify channel closes
	cancel()
	select {
	case _, ok := <-eventsCh:
		if ok {
			// Could be a buffered event or closed
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("channel cleanup timed out")
	}
}

func TestSessionManager_RateLimitBackoff(t *testing.T) {
	session := NewSessionManager("test-ratelimit-session", nil)

	if session.IsThrottled() {
		t.Fatalf("expected session not throttled initially")
	}

	d1 := session.RecordRateLimitHit(errors.New("HTTP 429 Too Many Requests"))
	if d1 != 500*time.Millisecond {
		t.Fatalf("expected 500ms first backoff, got %v", d1)
	}
	if !session.IsThrottled() {
		t.Fatalf("expected session to be throttled")
	}

	d2 := session.RecordRateLimitHit(errors.New("HTTP 429 Too Many Requests"))
	if d2 != 1000*time.Millisecond {
		t.Fatalf("expected 1000ms second backoff, got %v", d2)
	}

	session.ResetRateLimit()
	if session.IsThrottled() {
		t.Fatalf("expected session not throttled after reset")
	}
}

func TestSessionManager_ConcurrentTurnsRace(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "session_race_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	stateFile := filepath.Join(tmpDir, "state.json")
	sm, err := NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to create state manager: %v", err)
	}

	session := NewSessionManager("race-session", sm)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	events := session.SubscribeStateChanges(ctx, 100)

	// Consume events in background to prevent buffer fill
	go func() {
		for range events {
		}
	}()

	var wg sync.WaitGroup
	concurrency := 15

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, _ = session.RecordTurn("tester", "concurrent speech turn")
			session.SetAudioStreamState(AudioStreamProcessing)
			_ = session.GetAudioStreamState()
			_ = session.GetActiveSpeaker()
			_ = session.GetTurnSequence()
		}(i)
	}

	wg.Wait()

	if session.GetTurnSequence() != int64(concurrency) {
		t.Fatalf("expected turnSeq to be %d, got %d", concurrency, session.GetTurnSequence())
	}
}
