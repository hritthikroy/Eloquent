// Package handlers provides HTTP and IPC event handlers for the Eloquent backend.
package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	keyPattern     = regexp.MustCompile(`^[a-z0-9_]+$`)
	agentIDPattern = regexp.MustCompile(`^agent_[a-z0-9_]+$`)
	allowedTypes   = map[string]bool{
		"string":  true,
		"number":  true,
		"boolean": true,
		"object":  true,
		"array":   true,
	}
)

// SkillMetadataItem represents a typed configuration element in an agent's metadata array.
type SkillMetadataItem struct {
	Key         string      `json:"key"`
	Value       interface{} `json:"value"`
	Type        string      `json:"type"`
	Description string      `json:"description,omitempty"`
	Timestamp   int64       `json:"timestamp,omitempty"`
}

// SkillDefinition defines an executable skill capability within an agent profile.
type SkillDefinition struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Handler     string `json:"handler,omitempty"`
	Category    string `json:"category,omitempty"`
	TimeoutMs   int    `json:"timeoutMs,omitempty"`
	Enabled     bool   `json:"enabled"`
}

// SkillProfile models the complete validated agent skill profile.
type SkillProfile struct {
	AgentID     string              `json:"agentId"`
	Name        string              `json:"name"`
	Role        string              `json:"role"`
	Version     string              `json:"version"`
	Enabled     bool                `json:"enabled"`
	LastUpdated int64               `json:"lastUpdated"`
	Skills      []SkillDefinition   `json:"skills"`
	Metadata    []SkillMetadataItem `json:"metadata"`
}

// SkillUpdateRequest encapsulates an incoming mutation request to a skill profile.
type SkillUpdateRequest struct {
	AgentID     string              `json:"agentId" binding:"required"`
	Metadata    []SkillMetadataItem `json:"metadata,omitempty"`
	UpdateItem  *SkillMetadataItem  `json:"updateItem,omitempty"`
	TriggerSync bool                `json:"triggerSync,omitempty"`
}

// SkillSyncResponse captures the result of a profile validation or sync operation.
type SkillSyncResponse struct {
	Success       bool          `json:"success"`
	AgentID       string        `json:"agentId"`
	Version       string        `json:"version,omitempty"`
	MetadataCount int           `json:"metadataCount"`
	SyncedAt      int64         `json:"syncedAt"`
	Message       string        `json:"message"`
	Profile       *SkillProfile `json:"profile,omitempty"`
}

// SkillUpdateHandler provides thread-safe profile caching, validation, and API routes.
type SkillUpdateHandler struct {
	mu         sync.RWMutex
	configDir  string
	profiles   map[string]*SkillProfile
	fallbacks  map[string]*SkillProfile
	syncCount  int64
	lastSyncAt int64
}

// NewSkillUpdateHandler initializes the handler with the target skills directory.
func NewSkillUpdateHandler(configDir string) *SkillUpdateHandler {
	resolvedDir := configDir
	if resolvedDir == "" {
		resolvedDir = "./config/skills"
	}

	h := &SkillUpdateHandler{
		configDir: resolvedDir,
		profiles:  make(map[string]*SkillProfile),
		fallbacks: make(map[string]*SkillProfile),
	}

	// Prime initial profiles from disk if directory exists
	_ = h.LoadAllProfiles()
	return h
}

// ValidateMetadataItem verifies that a single metadata entry complies with the schema.
func ValidateMetadataItem(item SkillMetadataItem) error {
	if item.Key == "" || !keyPattern.MatchString(item.Key) {
		return fmt.Errorf("invalid metadata key '%s': must be lowercase alphanumeric with underscores", item.Key)
	}

	if !allowedTypes[item.Type] {
		return fmt.Errorf("invalid metadata type '%s' for key '%s': must be string, number, boolean, object, or array", item.Type, item.Key)
	}

	if item.Value == nil {
		return fmt.Errorf("metadata value for key '%s' cannot be null", item.Key)
	}

	switch item.Type {
	case "string":
		if _, ok := item.Value.(string); !ok {
			return fmt.Errorf("metadata value for '%s' expected string, got %T", item.Key, item.Value)
		}
	case "number":
		switch item.Value.(type) {
		case float64, float32, int, int64, int32, uint, uint64:
		default:
			return fmt.Errorf("metadata value for '%s' expected number, got %T", item.Key, item.Value)
		}
	case "boolean":
		if _, ok := item.Value.(bool); !ok {
			return fmt.Errorf("metadata value for '%s' expected boolean, got %T", item.Key, item.Value)
		}
	case "object":
		if _, ok := item.Value.(map[string]interface{}); !ok {
			return fmt.Errorf("metadata value for '%s' expected object map, got %T", item.Key, item.Value)
		}
	case "array":
		if _, ok := item.Value.([]interface{}); !ok {
			return fmt.Errorf("metadata value for '%s' expected array, got %T", item.Key, item.Value)
		}
	}

	return nil
}

// ValidateProfile validates an entire profile structure against strict integrity rules.
func ValidateProfile(profile *SkillProfile) error {
	if profile == nil {
		return errors.New("profile cannot be nil")
	}

	if profile.AgentID == "" || !agentIDPattern.MatchString(profile.AgentID) {
		return fmt.Errorf("invalid agentId '%s': must match pattern ^agent_[a-z0-9_]+$", profile.AgentID)
	}

	if strings.TrimSpace(profile.Name) == "" {
		return errors.New("profile name cannot be empty")
	}

	if strings.TrimSpace(profile.Version) == "" {
		return errors.New("profile version cannot be empty")
	}

	seenKeys := make(map[string]bool)
	for i, item := range profile.Metadata {
		if err := ValidateMetadataItem(item); err != nil {
			return fmt.Errorf("metadata error at index %d: %w", i, err)
		}
		if seenKeys[item.Key] {
			return fmt.Errorf("duplicate metadata key '%s' at index %d", item.Key, i)
		}
		seenKeys[item.Key] = true
	}

	return nil
}

