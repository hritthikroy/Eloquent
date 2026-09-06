package main

import (
	"context"
	"testing"
	"time"
)

func TestLearnerService_PlayCueAndRecordFeedback(t *testing.T) {
	service := NewLearnerService()

	// 1. PlayCue validation
	err := service.PlayCue("Welcome to Eloquent Fast Learner")
	if err != nil {
		t.Fatalf("PlayCue failed: %v", err)
	}
	if service.GetLastCue() != "Welcome to Eloquent Fast Learner" {
		t.Errorf("Expected last cue 'Welcome to Eloquent Fast Learner', got '%s'", service.GetLastCue())
	}

	// Empty cue validation
	if err := service.PlayCue(""); err == nil {
		t.Errorf("Expected error for empty cue, got nil")
	}

	// 2. RecordFeedback validation
	if err := service.RecordFeedback(95.5); err != nil {
		t.Fatalf("RecordFeedback failed: %v", err)
	}

	if err := service.RecordFeedback(85.5); err != nil {
		t.Fatalf("RecordFeedback failed: %v", err)
	}

	avgScore := service.GetAverageScore()
	if avgScore != 90.5 {
		t.Errorf("Expected average score 90.5, got %.2f", avgScore)
	}

	// Out of bounds score validation
	if err := service.RecordFeedback(150.0); err == nil {
		t.Errorf("Expected error for out-of-bounds score 150.0, got nil")
	}
}

func TestLearnerServer_Lifecycle(t *testing.T) {
	service := NewLearnerService()
	server := NewLearnerServer(service)

	if server.Service() != service {
		t.Errorf("Expected server service to match provided instance")
	}

	err := server.Start(":0") // Random available port
	if err != nil {
		t.Fatalf("LearnerServer.Start failed: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err = server.Stop(ctx)
	if err != nil {
		t.Fatalf("LearnerServer.Stop failed: %v", err)
	}
}
