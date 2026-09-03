package state

import (
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
