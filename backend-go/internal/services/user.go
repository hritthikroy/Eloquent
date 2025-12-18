package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"eloquent-backend/internal/models"

	"github.com/google/uuid"
)

type UserService struct {
	supabase *SupabaseService
}

func NewUserService(supabase *SupabaseService) *UserService {
	return &UserService{
		supabase: supabase,
	}
}

func (s *UserService) GetUserByID(userID string) (*models.User, error) {
	// In a real implementation, you'd query the database
	// For now, returning a mock user
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}

	// Mock user - in real implementation this would come from database
	email := "user@example.com"
	role := "user"
	plan := "free"
	subscriptionStatus := "none"
	
	// Handle development mode user
	if userID == "00000000-0000-0000-0000-000000000001" {
		email = "hritthikin@gmail.com" // Admin email for development
	}
	
	// Check if this is an admin user (in real implementation, this would be stored in DB)
	if models.IsAdminEmail(email) {
		role = "admin"
		plan = "enterprise"
		subscriptionStatus = "active"
	}

	user := &models.User{
		ID:                  id,
		Email:               email,
		Role:                role,
		Plan:                plan,
		SubscriptionStatus:  subscriptionStatus,
		UsageCurrentMonth:   0,
		UsageLastReset:      time.Now(),
		Settings:            map[string]interface{}{"language": "en", "aiMode": "auto", "autoGrammarFix": true},
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	return user, nil
}

func (s *UserService) CreateOrUpdateGoogleUser(userData map[string]interface{}, deviceID string) (*models.User, error) {
	// In a real implementation, you'd insert/update in the database
	id := uuid.New()
	
	email := userData["email"].(string)
	
	// Determine user role and plan based on email
	role := "user"
	plan := "free"
	subscriptionStatus := "none"
	
	if models.IsAdminEmail(email) {
		role = "admin"
		plan = "enterprise"
		subscriptionStatus = "active"
	}
	
	user := &models.User{
		ID:                  id,
		Email:               email,
		Role:                role,
		Plan:                plan,
		SubscriptionStatus:  subscriptionStatus,
		UsageCurrentMonth:   0,
		UsageLastReset:      time.Now(),
		Settings:            map[string]interface{}{"language": "en", "aiMode": "auto", "autoGrammarFix": true},
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	if name, ok := userData["name"].(string); ok {
		user.Name = &name
	}

	if picture, ok := userData["picture"].(string); ok {
		user.ProfilePicture = &picture
	}

	return user, nil
}

func (s *UserService) CheckAndResetUsage(userID string) error {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return err
	}

	if user.ShouldResetUsage() {
		// Reset usage in database
		// Implementation would update the database
		user.UsageCurrentMonth = 0
		user.UsageLastReset = time.Now()
	}

	return nil
}

func (s *UserService) GetUsageStats(userID string) (*models.UsageStats, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	limits := user.GetUsageLimits()
	remaining := limits.Minutes - user.UsageCurrentMonth
	if limits.Minutes == -1 {
		remaining = -1 // Unlimited
	}

	return &models.UsageStats{
		CurrentMonth: user.UsageCurrentMonth,
		Limit:        limits.Minutes,
		Remaining:    remaining,
	}, nil
}

func (s *UserService) GetUsageLimits(plan string) models.UsageLimits {
	user := &models.User{Plan: plan}
	return user.GetUsageLimits()
}

func (s *UserService) CanUseFeature(user *models.User, feature string) bool {
	return user.CanUseFeature(feature)
}

func (s *UserService) HasRemainingMinutes(user *models.User, minutes int) bool {
	return user.HasRemainingMinutes(minutes)
}

func (s *UserService) AddOrUpdateDevice(userID, deviceID string) error {
	// Implementation would update the database
	return nil
}

func (s *UserService) UpdateSettings(userID string, settings map[string]interface{}) (*models.User, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	// Merge settings
	for key, value := range settings {
		user.Settings[key] = value
	}

	// In real implementation, update database
	user.UpdatedAt = time.Now()

	return user, nil
}

func (s *UserService) TrackUsage(userID string, minutes int, usageType, mode, language string, processingTime int, success bool, errorMsg ...string) error {
	logEntry := &models.UsageLog{
		ID:             uuid.New(),
		UserID:         uuid.MustParse(userID),
		Type:           usageType,
		Minutes:        minutes,
		ProcessingTime: &processingTime,
		Success:        success,
		CreatedAt:      time.Now(),
	}

	if mode != "" {
		logEntry.Mode = &mode
	}
	if language != "" {
		logEntry.Language = &language
	}
	if len(errorMsg) > 0 && errorMsg[0] != "" {
		logEntry.ErrorMessage = &errorMsg[0]
	}

	// In real implementation, insert into database
	fmt.Printf("Tracking usage: %+v\n", logEntry)

	return nil
}

func (s *UserService) GetUsageHistory(userID string, limit int) ([]*models.UsageLog, error) {
	// In real implementation, query database
	return []*models.UsageLog{}, nil
}

// Admin-specific methods

