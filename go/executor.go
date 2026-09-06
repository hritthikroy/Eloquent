package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// SafeExecResult defines structured output returned from isolated command execution.
type SafeExecResult struct {
	ExitCode   int    `json:"exit_code"`
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	DurationMs int64  `json:"duration_ms"`
	Error      string `json:"error,omitempty"`
}

// Command whitelist for restricted execution environment
var allowedBinaries = map[string]bool{
	"git":           true,
	"node":          true,
	"npm":           true,
	"echo":          true,
	"ls":            true,
	"go":            true,
	"pwd":           true,
	"whoami":        true,
	"date":          true,
	"audio-service": true,
}

// SafeExec executes a whitelisted command with timeout isolation and output capture.
func SafeExec(command string, args []string, timeout time.Duration) *SafeExecResult {
	startTime := time.Now()

	cmdBase := filepath.Base(strings.TrimSpace(command))
	if !allowedBinaries[cmdBase] {
		return &SafeExecResult{
			ExitCode:   -1,
			Stdout:     "",
			Stderr:     "",
			DurationMs: time.Since(startTime).Milliseconds(),
			Error:      fmt.Sprintf("command '%s' is not in execution whitelist", cmdBase),
		}
	}

	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, cmdBase, args...)

	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	err := cmd.Run()
	durationMs := time.Since(startTime).Milliseconds()

	exitCode := 0
	errMsg := ""

	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitCode()
			errMsg = exitErr.Error()
		} else if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			exitCode = -1
			errMsg = fmt.Sprintf("execution timed out after %v", timeout)
		} else {
			exitCode = -1
			errMsg = err.Error()
		}
	}

	return &SafeExecResult{
		ExitCode:   exitCode,
		Stdout:     strings.TrimSpace(stdoutBuf.String()),
		Stderr:     strings.TrimSpace(stderrBuf.String()),
		DurationMs: durationMs,
		Error:      errMsg,
	}
}
