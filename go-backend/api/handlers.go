// Package api implements the Antiquity HTTP REST endpoints for the Eloquent audio backend,
// enforcing strict JSON schema alignment and decoupled, stateless request handling.
package api

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"
)

// APIError represents structured error details matching the Antiquity response schema.
type APIError struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Details []string `json:"details,omitempty"`
}

// AntiquityInvokeRequest represents the inbound tool invocation payload.
type AntiquityInvokeRequest struct {
	Tool      string                 `json:"tool"`
	AuthToken string                 `json:"authToken"`
	RequestID string                 `json:"requestId"`
	Payload   map[string]interface{} `json:"payload"`
}

// AntiquityInvokeResponse represents the strict JSON schema-compliant response.
type AntiquityInvokeResponse struct {
	Success         bool                   `json:"success"`
	RequestID       string                 `json:"requestId"`
	Tool            string                 `json:"tool"`
	Data            map[string]interface{} `json:"data,omitempty"`
	Error           *APIError              `json:"error,omitempty"`
	ExecutionTimeMs float64                `json:"executionTimeMs"`
}

// AudioProcessRequest represents an audio processing payload.
type AudioProcessRequest struct {
	Action     string `json:"action"`
	SampleRate int    `json:"sampleRate"`
	Channels   int    `json:"channels"`
	ByteLength int    `json:"byteLength"`
	AudioData  string `json:"audioData"`
}

// AudioProcessResponse represents audio processing metrics and status.
type AudioProcessResponse struct {
	Status          string  `json:"status"`
	Action          string  `json:"action"`
	SampleRate      int     `json:"sampleRate"`
	Channels        int     `json:"channels"`
	FramesProcessed int     `json:"framesProcessed"`
	RMS             float64 `json:"rms"`
	Peak            float64 `json:"peak"`
	LatencyMs       float64 `json:"latencyMs"`
	Timestamp       int64   `json:"timestamp"`
}

// writeJSON sends a JSON response with proper headers and status code.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, `{"error":"failed to serialize json"}`, http.StatusInternalServerError)
	}
}

// HandleAntiquityInvoke processes tool requests conforming to Antiquity JSON schema.
func HandleAntiquityInvoke(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, AntiquityInvokeResponse{
			Success: false,
			Error: &APIError{
				Code:    "METHOD_NOT_ALLOWED",
				Message: "Endpoint only accepts POST requests",
			},
			ExecutionTimeMs: float64(time.Since(start).Microseconds()) / 1000.0,
		})
		return
	}

	body, err := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, AntiquityInvokeResponse{
			Success: false,
			Error: &APIError{
				Code:    "READ_ERROR",
				Message: "Failed to read request body",
			},
			ExecutionTimeMs: float64(time.Since(start).Microseconds()) / 1000.0,
		})
		return
	}

	var req AntiquityInvokeRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, AntiquityInvokeResponse{
			Success: false,
			Error: &APIError{
				Code:    "SCHEMA_VALIDATION_ERROR",
				Message: "Invalid JSON format: " + err.Error(),
			},
			ExecutionTimeMs: float64(time.Since(start).Microseconds()) / 1000.0,
		})
		return
	}

	// Schema validation checks
	var validationErrors []string
	if strings.TrimSpace(req.Tool) == "" {
		validationErrors = append(validationErrors, "tool is required and must be non-empty")
	}
	if len(req.AuthToken) < 16 {
		validationErrors = append(validationErrors, "authToken must be at least 16 characters")
	}
	if strings.TrimSpace(req.RequestID) == "" {
		validationErrors = append(validationErrors, "requestId is required")
	}
	if req.Payload == nil {
		validationErrors = append(validationErrors, "payload object is required")
	}

	if len(validationErrors) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, AntiquityInvokeResponse{
			Success:   false,
			RequestID: req.RequestID,
			Tool:      req.Tool,
			Error: &APIError{
				Code:    "SCHEMA_VALIDATION_ERROR",
				Message: "Payload failed schema validation",
				Details: validationErrors,
			},
			ExecutionTimeMs: float64(time.Since(start).Microseconds()) / 1000.0,
		})
		return
	}

	// Process according to tool
	responseData := make(map[string]interface{})
	switch req.Tool {
	case "audio-bridge":
		action, _ := req.Payload["action"].(string)
		if action == "" {
			action = "process_audio"
		}
		responseData["action"] = action
		responseData["processed"] = true
		responseData["backend"] = "eloquent-go-audio"
		responseData["timestamp"] = time.Now().UnixMilli()

	case "legacy-parser":
		raw, _ := req.Payload["rawContent"].(string)
		format, _ := req.Payload["format"].(string)
		responseData["parsed"] = true
		responseData["format"] = format
		responseData["byteCount"] = len(raw)

	default:
		responseData["handled"] = true
		responseData["tool"] = req.Tool
	}

	durationMs := float64(time.Since(start).Microseconds()) / 1000.0
	writeJSON(w, http.StatusOK, AntiquityInvokeResponse{
		Success:         true,
		RequestID:       req.RequestID,
		Tool:            req.Tool,
		Data:            responseData,
		ExecutionTimeMs: durationMs,
	})
}