func (s *UserService) GetAllUsers() ([]*models.User, error) {
	// In real implementation, query all users from database
	// For now, returning mock data
	users := []*models.User{
		{
			ID:                 uuid.New(),
			Email:              "user1@example.com",
			Name:               stringPtr("John Doe"),
			Role:               "user",
			Plan:               "free",
			SubscriptionStatus: "none",
			UsageCurrentMonth:  25,
			CreatedAt:          time.Now().AddDate(0, -2, 0),
			LastLogin:          timePtr(time.Now().AddDate(0, 0, -1)),
			UpdatedAt:          time.Now(),
		},
		{
			ID:                 uuid.New(),
			Email:              "user2@example.com",
			Name:               stringPtr("Jane Smith"),
			Role:               "user",
			Plan:               "pro",
			SubscriptionStatus: "active",
			UsageCurrentMonth:  150,
			CreatedAt:          time.Now().AddDate(0, -1, 0),
			LastLogin:          timePtr(time.Now().AddDate(0, 0, -2)),
			UpdatedAt:          time.Now(),
		},
		{
			ID:                 uuid.New(),
			Email:              "admin@example.com",
			Name:               stringPtr("Admin User"),
			Role:               "admin",
			Plan:               "enterprise",
			SubscriptionStatus: "active",
			UsageCurrentMonth:  0,
			CreatedAt:          time.Now().AddDate(0, -6, 0),
			LastLogin:          timePtr(time.Now()),
			UpdatedAt:          time.Now(),
		},
	}
	
	return users, nil
}

func (s *UserService) GetUserUsageStats(userID string) (*models.UsageStats, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	limits := user.GetUsageLimits()
	remaining := limits.Minutes - user.UsageCurrentMonth
	if limits.Minutes == -1 {
		remaining = -1 // Unlimited
	}

	return &models.UsageStats{
		CurrentMonth: user.UsageCurrentMonth,
		Limit:        limits.Minutes,
		Remaining:    remaining,
	}, nil
}

func (s *UserService) GetUserUsageLogs(userID string, limit int) ([]models.UsageLog, error) {
	// In real implementation, query database for user's usage logs
	// For now, returning mock data
	logs := []models.UsageLog{
		{
			ID:             uuid.New(),
			UserID:         uuid.MustParse(userID),
			Type:           "transcription",
			Minutes:        5,
			Mode:           stringPtr("standard"),
			Language:       stringPtr("en"),
			ProcessingTime: intPtr(2500),
			Success:        true,
			CreatedAt:      time.Now().Add(-2 * time.Hour),
		},
		{
			ID:             uuid.New(),
			UserID:         uuid.MustParse(userID),
			Type:           "ai_rewrite",
			Minutes:        3,
			Mode:           stringPtr("rewrite"),
			Language:       stringPtr("en"),
			ProcessingTime: intPtr(1800),
			Success:        true,
			CreatedAt:      time.Now().Add(-4 * time.Hour),
		},
	}
	
	if len(logs) > limit {
		logs = logs[:limit]
	}
	
	return logs, nil
}

func (s *UserService) UpdateUserPlan(userID, plan, subscriptionStatus string, subscriptionEndDate *time.Time) error {
	// In real implementation, update database
	fmt.Printf("Updating user %s plan to %s, status: %s\n", userID, plan, subscriptionStatus)
	return nil
}

func (s *UserService) UpdateUserRole(userID, role string) error {
	// In real implementation, update database
	fmt.Printf("Updating user %s role to %s\n", userID, role)
	return nil
}

func (s *UserService) ResetUserUsage(userID string) error {
	// In real implementation, reset usage in database
	fmt.Printf("Resetting usage for user %s\n", userID)
	return nil
}

func (s *UserService) DeleteUser(userID string) error {
	// In real implementation, delete user from database
	fmt.Printf("Deleting user %s\n", userID)
	return nil
}

func (s *UserService) GetAdminStats() (map[string]interface{}, error) {
	// In real implementation, calculate stats from database
	stats := map[string]interface{}{
		"total_users":       150,
		"active_users_24h":  45,
		"total_requests":    2847,
		"success_rate":      98.5,
		"api_usage_percent": 67.3,
		"plans": map[string]int{
			"free":       120,
			"starter":    20,
			"pro":        8,
			"unlimited":  2,
			"enterprise": 0,
		},
		"recent_signups": 12,
		"revenue_month":  4250.00,
	}
	
	return stats, nil
}

func (s *UserService) SearchUsers(query string, limit int) ([]*models.User, error) {
	// In real implementation, search database by email/name
	// For now, returning filtered mock data
	allUsers, err := s.GetAllUsers()
	if err != nil {
		return nil, err
	}
	
	var results []*models.User
	for _, user := range allUsers {
		if contains(user.Email, query) || (user.Name != nil && contains(*user.Name, query)) {
			results = append(results, user)
			if len(results) >= limit {
				break
			}
		}
	}
	
	return results, nil
}

func (s *UserService) GetUsersByPlan(plan string) ([]*models.User, error) {
	// In real implementation, query database by plan
	allUsers, err := s.GetAllUsers()
	if err != nil {
		return nil, err
	}
	
	var results []*models.User
	for _, user := range allUsers {
		if user.Plan == plan {
			results = append(results, user)
		}
	}
	
	return results, nil
}

func (s *UserService) BulkUpdateUsers(userIDs []string, plan, role, subscriptionStatus *string, subscriptionEndDate *time.Time) (map[string]interface{}, error) {
	// In real implementation, perform bulk update in database
	successful := 0
	failed := 0
	
	for _, userID := range userIDs {
		// Simulate update
		if plan != nil {
			status := "active"
			if subscriptionStatus != nil {
				status = *subscriptionStatus
			}
			err := s.UpdateUserPlan(userID, *plan, status, subscriptionEndDate)
			if err != nil {
				failed++
				continue
			}
		}
		
		if role != nil {
			err := s.UpdateUserRole(userID, *role)
			if err != nil {
				failed++
				continue
			}
		}
		
		successful++
	}
	
	return map[string]interface{}{
		"successful": successful,
		"failed":     failed,
		"total":      len(userIDs),
	}, nil
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func intPtr(i int) *int {
	return &i
}

func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// JSON marshaling helpers
func UserToJSON(u *models.User) ([]byte, error) {
	return json.Marshal(u)
}

func UserFromJSON(data []byte) (*models.User, error) {
	var u models.User
	err := json.Unmarshal(data, &u)
	return &u, err
}