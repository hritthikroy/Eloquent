package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"eloquent-backend/internal/models"

	"github.com/google/uuid"
)

type GlobalUsageService struct {
	supabaseURL string
	supabaseKey string
	httpClient  *http.Client
	cache       *models.GlobalUsage
	cacheMutex  sync.RWMutex
	cacheTime   time.Time
}

func NewGlobalUsageService(supabaseURL, supabaseKey string) *GlobalUsageService {
	return &GlobalUsageService{
		supabaseURL: supabaseURL,
		supabaseKey: supabaseKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetGlobalUsage retrieves current global usage stats
func (s *GlobalUsageService) GetGlobalUsage() (*models.GlobalUsage, error) {
	// Check cache (valid for 5 seconds)
	s.cacheMutex.RLock()
	if s.cache != nil && time.Since(s.cacheTime) < 5*time.Second {
		cached := *s.cache
		s.cacheMutex.RUnlock()
		return &cached, nil
	}
	s.cacheMutex.RUnlock()

	url := fmt.Sprintf("%s/rest/v1/global_usage?id=eq.global&select=*", s.supabaseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var results []models.GlobalUsage
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, err
	}

	if len(results) == 0 {
		// Create default record if not exists
		return s.initializeGlobalUsage()
	}

	usage := &results[0]

	// Check if reset is needed
	if usage.ShouldReset() {
		return s.resetGlobalUsage()
	}

	// Update cache
	s.cacheMutex.Lock()
	s.cache = usage
	s.cacheTime = time.Now()
	s.cacheMutex.Unlock()

	return usage, nil
}

// GetGlobalUsageStats returns stats formatted for frontend
func (s *GlobalUsageService) GetGlobalUsageStats() (*models.GlobalUsageStats, error) {
	usage, err := s.GetGlobalUsage()
	if err != nil {
		return nil, err
	}

	remaining := usage.FreeSecondsLimit - usage.FreeSecondsUsed
	if remaining < 0 {
		remaining = 0
	}

	percentage := float64(usage.FreeSecondsUsed) / float64(usage.FreeSecondsLimit) * 100
	if percentage > 100 {
		percentage = 100
	}

	return &models.GlobalUsageStats{
		FreeSecondsUsed:      usage.FreeSecondsUsed,
		FreeSecondsLimit:     usage.FreeSecondsLimit,
		FreeSecondsRemaining: remaining,
		PercentageUsed:       percentage,
		ResetPeriod:          usage.ResetPeriod,
		IsLimitReached:       usage.FreeSecondsUsed >= usage.FreeSecondsLimit,
	}, nil
}

// IncrementGlobalUsage adds seconds to global usage
func (s *GlobalUsageService) IncrementGlobalUsage(userID string, seconds int, mode string) error {
	// Get current usage
	usage, err := s.GetGlobalUsage()
	if err != nil {
		return err
	}

	newUsed := usage.FreeSecondsUsed + seconds

	// Update global usage
	url := fmt.Sprintf("%s/rest/v1/global_usage?id=eq.global", s.supabaseURL)
	updateData := map[string]interface{}{
		"free_seconds_used": newUsed,
		"updated_at":        time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PATCH", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")
	req.Body = io.NopCloser(stringReader(string(jsonData)))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Log the usage
	s.logGlobalUsage(userID, seconds, mode)

	// Invalidate cache
	s.cacheMutex.Lock()
	s.cache = nil
	s.cacheMutex.Unlock()

	return nil
}

// HasFreeSecondsAvailable checks if free seconds are available
func (s *GlobalUsageService) HasFreeSecondsAvailable(secondsNeeded int) (bool, error) {
	usage, err := s.GetGlobalUsage()
	if err != nil {
		return false, err
	}
	return usage.HasFreeSecondsRemaining(secondsNeeded), nil
}

// logGlobalUsage logs individual usage contribution
func (s *GlobalUsageService) logGlobalUsage(userID string, seconds int, mode string) error {
	url := fmt.Sprintf("%s/rest/v1/global_usage_logs", s.supabaseURL)

	logData := map[string]interface{}{
		"id":           uuid.New().String(),
		"seconds_used": seconds,
		"created_at":   time.Now().Format(time.RFC3339),
	}

	if userID != "" {
		logData["user_id"] = userID
	}
	if mode != "" {
		logData["mode"] = mode
	}

	jsonData, err := json.Marshal(logData)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")
	req.Body = io.NopCloser(stringReader(string(jsonData)))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// initializeGlobalUsage creates the default global usage record
func (s *GlobalUsageService) initializeGlobalUsage() (*models.GlobalUsage, error) {
	url := fmt.Sprintf("%s/rest/v1/global_usage", s.supabaseURL)

	usage := &models.GlobalUsage{
		ID:               "global",
		FreeSecondsUsed:  0,
		FreeSecondsLimit: 2400, // 40 minutes
		LastReset:        time.Now(),
		ResetPeriod:      "monthly",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	jsonData, err := json.Marshal(usage)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")
	req.Body = io.NopCloser(stringReader(string(jsonData)))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return usage, nil
}

// resetGlobalUsage resets the global usage counter
func (s *GlobalUsageService) resetGlobalUsage() (*models.GlobalUsage, error) {
	url := fmt.Sprintf("%s/rest/v1/global_usage?id=eq.global", s.supabaseURL)

	updateData := map[string]interface{}{
		"free_seconds_used": 0,
		"last_reset":        time.Now().Format(time.RFC3339),
		"updated_at":        time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("PATCH", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")
	req.Body = io.NopCloser(stringReader(string(jsonData)))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var results []models.GlobalUsage
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, err
	}

	if len(results) > 0 {
		// Update cache
		s.cacheMutex.Lock()
		s.cache = &results[0]
		s.cacheTime = time.Now()
		s.cacheMutex.Unlock()
		return &results[0], nil
	}

	return s.initializeGlobalUsage()
}

// UpdateGlobalLimit allows admin to update the free seconds limit
func (s *GlobalUsageService) UpdateGlobalLimit(newLimit int) error {
	url := fmt.Sprintf("%s/rest/v1/global_usage?id=eq.global", s.supabaseURL)

	updateData := map[string]interface{}{
		"free_seconds_limit": newLimit,
		"updated_at":         time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PATCH", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")
	req.Body = io.NopCloser(stringReader(string(jsonData)))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Invalidate cache
	s.cacheMutex.Lock()
	s.cache = nil
	s.cacheMutex.Unlock()

	return nil
}

// Helper function
func stringReader(s string) *stringReaderImpl {
	return &stringReaderImpl{s: s, i: 0}
}

type stringReaderImpl struct {
	s string
	i int
}

func (r *stringReaderImpl) Read(p []byte) (n int, err error) {
	if r.i >= len(r.s) {
		return 0, io.EOF
	}
	n = copy(p, r.s[r.i:])
	r.i += n
	return
}


// GlobalUsageStatsResponse is used for JSON responses
type GlobalUsageStatsResponse struct {
	FreeSecondsUsed      int     `json:"free_seconds_used"`
	FreeSecondsLimit     int     `json:"free_seconds_limit"`
	FreeSecondsRemaining int     `json:"free_seconds_remaining"`
	PercentageUsed       float64 `json:"percentage_used"`
	IsLimitReached       bool    `json:"is_limit_reached"`
}
