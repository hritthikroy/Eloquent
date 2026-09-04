package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSkillMetadataValidation(t *testing.T) {
	// Valid string item
	validStr := SkillMetadataItem{
		Key:   "lead_role",
		Value: "Lead Software Engineer",
		Type:  "string",
	}
	if err := ValidateMetadataItem(validStr); err != nil {
		t.Fatalf("expected valid string item to pass, got: %v", err)
	}

	// Valid number item
	validNum := SkillMetadataItem{
		Key:   "concurrency_limit",
		Value: float64(16),
		Type:  "number",
	}
	if err := ValidateMetadataItem(validNum); err != nil {
		t.Fatalf("expected valid number item to pass, got: %v", err)
	}

	// Valid boolean item
	validBool := SkillMetadataItem{
		Key:   "hot_reload",
		Value: true,
		Type:  "boolean",
	}
	if err := ValidateMetadataItem(validBool); err != nil {
		t.Fatalf("expected valid boolean item to pass, got: %v", err)
	}

	// Invalid key with uppercase and spaces
	invalidKey := SkillMetadataItem{
		Key:   "Bad Key Name",
		Value: "value",
		Type:  "string",
	}
	if err := ValidateMetadataItem(invalidKey); err == nil {
		t.Fatal("expected invalid key name to fail validation")
	}

	// Invalid type
	invalidType := SkillMetadataItem{
		Key:   "aura_color",
		Value: "#06b6d4",
		Type:  "color_hex",
	}
	if err := ValidateMetadataItem(invalidType); err == nil {
		t.Fatal("expected unsupported type to fail validation")
	}

	// Value type mismatch (type is number, but value is string)
	mismatched := SkillMetadataItem{
		Key:   "max_workers",
		Value: "sixteen",
		Type:  "number",
	}
	if err := ValidateMetadataItem(mismatched); err == nil {
		t.Fatal("expected value type mismatch to fail validation")
	}

	// Null value
	nullVal := SkillMetadataItem{
		Key:   "null_item",
		Value: nil,
		Type:  "string",
	}
	if err := ValidateMetadataItem(nullVal); err == nil {
		t.Fatal("expected null value to fail validation")
	}
}

func TestSkillProfileValidation(t *testing.T) {
	profile := &SkillProfile{
		AgentID: "agent_andrew",
		Name:    "Andrew",
		Role:    "Lead Software Engineer",
		Version: "2.1.0",
		Enabled: true,
		Skills: []SkillDefinition{
			{ID: "git_diff", Name: "Git Diff", Handler: "getGitDiff", Enabled: true},
		},
		Metadata: []SkillMetadataItem{
			{Key: "salutation", Value: "bro", Type: "string"},
			{Key: "aura_color", Value: "#06b6d4", Type: "string"},
		},
	}

	if err := ValidateProfile(profile); err != nil {
		t.Fatalf("expected valid profile to pass, got: %v", err)
	}

	// Test duplicate metadata keys
	dupProfile := *profile
	dupProfile.Metadata = []SkillMetadataItem{
		{Key: "aura_color", Value: "#06b6d4", Type: "string"},
		{Key: "aura_color", Value: "#10b981", Type: "string"},
	}
	if err := ValidateProfile(&dupProfile); err == nil {
		t.Fatal("expected duplicate metadata keys to fail validation")
	}

	// Test invalid agentId
	badAgentProfile := *profile
	badAgentProfile.AgentID = "invalid-name!"
	if err := ValidateProfile(&badAgentProfile); err == nil {
		t.Fatal("expected invalid agent ID to fail validation")
	}
}