// HandleAudioProcess processes audio buffers directly via REST without direct CGO coupling.
func HandleAudioProcess(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AudioProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request payload",
		})
		return
	}

	sampleRate := req.SampleRate
	if sampleRate <= 0 {
		sampleRate = 24000
	}
	channels := req.Channels
	if channels <= 0 {
		channels = 1
	}

	rawBytes, _ := base64.StdEncoding.DecodeString(req.AudioData)
	totalFrames := len(rawBytes) / (2 * channels)

	// Calculate audio metrics
	var sumSquares float64
	var peak float64
	sampleCount := len(rawBytes) / 2
	for i := 0; i < sampleCount; i++ {
		if i*2+1 < len(rawBytes) {
			s := int16(rawBytes[i*2]) | (int16(rawBytes[i*2+1]) << 8)
			val := float64(s) / 32768.0
			absVal := math.Abs(val)
			if absVal > peak {
				peak = absVal
			}
			sumSquares += val * val
		}
	}

	var rms float64
	if sampleCount > 0 {
		rms = math.Sqrt(sumSquares / float64(sampleCount))
	}

	latencyMs := float64(time.Since(start).Microseconds()) / 1000.0

	res := AudioProcessResponse{
		Status:          "processed",
		Action:          req.Action,
		SampleRate:      sampleRate,
		Channels:        channels,
		FramesProcessed: totalFrames,
		RMS:             math.Round(rms*1000) / 1000,
		Peak:            math.Round(peak*1000) / 1000,
		LatencyMs:       latencyMs,
		Timestamp:       time.Now().UnixMilli(),
	}

	writeJSON(w, http.StatusOK, res)
}

// HandleAntiquityHealth reports health and available antiquity endpoints.
func HandleAntiquityHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "eloquent-audio-antiquity-api",
		"version":   "2.1.0",
		"timestamp": time.Now().UnixMilli(),
		"endpoints": []string{
			"POST /api/v1/antiquity/invoke",
			"POST /api/v1/audio/process",
			"GET /api/v1/antiquity/health",
		},
	})
}

// RegisterAntiquityHandlers registers all Antiquity REST endpoints onto the HTTP ServeMux.
func RegisterAntiquityHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/antiquity/invoke", HandleAntiquityInvoke)
	mux.HandleFunc("/api/v1/audio/process", HandleAudioProcess)
	mux.HandleFunc("/api/v1/antiquity/health", HandleAntiquityHealth)
	fmt.Println("🛡️ [Antiquity API] Registered modular REST endpoints on /api/v1/antiquity/*")
}
