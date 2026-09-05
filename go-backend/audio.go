package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	case "play":
		target := cmd.Path
		if target == "" {
			target = cmd.File
		}
		if target == "" && cmd.Text != "" {
			target = "synthesized_text"
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
