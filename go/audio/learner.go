package main

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

// LearnerCuePayload defines feedback telemetry recorded for learning cues.
type LearnerCuePayload struct {
	Prompt    string    `json:"prompt"`
	Score     float64   `json:"score"`
	Timestamp time.Time `json:"timestamp"`
}

// LearnerService provides audio cue playback and progress feedback recording.
type LearnerService struct {
	mu          sync.RWMutex
	cues        []LearnerCuePayload
	lastCue     string
	totalScore  float64
	feedbackCount int
}

// NewLearnerService initializes a new LearnerService instance.
func NewLearnerService() *LearnerService {
	return &LearnerService{
		cues: make([]LearnerCuePayload, 0),
	}
}

// PlayCue plays voice-guided audio prompts for user onboarding and adaptive learning.
func (s *LearnerService) PlayCue(prompt string) error {
	if prompt == "" {
		return errors.New("empty audio cue prompt")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.lastCue = prompt
	return nil
}

// RecordFeedback records user progress score and updates adaptive retention metrics.
func (s *LearnerService) RecordFeedback(score float64) error {
	if score < 0.0 || score > 100.0 {
		return fmt.Errorf("score %.2f out of bounds (0-100)", score)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.feedbackCount++
	s.totalScore += score
	s.cues = append(s.cues, LearnerCuePayload{
		Prompt:    s.lastCue,
		Score:     score,
		Timestamp: time.Now(),
	})

	return nil
}

// GetAverageScore returns the mean score across all recorded feedback steps.
func (s *LearnerService) GetAverageScore() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.feedbackCount == 0 {
		return 0.0
	}
	return s.totalScore / float64(s.feedbackCount)
}

// GetLastCue returns the most recently played cue prompt.
func (s *LearnerService) GetLastCue() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastCue
}