// LoadAllProfiles scans the configDir and loads all valid agent JSON profiles.
func (h *SkillUpdateHandler) LoadAllProfiles() error {
	h.mu.Lock()
	defer h.mu.Unlock()

	entries, err := os.ReadDir(h.configDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") && entry.Name() != "skill-schema.json" {
			filePath := filepath.Join(h.configDir, entry.Name())
			data, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}

			var profile SkillProfile
			if err := json.Unmarshal(data, &profile); err != nil {
				continue
			}

			if err := ValidateProfile(&profile); err == nil {
				h.profiles[profile.AgentID] = &profile
				agentKey := strings.TrimSuffix(entry.Name(), ".json")
				h.profiles[agentKey] = &profile
				h.fallbacks[profile.AgentID] = &profile
			}
		}
	}

	return nil
}

// GetProfile returns a clone of the active profile for an agent, using fallback if needed.
func (h *SkillUpdateHandler) GetProfile(agentID string) (*SkillProfile, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	p, ok := h.profiles[agentID]
	if ok && p != nil {
		cloned := *p
		return &cloned, true
	}

	fb, ok := h.fallbacks[agentID]
	if ok && fb != nil {
		cloned := *fb
		return &cloned, true
	}

	return nil, false
}

// UpdateSkillProfile handles POST /api/skills/update requests.
func (h *SkillUpdateHandler) UpdateSkillProfile(c *gin.Context) {
	var req SkillUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Malformed request payload: " + err.Error(),
		})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	existing, exists := h.profiles[req.AgentID]
	if !exists {
		// Attempt fallback
		existing, exists = h.fallbacks[req.AgentID]
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Agent skill profile not found for '%s'", req.AgentID),
		})
		return
	}

	// Clone existing profile
	updated := *existing
	updated.Metadata = append([]SkillMetadataItem(nil), existing.Metadata...)

	// Apply bulk metadata updates if supplied
	if len(req.Metadata) > 0 {
		for i, item := range req.Metadata {
			if err := ValidateMetadataItem(item); err != nil {
				c.JSON(http.StatusUnprocessableEntity, gin.H{
					"success": false,
					"error":   fmt.Sprintf("Validation failed for item %d: %s", i, err.Error()),
				})
				return
			}
		}
		updated.Metadata = req.Metadata
	}

	// Apply single metadata mutation if supplied
	if req.UpdateItem != nil {
		if err := ValidateMetadataItem(*req.UpdateItem); err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"success": false,
				"error":   "Validation failed for updateItem: " + err.Error(),
			})
			return
		}

		found := false
		now := time.Now().UnixMilli()
		itemCopy := *req.UpdateItem
		itemCopy.Timestamp = now

		for i, m := range updated.Metadata {
			if m.Key == itemCopy.Key {
				updated.Metadata[i] = itemCopy
				found = true
				break
			}
		}
		if !found {
			updated.Metadata = append(updated.Metadata, itemCopy)
		}
	}

	updated.LastUpdated = time.Now().UnixMilli()

	if err := ValidateProfile(&updated); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"success": false,
			"error":   "Profile integrity validation failed: " + err.Error(),
		})
		return
	}

	// Commit to in-memory active cache
	h.profiles[req.AgentID] = &updated
	h.fallbacks[req.AgentID] = &updated
	cleanName := strings.TrimPrefix(req.AgentID, "agent_")
	h.profiles[cleanName] = &updated

	atomic.AddInt64(&h.syncCount, 1)
	atomic.StoreInt64(&h.lastSyncAt, updated.LastUpdated)

	// Persist to disk if directory is configured and exists
	if req.TriggerSync && h.configDir != "" {
		fileName := fmt.Sprintf("%s.json", cleanName)
		targetPath := filepath.Join(h.configDir, fileName)
		if bytes, err := json.MarshalIndent(&updated, "", "  "); err == nil {
			tmpPath := targetPath + ".tmp"
			if err := os.WriteFile(tmpPath, bytes, 0644); err == nil {
				_ = os.Rename(tmpPath, targetPath)
			}
		}
	}

	c.JSON(http.StatusOK, SkillSyncResponse{
		Success:       true,
		AgentID:       updated.AgentID,
		Version:       updated.Version,
		MetadataCount: len(updated.Metadata),
		SyncedAt:      updated.LastUpdated,
		Message:       "Skill profile updated and hot-synced successfully",
		Profile:       &updated,
	})
}

// GetSkillProfile handles GET /api/skills/:agent requests.
func (h *SkillUpdateHandler) GetSkillProfile(c *gin.Context) {
	agent := c.Param("agent")
	if agent == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Agent parameter required"})
		return
	}

	profile, found := h.GetProfile(agent)
	if !found {
		// Try prefixed
		profile, found = h.GetProfile("agent_" + agent)
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Profile for agent '%s' not found", agent),
		})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// GetSkillTelemetry handles GET /api/skills/telemetry requests.
func (h *SkillUpdateHandler) GetSkillTelemetry(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	activeCount := len(h.profiles)
	c.JSON(http.StatusOK, gin.H{
		"syncCount":      atomic.LoadInt64(&h.syncCount),
		"lastSyncAt":     atomic.LoadInt64(&h.lastSyncAt),
		"profilesCached": activeCount,
		"configDir":      h.configDir,
		"status":         "healthy",
	})
}
