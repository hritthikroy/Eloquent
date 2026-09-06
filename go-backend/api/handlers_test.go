package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleAntiquityHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/antiquity/health", nil)
	w := httptest.NewRecorder()

	HandleAntiquityHealth(w, req)
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if data["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got %v", data["status"])
	}
}

func TestHandleAntiquityInvoke_Valid(t *testing.T) {
	body := AntiquityInvokeRequest{
		Tool:      "legacy-parser",
		AuthToken: "eloquent-antiquity-secure-token-2026",
		RequestID: "req-test-123456",
		Payload: map[string]interface{}{
			"rawContent": "USER_NAME=Hritthik\nAPP=Eloquent",
			"format":     "v1",
		},
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/antiquity/invoke", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	HandleAntiquityInvoke(w, req)
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	var res AntiquityInvokeResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if !res.Success {
		t.Errorf("Expected success to be true, got false")
	}
	if res.Tool != "legacy-parser" {
		t.Errorf("Expected tool 'legacy-parser', got %s", res.Tool)
	}
}

func TestHandleAntiquityInvoke_InvalidSchema(t *testing.T) {
	// Missing authToken and tool
	invalidBody := map[string]interface{}{
		"requestId": "test-req",
	}
	bodyBytes, _ := json.Marshal(invalidBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/antiquity/invoke", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	HandleAntiquityInvoke(w, req)
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("Expected status 422, got %d", resp.StatusCode)
	}

	var res AntiquityInvokeResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if res.Success {
		t.Errorf("Expected success to be false for invalid schema")
	}
	if res.Error == nil || res.Error.Code != "SCHEMA_VALIDATION_ERROR" {
		t.Errorf("Expected SCHEMA_VALIDATION_ERROR code")
	}
}

func TestHandleAudioProcess(t *testing.T) {
	reqBody := AudioProcessRequest{
		Action:     "normalize",
		SampleRate: 24000,
		Channels:   1,
		AudioData:  "AAAA//8AAP//", // mock base64 PCM16
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/audio/process", bytes.NewReader(bodyBytes))
	w := httptest.NewRecorder()

	HandleAudioProcess(w, req)
	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	var res AudioProcessResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if res.Status != "processed" {
		t.Errorf("Expected status 'processed', got %s", res.Status)
	}
}
