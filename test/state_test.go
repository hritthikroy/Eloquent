package test

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	state "eloquent-backend/audio"
)

func TestStateLoadSaveCycle(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "state_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	stateFile := filepath.Join(tmpDir, "state.json")
	sm, err := state.NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to create state manager: %v", err)
	}

	err = sm.UpdateTurn(state.TurnContext{
		Speaker:   "user",
		Text:      "Hello world from integration test",
		Timestamp: time.Now().UnixMilli(),
	})
	if err != nil {
		t.Fatalf("UpdateTurn failed: %v", err)
	}

	st := sm.GetState()
	if len(st.ContextBuffer) != 1 {
		t.Fatalf("expected 1 turn in buffer, got %d", len(st.ContextBuffer))
	}

	sm2, err := state.NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to reload state manager: %v", err)
	}

	st2 := sm2.GetState()
	if len(st2.ContextBuffer) != 1 {
		t.Fatalf("expected 1 turn after reload, got %d", len(st2.ContextBuffer))
	}
}

func TestConcurrentUpdatesRace(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "state_race_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	stateFile := filepath.Join(tmpDir, "state.json")
	sm, err := state.NewStateManager(stateFile)
	if err != nil {
		t.Fatalf("failed to create state manager: %v", err)
	}

	var wg sync.WaitGroup
	concurrency := 25

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_ = sm.UpdateTurn(state.TurnContext{
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
