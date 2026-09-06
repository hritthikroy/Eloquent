package player

import (
	"testing"
)

func TestAudioPlayer_PlayFromURL_Success(t *testing.T) {
	p := NewPlayer()

	url := "https://stream.eloquent.internal/audio/hila-nina-master.mp3"
	if err := p.PlayFromURL(url); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	status := p.GetStatus()
	if !status.IsPlaying {
		t.Errorf("expected isPlaying to be true")
	}
	if status.State != StatePlaying {
		t.Errorf("expected state %s, got %s", StatePlaying, status.State)
	}
	if status.CurrentURL != url {
		t.Errorf("expected current URL %s, got %s", url, status.CurrentURL)
	}
}

func TestAudioPlayer_PlayFromURL_ValidationErrors(t *testing.T) {
	p := NewPlayer()

	// Empty URL
	if err := p.PlayFromURL(""); err == nil {
		t.Errorf("expected error for empty URL")
	}

	// Invalid scheme (e.g. ftp or file)
	if err := p.PlayFromURL("file:///local/audio.mp3"); err == nil {
		t.Errorf("expected error for non-http/https scheme")
	}

	// Malformed URL without host
	if err := p.PlayFromURL("http://"); err == nil {
		t.Errorf("expected error for malformed URL")
	}

	status := p.GetStatus()
	if status.State != StateError {
		t.Errorf("expected state %s, got %s", StateError, status.State)
	}
	if status.LastError == "" {
		t.Errorf("expected LastError to be populated")
	}
}

func TestAudioPlayer_PauseResumeStop(t *testing.T) {
	p := NewPlayer()
	url := "https://stream.eloquent.internal/audio/sample.mp3"

	// Pause when idle should fail
	if err := p.Pause(); err == nil {
		t.Errorf("expected error pausing idle player")
	}

	// Resume when idle should fail
	if err := p.Resume(); err == nil {
		t.Errorf("expected error resuming idle player")
	}

	// Start playback
	if err := p.PlayFromURL(url); err != nil {
		t.Fatalf("unexpected error playing: %v", err)
	}

	// Pause
	if err := p.Pause(); err != nil {
		t.Fatalf("unexpected error pausing: %v", err)
	}
	if p.GetStatus().State != StatePaused {
		t.Errorf("expected state %s, got %s", StatePaused, p.GetStatus().State)
	}

	// Resume
	if err := p.Resume(); err != nil {
		t.Fatalf("unexpected error resuming: %v", err)
	}
	if p.GetStatus().State != StatePlaying {
		t.Errorf("expected state %s, got %s", StatePlaying, p.GetStatus().State)
	}

	// Stop
	if err := p.Stop(); err != nil {
		t.Fatalf("unexpected error stopping: %v", err)
	}
	if p.GetStatus().State != StateStopped {
		t.Errorf("expected state %s, got %s", StateStopped, p.GetStatus().State)
	}
	if p.GetStatus().CurrentURL != "" {
		t.Errorf("expected currentURL cleared on stop")
	}
}

func TestAudioPlayer_Volume(t *testing.T) {
	p := NewPlayer()

	p.SetVolume(0.75)
	if p.GetStatus().Volume != 0.75 {
		t.Errorf("expected volume 0.75, got %f", p.GetStatus().Volume)
	}

	// Clamp below 0
	p.SetVolume(-0.5)
	if p.GetStatus().Volume != 0.0 {
		t.Errorf("expected volume clamped to 0.0, got %f", p.GetStatus().Volume)
	}

	// Clamp above 1
	p.SetVolume(1.5)
	if p.GetStatus().Volume != 1.0 {
		t.Errorf("expected volume clamped to 1.0, got %f", p.GetStatus().Volume)
	}
}
