//go:build test || !test

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestParseCommand_JSON(t *testing.T) {
	raw := `{"command":"play","path":"/tmp/test.wav"}`
	cmd, err := ParseCommand(raw)
	if err != nil {
		t.Fatalf("ParseCommand failed: %v", err)
	}
	if cmd.Command != "play" {
		t.Errorf("Expected command 'play', got '%s'", cmd.Command)
	}
	if cmd.Path != "/tmp/test.wav" {
		t.Errorf("Expected path '/tmp/test.wav', got '%s'", cmd.Path)
	}
}

func TestParseCommand_PlainText(t *testing.T) {
	raw := "stop"
	cmd, err := ParseCommand(raw)
	if err != nil {
		t.Fatalf("ParseCommand failed: %v", err)
	}
	if cmd.Command != "stop" {
		t.Errorf("Expected command 'stop', got '%s'", cmd.Command)
	}
}

func TestParseCommand_ActionAlias(t *testing.T) {
	raw := `{"action":"status"}`
	cmd, err := ParseCommand(raw)
	if err != nil {
		t.Fatalf("ParseCommand failed: %v", err)
	}
	if cmd.Command != "status" {
		t.Errorf("Expected command 'status', got '%s'", cmd.Command)
	}
}

func TestParseCommand_Empty(t *testing.T) {
	_, err := ParseCommand("   ")
	if err == nil {
		t.Errorf("Expected error for empty input, got nil")
	}
}

func TestExecuteCommand_PlayStopStatus(t *testing.T) {
	cmdPlay := &AudioCommand{Command: "play", Path: "demo.wav"}
	respPlay := ExecuteCommand(cmdPlay)
	if respPlay.Status != "ok" {
		t.Errorf("Expected status ok, got %s", respPlay.Status)
	}

	cmdStatus := &AudioCommand{Command: "status"}
	respStatus := ExecuteCommand(cmdStatus)
	if respStatus.Status != "ok" || respStatus.Data["isStreaming"] != true {
		t.Errorf("Expected playing status, got %+v", respStatus)
	}

	cmdStop := &AudioCommand{Command: "stop"}
	respStop := ExecuteCommand(cmdStop)
	if respStop.Status != "ok" {
		t.Errorf("Expected status ok, got %s", respStop.Status)
	}

	respStatus2 := ExecuteCommand(cmdStatus)
	if respStatus2.Data["isStreaming"] != false {
		t.Errorf("Expected stopped status, got %+v", respStatus2)
	}
}

func TestExecuteCommand_Unknown(t *testing.T) {
	cmdUnknown := &AudioCommand{Command: "invalid_action"}
	resp := ExecuteCommand(cmdUnknown)
	if resp.Status != "error" {
		t.Errorf("Expected status error for unknown command, got %s", resp.Status)
	}
}

func TestRunCommandLoop(t *testing.T) {
	input := `{"command":"play","path":"sample.wav"}` + "\n" + `{"command":"stop"}` + "\n"
	reader := strings.NewReader(input)
	var writer bytes.Buffer

	ctx := context.Background()
	err := RunCommandLoop(ctx, reader, &writer)
	if err != nil {
		t.Fatalf("RunCommandLoop error: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(writer.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("Expected 2 response lines, got %d", len(lines))
	}

	var r1, r2 AudioResponse
	if err := json.Unmarshal([]byte(lines[0]), &r1); err != nil {
		t.Fatalf("Unmarshal line 0 failed: %v", err)
	}
	if err := json.Unmarshal([]byte(lines[1]), &r2); err != nil {
		t.Fatalf("Unmarshal line 1 failed: %v", err)
	}

	if r1.Status != "ok" || r2.Status != "ok" {
		t.Errorf("Expected both responses to have status 'ok'")
	}
}