func TestSkillUpdateHandler_EndpointsAndFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tmpDir, err := os.MkdirTemp("", "eloquent-skills-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	initialProfile := SkillProfile{
		AgentID: "agent_andrew",
		Name:    "Andrew",
		Role:    "Lead Software Engineer",
		Version: "2.1.0",
		Enabled: true,
		Skills: []SkillDefinition{
			{ID: "git_diff", Name: "Git Diff", Handler: "getGitDiff", Enabled: true},
		},
		Metadata: []SkillMetadataItem{
			{Key: "salutation", Value: "bro", Type: "string"},
		},
	}

	data, err := json.MarshalIndent(&initialProfile, "", "  ")
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "andrew.json"), data, 0644); err != nil {
		t.Fatalf("write error: %v", err)
	}

	handler := NewSkillUpdateHandler(tmpDir)

	// 1. Verify initial profile loaded
	p, found := handler.GetProfile("agent_andrew")
	if !found || p == nil {
		t.Fatal("expected agent_andrew to be loaded from disk")
	}
	if len(p.Metadata) != 1 || p.Metadata[0].Key != "salutation" {
		t.Fatalf("unexpected metadata: %+v", p.Metadata)
	}

	// 2. Test GET /api/skills/andrew
	router := gin.New()
	router.GET("/api/skills/:agent", handler.GetSkillProfile)
	router.POST("/api/skills/update", handler.UpdateSkillProfile)
	router.GET("/api/skills/telemetry", handler.GetSkillTelemetry)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/skills/andrew", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/skills/andrew returned status %d", w.Code)
	}

	// 3. Test POST /api/skills/update with valid updateItem
	newItem := SkillMetadataItem{
		Key:   "aura_color",
		Value: "#06b6d4",
		Type:  "string",
	}
	updatePayload := SkillUpdateRequest{
		AgentID:     "agent_andrew",
		UpdateItem:  &newItem,
		TriggerSync: true,
	}
	payloadBytes, _ := json.Marshal(updatePayload)

	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/api/skills/update", bytes.NewReader(payloadBytes))
	req2.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("POST /api/skills/update returned status %d: %s", w2.Code, w2.Body.String())
	}

	var syncResp SkillSyncResponse
	if err := json.Unmarshal(w2.Body.Bytes(), &syncResp); err != nil {
		t.Fatalf("failed to decode sync response: %v", err)
	}
	if !syncResp.Success || syncResp.MetadataCount != 2 {
		t.Fatalf("expected 2 metadata items after update, got %d", syncResp.MetadataCount)
	}

	// 4. Test telemetry endpoint
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest("GET", "/api/skills/telemetry", nil)
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Fatalf("GET /api/skills/telemetry returned status %d", w3.Code)
	}

	// 5. Test rejection of malformed update
	badItem := SkillMetadataItem{
		Key:   "invalid key spaces",
		Value: 123,
		Type:  "string", // Type mismatch + invalid key
	}
	badPayload := SkillUpdateRequest{
		AgentID:    "agent_andrew",
		UpdateItem: &badItem,
	}
	badBytes, _ := json.Marshal(badPayload)

	w4 := httptest.NewRecorder()
	req4, _ := http.NewRequest("POST", "/api/skills/update", bytes.NewReader(badBytes))
	req4.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w4, req4)
	if w4.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected StatusUnprocessableEntity (422), got %d", w4.Code)
	}
}

func TestSkillUpdateHandler_ConcurrentRace(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "eloquent-skills-race-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	initialProfile := SkillProfile{
		AgentID: "agent_andrew",
		Name:    "Andrew",
		Role:    "Lead Software Engineer",
		Version: "2.1.0",
		Enabled: true,
		Metadata: []SkillMetadataItem{
			{Key: "salutation", Value: "bro", Type: "string"},
		},
	}
	data, _ := json.MarshalIndent(&initialProfile, "", "  ")
	_ = os.WriteFile(filepath.Join(tmpDir, "andrew.json"), data, 0644)

	handler := NewSkillUpdateHandler(tmpDir)

	router := gin.New()
	router.GET("/api/skills/:agent", handler.GetSkillProfile)
	router.POST("/api/skills/update", handler.UpdateSkillProfile)

	var wg sync.WaitGroup
	workers := 20
	iterations := 15

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				if i%2 == 0 {
					// Read
					rec := httptest.NewRecorder()
					req, _ := http.NewRequest("GET", "/api/skills/andrew", nil)
					router.ServeHTTP(rec, req)
					if rec.Code != http.StatusOK {
						t.Errorf("read failed with code %d", rec.Code)
					}
				} else {
					// Write
					item := SkillMetadataItem{
						Key:   "active_worker",
						Value: float64(workerID),
						Type:  "number",
					}
					body, _ := json.Marshal(SkillUpdateRequest{
						AgentID:    "agent_andrew",
						UpdateItem: &item,
					})
					rec := httptest.NewRecorder()
					req, _ := http.NewRequest("POST", "/api/skills/update", bytes.NewReader(body))
					req.Header.Set("Content-Type", "application/json")
					router.ServeHTTP(rec, req)
					if rec.Code != http.StatusOK {
						t.Errorf("write failed with code %d", rec.Code)
					}
				}
			}
		}(w)
	}

	wg.Wait()
}
