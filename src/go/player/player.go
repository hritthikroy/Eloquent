package player

import (
	"errors"
	"fmt"
	"net/url"
	"sync"
)

// State constants for audio player lifecycle.
const (
	StateIdle    = "idle"
	StatePlaying = "playing"
	StatePaused  = "paused"
	StateStopped = "stopped"
	StateError   = "error"
)

// PlayerStatus represents the current runtime telemetry of the audio player.
type PlayerStatus struct {
	State      string  `json:"state"`
	CurrentURL string  `json:"currentUrl"`
	IsPlaying  bool    `json:"isPlaying"`
	Volume     float64 `json:"volume"`
	LastError  string  `json:"lastError,omitempty"`
}

// AudioPlayer implements thread-safe audio streaming management.
type AudioPlayer struct {
	mu         sync.RWMutex
	state      string
	currentURL string
	isPlaying  bool
	volume     float64
	lastError  string
}

// NewPlayer constructs a new initialized AudioPlayer.
func NewPlayer() *AudioPlayer {
	return &AudioPlayer{
		state:     StateIdle,
		volume:    1.0,
		isPlaying: false,
	}
}

// PlayFromURL validates the streaming URL and initiates audio playback.
func (p *AudioPlayer) PlayFromURL(streamURL string) error {
	if streamURL == "" {
		p.setError("streaming URL cannot be empty")
		return errors.New("streaming URL cannot be empty")
	}

	parsed, err := url.Parse(streamURL)
	if err != nil || parsed.Host == "" {
		errMsg := fmt.Sprintf("malformed streaming URL: %s", streamURL)
		p.setError(errMsg)
		return errors.New(errMsg)
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		errMsg := fmt.Sprintf("invalid streaming URL scheme '%s': must be http or https", parsed.Scheme)
		p.setError(errMsg)
		return errors.New(errMsg)
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	p.currentURL = streamURL
	p.state = StatePlaying
	p.isPlaying = true
	p.lastError = ""
	return nil
}

// Stop stops the audio playback and resets the current URL.
func (p *AudioPlayer) Stop() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.state = StateStopped
	p.isPlaying = false
	p.currentURL = ""
	return nil
}

// Pause pauses active playback without clearing the current track URL.
func (p *AudioPlayer) Pause() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.isPlaying {
		return errors.New("cannot pause when player is not actively playing")
	}

	p.state = StatePaused
	p.isPlaying = false
	return nil
}

// Resume resumes paused playback.
func (p *AudioPlayer) Resume() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.state != StatePaused {
		return errors.New("cannot resume when player is not paused")
	}

	p.state = StatePlaying
	p.isPlaying = true
	return nil
}

// GetStatus returns a snapshot of player status.
func (p *AudioPlayer) GetStatus() PlayerStatus {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return PlayerStatus{
		State:      p.state,
		CurrentURL: p.currentURL,
		IsPlaying:  p.isPlaying,
		Volume:     p.volume,
		LastError:  p.lastError,
	}
}

// SetVolume sets the player volume between 0.0 and 1.0.
func (p *AudioPlayer) SetVolume(vol float64) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if vol < 0.0 {
		vol = 0.0
	} else if vol > 1.0 {
		vol = 1.0
	}
	p.volume = vol
}

func (p *AudioPlayer) setError(msg string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.state = StateError
	p.isPlaying = false
	p.lastError = msg
}
