package services

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
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

	user := &models.User{
		ID:                  id,
		Email:               "user@example.com",
		Plan:                "free",
		SubscriptionStatus:  "none",
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
	
	user := &models.User{
		ID:                  id,
		Email:               userData["email"].(string),
		Plan:                "free",
		SubscriptionStatus:  "none",
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

// JSON marshaling for database storage
func (u *models.User) Value() (driver.Value, error) {
	return json.Marshal(u)
}

func (u *models.User) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, u)
	case string:
		return json.Unmarshal([]byte(v), u)
	default:
		return fmt.Errorf("cannot scan %T into User", value)
	}
}