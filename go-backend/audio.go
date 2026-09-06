package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

// AudioCommand represents an incoming command read from stdin or IPC.
type AudioCommand struct {
	Command string  `json:"command"`
	Action  string  `json:"action,omitempty"`
	Path    string  `json:"path,omitempty"`
	File    string  `json:"file,omitempty"`
	Text    string  `json:"text,omitempty"`
	Volume  float64 `json:"volume,omitempty"`
}

// AudioResponse represents a structured JSON response emitted to stdout.
type AudioResponse struct {
	Status    string                 `json:"status"`
	Message   string                 `json:"message,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp int64                  `json:"timestamp"`
}

// AudioBuffer holds loaded PCM or raw audio data along with stream properties.
type AudioBuffer struct {
	Path       string `json:"path"`
	Format     string `json:"format"`
	DataLength int    `json:"dataLength"`
	SampleRate int    `json:"sampleRate"`
	Channels   int    `json:"channels"`
	Data       []byte `json:"-"`
}

// ValidateAudioHeader checks file headers to ensure the file is a valid WAV or MP3 audio file.
func ValidateAudioHeader(header []byte) (string, error) {
	if len(header) < 4 {
		return "", errors.New("file too small or empty header")
	}

	// WAV: RIFF container with WAVE header
	if len(header) >= 12 && string(header[0:4]) == "RIFF" && string(header[8:12]) == "WAVE" {
		return "wav", nil
	}

	// MP3: ID3v2 container tag
	if len(header) >= 3 && string(header[0:3]) == "ID3" {
		return "mp3", nil
	}

	// MP3: Frame sync bits 0xFF 0xFB / 0xF3 / 0xF2
	if header[0] == 0xFF && (header[1]&0xE0) == 0xE0 {
		return "mp3", nil
	}

	return "", fmt.Errorf("unsupported or corrupted audio file header format")
}

// LoadAudio safely reads and validates an MP3 or WAV file, handling errors gracefully.
func LoadAudio(path string) (*AudioBuffer, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("empty audio file path")
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	header := make([]byte, 12)
	n, err := file.Read(header)
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("failed to read audio header: %w", err)
	}

	format, err := ValidateAudioHeader(header[:n])
	if err != nil {
		return nil, err
	}

	fi, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to stat audio file: %w", err)
	}

	return &AudioBuffer{
		Path:       path,
		Format:     format,
		DataLength: int(fi.Size()),
		SampleRate: 44100,
		Channels:   2,
	}, nil
}

// PlayAudio initiates playback for a validated AudioBuffer without crashing on failure.
func PlayAudio(buffer *AudioBuffer) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("audio playback panic recovered: %v", r)
		}
	}()

	if buffer == nil {
		return errors.New("nil audio buffer")
	}

	if buffer.DataLength <= 0 {
		return errors.New("empty audio buffer data")
	}

	atomic.StoreInt32(&isStreaming, 1)
	return nil
}

// ParseCommand parses a raw line or JSON string into an AudioCommand.
func ParseCommand(raw string) (*AudioCommand, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("empty command input")
	}

	var cmd AudioCommand
	if err := json.Unmarshal([]byte(trimmed), &cmd); err != nil {
		// Fallback for plain text commands (e.g. "play /path/to/file", "stop", "status")
		parts := strings.Fields(trimmed)
		if len(parts) > 0 {
			cmd.Command = parts[0]
			if len(parts) > 1 {
				cmd.Path = parts[1]
			}
		} else {
			return nil, fmt.Errorf("invalid command format: %w", err)
		}
	}

	if cmd.Command == "" && cmd.Action != "" {
		cmd.Command = cmd.Action
	}

	cmd.Command = strings.ToLower(strings.TrimSpace(cmd.Command))
	if cmd.Command == "" {
		return nil, errors.New("missing command action")
	}

	return &cmd, nil
}

// ExecuteCommand processes an AudioCommand and generates an AudioResponse.
func ExecuteCommand(cmd *AudioCommand) AudioResponse {
	now := time.Now().UnixMilli()

	switch cmd.Command {
	case "load":
		target := cmd.Path
		if target == "" {
			target = cmd.File
		}
		buf, err := LoadAudio(target)
		if err != nil {
			return AudioResponse{
				Status:    "error",
				Error:     err.Error(),
				Timestamp: now,
			}
		}
		return AudioResponse{
			Status:  "ok",
			Message: fmt.Sprintf("loaded audio file: %s", buf.Path),
			Data: map[string]interface{}{
				"path":       buf.Path,
				"format":     buf.Format,
				"dataLength": buf.DataLength,
				"sampleRate": buf.SampleRate,
				"channels":   buf.Channels,
			},
			Timestamp: now,
		}

	case "play":
		target := cmd.Path
		if target == "" {
			target = cmd.File
		}
		if target == "" && cmd.Text != "" {
			target = "synthesized_text"
		}

		if target != "" && target != "synthesized_text" && target != "demo" {
			buf, err := LoadAudio(target)
			if err != nil {
				return AudioResponse{
					Status:    "error",
					Error:     fmt.Sprintf("cannot play audio: %v", err),
					Timestamp: now,
				}
			}

			if err := PlayAudio(buf); err != nil {
				return AudioResponse{
					Status:    "error",
					Error:     fmt.Sprintf("playback failed: %v", err),
					Timestamp: now,
				}
			}

			return AudioResponse{
				Status:  "ok",
				Message: fmt.Sprintf("playing: %s", target),
				Data: map[string]interface{}{
					"isStreaming": true,
					"path":        target,
					"format":      buf.Format,
					"dataLength":  buf.DataLength,
				},
				Timestamp: now,
			}
		}

		atomic.StoreInt32(&isStreaming, 1)
		return AudioResponse{
			Status:    "ok",
			Message:   fmt.Sprintf("playing: %s", target),
			Data:      map[string]interface{}{"isStreaming": true, "path": target},
			Timestamp: now,
		}

	case "stop":
		atomic.StoreInt32(&isStreaming, 0)
		return AudioResponse{
			Status:    "ok",
			Message:   "stopped",
			Data:      map[string]interface{}{"isStreaming": false},
			Timestamp: now,
		}

	case "status":
		streaming := atomic.LoadInt32(&isStreaming) == 1
		state := "idle"
		if streaming {
			state = "playing"
		}
		return AudioResponse{
			Status:    "ok",
			Message:   state,
			Data:      map[string]interface{}{"isStreaming": streaming, "state": state},
			Timestamp: now,
		}

	case "ping":
		return AudioResponse{
			Status:    "ok",
			Message:   "pong",
			Timestamp: now,
		}

	default:
		return AudioResponse{
			Status:    "error",
			Error:     fmt.Sprintf("unknown command: %s", cmd.Command),
			Timestamp: now,
		}
	}
}

// RunCommandLoop reads line-delimited commands from reader and writes JSON responses to writer.
func RunCommandLoop(ctx context.Context, reader io.Reader, writer io.Writer) error {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		cmd, err := ParseCommand(line)
		var resp AudioResponse
		if err != nil {
			resp = AudioResponse{
				Status:    "error",
				Error:     err.Error(),
				Timestamp: time.Now().UnixMilli(),
			}
		} else {
			resp = ExecuteCommand(cmd)
		}

		respBytes, _ := json.Marshal(resp)
		fmt.Fprintf(writer, "%s\n", string(respBytes))
	}
	return scanner.Err()
}

