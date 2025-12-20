package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"eloquent-backend/internal/models"

	"github.com/google/uuid"
)

// parseSupabaseTime parses Supabase timestamp format to time.Time
func parseSupabaseTime(timeStr string) (time.Time, error) {
	if timeStr == "" {
		return time.Time{}, nil
	}
	
	// Supabase returns timestamps in format: "2025-12-19T23:33:56.303032"
	// We need to add timezone info for Go to parse it
	if !strings.Contains(timeStr, "Z") && !strings.Contains(timeStr, "+") && !strings.Contains(timeStr, "-") {
		timeStr += "Z" // Add UTC timezone
	}
	
	// Try different formats
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.999999Z",
		"2006-01-02T15:04:05Z",
	}
	
	for _, format := range formats {
		if t, err := time.Parse(format, timeStr); err == nil {
			return t, nil
		}
	}
	
	return time.Time{}, fmt.Errorf("unable to parse time: %s", timeStr)
}

type UserService struct {
	supabase     *SupabaseService
	mockUsers    map[string]*models.User // Cache for mock users
	usersCache   []*models.User          // Cache for all users
	cacheExpiry  time.Time               // Cache expiration time
	cacheMutex   sync.RWMutex            // Mutex for thread-safe cache access
}

func NewUserService(supabase *SupabaseService) *UserService {
	if supabase == nil {
		panic("supabase service cannot be nil when creating UserService")
	}
	return &UserService{
		supabase:  supabase,
		mockUsers: make(map[string]*models.User),
	}
}

func (s *UserService) GetUserByID(userID string) (*models.User, error) {
	// Validate UUID format
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID format: %v", err)
	}

	// Handle development mode user
	if userID == "00000000-0000-0000-0000-000000000001" {
		email := "hritthikin@gmail.com"
		role := "admin"
		plan := "enterprise"
		subscriptionStatus := "active"
		
		user := &models.User{
			ID:                  parsedID,
			Email:               email,
			Name:                stringPtr("Admin"),
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
	
	// Query user from Supabase database
	url := fmt.Sprintf("%s/rest/v1/users?id=eq.%s&select=*", s.supabase.URL, userID)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("apikey", s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch user: %d", resp.StatusCode)
	}

	var dbUsers []struct {
		ID                  string                 `json:"id"`
		Email               string                 `json:"email"`
		Name                *string                `json:"name"`
		GoogleID            *string                `json:"google_id"`
		ProfilePicture      *string                `json:"profile_picture"`
		Role                string                 `json:"role"`
		Plan                string                 `json:"plan"`
		StripeCustomerID    *string                `json:"stripe_customer_id"`
		StripeSubscriptionID *string               `json:"stripe_subscription_id"`
		SubscriptionStatus  string                 `json:"subscription_status"`
		SubscriptionEndDate *time.Time             `json:"subscription_end_date"`
		UsageCurrentMonth   int                    `json:"usage_current_month"`
		UsageLastReset      time.Time              `json:"usage_last_reset"`
		Settings            map[string]interface{} `json:"settings"`
		CreatedAt           time.Time              `json:"created_at"`
		LastLogin           *time.Time             `json:"last_login"`
		UpdatedAt           time.Time              `json:"updated_at"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&dbUsers); err != nil {
		return nil, err
	}

	if len(dbUsers) == 0 {
		return nil, fmt.Errorf("user not found: %s", userID)
	}

	dbUser := dbUsers[0]
	user := &models.User{
		ID:                  parsedID,
		Email:               dbUser.Email,
		Name:                dbUser.Name,
		GoogleID:            dbUser.GoogleID,
		ProfilePicture:      dbUser.ProfilePicture,
		Role:                dbUser.Role,
		Plan:                dbUser.Plan,
		StripeCustomerID:    dbUser.StripeCustomerID,
		StripeSubscriptionID: dbUser.StripeSubscriptionID,
		SubscriptionStatus:  dbUser.SubscriptionStatus,
		SubscriptionEndDate: dbUser.SubscriptionEndDate,
		UsageCurrentMonth:   dbUser.UsageCurrentMonth,
		UsageLastReset:      dbUser.UsageLastReset,
		Settings:            dbUser.Settings,
		CreatedAt:           dbUser.CreatedAt,
		LastLogin:           dbUser.LastLogin,
		UpdatedAt:           dbUser.UpdatedAt,
	}
	
	return user, nil
}

func (s *UserService) CreateOrUpdateGoogleUser(userData map[string]interface{}, deviceID string) (*models.User, error) {
	email, ok := userData["email"].(string)
	if !ok || email == "" {
		return nil, fmt.Errorf("invalid or missing email")
	}
	
	// First, check if user already exists in database
	existingUsers, err := s.GetAllUsers()
	if err == nil {
		for _, user := range existingUsers {
			if user.Email == email {
				// User exists, update their info and return
				return s.updateExistingUser(user, userData)
			}
		}
	}
	
	// User doesn't exist, create new user in database
	return s.createNewUserInDatabase(userData, deviceID)
}

// createNewUserInDatabase creates a new user in the Supabase database
func (s *UserService) createNewUserInDatabase(userData map[string]interface{}, deviceID string) (*models.User, error) {
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
	
	// Prepare user data for Supabase
	newUser := map[string]interface{}{
		"email":               email,
		"role":                role,
		"plan":                plan,
		"subscription_status": subscriptionStatus,
		"usage_current_month": 0,
		"settings":            map[string]interface{}{"language": "en", "aiMode": "auto", "autoGrammarFix": true},
	}
	
	// Add optional fields
	if name, ok := userData["name"].(string); ok && name != "" {
		newUser["name"] = name
	}
	if picture, ok := userData["picture"].(string); ok && picture != "" {
		newUser["profile_picture"] = picture
	}
	if googleID, ok := userData["id"].(string); ok && googleID != "" {
		newUser["google_id"] = googleID
	}
	
	// Insert into Supabase database
	url := fmt.Sprintf("%s/rest/v1/users", s.supabase.URL)
	
	jsonData, err := json.Marshal(newUser)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user data: %v", err)
	}
	
	req, err := http.NewRequest("POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("apikey", s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("failed to create user in database: %d", resp.StatusCode)
	}
	
	// Parse the created user from response
	var createdUsers []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&createdUsers); err != nil {
		return nil, err
	}
	
	if len(createdUsers) == 0 {
		return nil, fmt.Errorf("no user returned from database")
	}
	
	// Convert the created user to models.User
	return s.convertRawUserToModel(createdUsers[0])
}

// updateExistingUser updates an existing user's information
func (s *UserService) updateExistingUser(existingUser *models.User, userData map[string]interface{}) (*models.User, error) {
	// Prepare update data
	updateData := map[string]interface{}{}
	
	// Update optional fields if they've changed
	if name, ok := userData["name"].(string); ok && name != "" {
		if existingUser.Name == nil || *existingUser.Name != name {
			updateData["name"] = name
		}
	}
	if picture, ok := userData["picture"].(string); ok && picture != "" {
		if existingUser.ProfilePicture == nil || *existingUser.ProfilePicture != picture {
			updateData["profile_picture"] = picture
		}
	}
	if googleID, ok := userData["id"].(string); ok && googleID != "" {
		if existingUser.GoogleID == nil || *existingUser.GoogleID != googleID {
			updateData["google_id"] = googleID
		}
	}
	
	// Always update last_login
	updateData["last_login"] = time.Now().UTC().Format("2006-01-02T15:04:05.999999Z")
	
	// If no updates needed, return existing user
	if len(updateData) <= 1 { // Only last_login
		return existingUser, nil
	}
	
	// Update in database
	url := fmt.Sprintf("%s/rest/v1/users?id=eq.%s", s.supabase.URL, existingUser.ID.String())
	
	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal update data: %v", err)
	}
	
	req, err := http.NewRequest("PATCH", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("apikey", s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusNoContent {
		return nil, fmt.Errorf("failed to update user in database: %d", resp.StatusCode)
	}
	
	// Return updated user by fetching from database
	return s.GetUserByID(existingUser.ID.String())
}

// RegisterDevice registers a device for a user
func (s *UserService) RegisterDevice(userID, deviceID string) error {
	if userID == "" || deviceID == "" {
		return fmt.Errorf("userID and deviceID are required")
	}
	
	// Check if device already exists for this user
	url := fmt.Sprintf("%s/rest/v1/devices?user_id=eq.%s&device_id=eq.%s", s.supabase.URL, userID, deviceID)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("apikey", s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	var existingDevices []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&existingDevices); err != nil {
		return err
	}
	
	// If device exists, update last_active
	if len(existingDevices) > 0 {
		updateURL := fmt.Sprintf("%s/rest/v1/devices?user_id=eq.%s&device_id=eq.%s", s.supabase.URL, userID, deviceID)
		updateData := map[string]interface{}{
			"last_active": time.Now().UTC().Format("2006-01-02T15:04:05.999999Z"),
		}
		
		jsonData, err := json.Marshal(updateData)
		if err != nil {
			return err
		}
		
		updateReq, err := http.NewRequest("PATCH", updateURL, strings.NewReader(string(jsonData)))
		if err != nil {
			return err
		}
		
		updateReq.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
		updateReq.Header.Set("apikey", s.supabase.ServiceKey)
		updateReq.Header.Set("Content-Type", "application/json")
		
		updateResp, err := client.Do(updateReq)
		if err != nil {
			return err
		}
		updateResp.Body.Close()
		
		return nil
	}
	
	// Device doesn't exist, create new device
	newDevice := map[string]interface{}{
		"user_id":   userID,
		"device_id": deviceID,
		"name":      "Device",
	}
	
	createURL := fmt.Sprintf("%s/rest/v1/devices", s.supabase.URL)
	jsonData, err := json.Marshal(newDevice)
	if err != nil {
		return err
	}
	
	createReq, err := http.NewRequest("POST", createURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return err
	}
	
	createReq.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	createReq.Header.Set("apikey", s.supabase.ServiceKey)
	createReq.Header.Set("Content-Type", "application/json")
	
	createResp, err := client.Do(createReq)
	if err != nil {
		return err
	}
	createResp.Body.Close()
	
	return nil
}

// LogUsage logs a usage event for a user
func (s *UserService) LogUsage(userID, usageType string, minutes int, mode, language string, success bool, errorMessage string) error {
	if userID == "" || usageType == "" {
		return fmt.Errorf("userID and usageType are required")
	}
	
	usageLog := map[string]interface{}{
		"user_id":    userID,
		"type":       usageType,
		"minutes":    minutes,
		"success":    success,
	}
	
	if mode != "" {
		usageLog["mode"] = mode
	}
	if language != "" {
		usageLog["language"] = language
	}
	if errorMessage != "" {
		usageLog["error_message"] = errorMessage
	}
	
	url := fmt.Sprintf("%s/rest/v1/usage_logs", s.supabase.URL)
	jsonData, err := json.Marshal(usageLog)
	if err != nil {
		return err
	}
	
	req, err := http.NewRequest("POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("apikey", s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	return nil
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
	// Check cache first
	s.cacheMutex.RLock()
	if s.usersCache != nil && time.Now().Before(s.cacheExpiry) {
		cached := make([]*models.User, len(s.usersCache))
		copy(cached, s.usersCache)
		s.cacheMutex.RUnlock()
		return cached, nil
	}
	s.cacheMutex.RUnlock()

	// Cache miss or expired, fetch from database
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	// Double-check after acquiring write lock
	if s.usersCache != nil && time.Now().Before(s.cacheExpiry) {
		cached := make([]*models.User, len(s.usersCache))
		copy(cached, s.usersCache)
		return cached, nil
	}

	// Query all users from Supabase database
	url := fmt.Sprintf("%s/rest/v1/users?select=*", s.supabase.URL)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("apikey", s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second} // Reduced timeout
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch users: %d", resp.StatusCode)
	}

	var dbUsers []struct {
		ID                  string                 `json:"id"`
		Email               string                 `json:"email"`
		Name                *string                `json:"name"`
		GoogleID            *string                `json:"google_id"`
		ProfilePicture      *string                `json:"profile_picture"`
		Role                string                 `json:"role"`
		Plan                string                 `json:"plan"`
		StripeCustomerID    *string                `json:"stripe_customer_id"`
		StripeSubscriptionID *string               `json:"stripe_subscription_id"`
		SubscriptionStatus  string                 `json:"subscription_status"`
		SubscriptionEndDate *time.Time             `json:"subscription_end_date"`
		UsageCurrentMonth   int                    `json:"usage_current_month"`
		UsageLastReset      time.Time              `json:"usage_last_reset"`
		Settings            map[string]interface{} `json:"settings"`
		CreatedAt           time.Time              `json:"created_at"`
		LastLogin           *time.Time             `json:"last_login"`
		UpdatedAt           time.Time              `json:"updated_at"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&dbUsers); err != nil {
		// Try to decode as raw JSON and handle timestamps manually
		resp.Body.Close()
		
		// Make the request again to get fresh response body
		resp2, err2 := client.Do(req)
		if err2 != nil {
			return nil, err2
		}
		defer resp2.Body.Close()
		
		var rawUsers []map[string]interface{}
		if err := json.NewDecoder(resp2.Body).Decode(&rawUsers); err != nil {
			return nil, fmt.Errorf("failed to decode as raw JSON: %v", err)
		}
		
		// Convert raw JSON to users manually
		users := make([]*models.User, 0, len(rawUsers))
		for _, rawUser := range rawUsers {
			user, err := s.convertRawUserToModel(rawUser)
			if err != nil {
				continue // Skip users with conversion errors
			}
			users = append(users, user)
		}
		
		return users, nil
	}

	fmt.Printf("✅ DEBUG: Successfully decoded %d users from database\n", len(dbUsers))
	for i, user := range dbUsers {
		fmt.Printf("  User %d: %s (ID: %s)\n", i+1, user.Email, user.ID)
	}

	// Convert to models.User
	users := make([]*models.User, len(dbUsers))
	for i, dbUser := range dbUsers {
		parsedID, err := uuid.Parse(dbUser.ID)
		if err != nil {
			continue // Skip invalid UUIDs
		}

		users[i] = &models.User{
			ID:                  parsedID,
			Email:               dbUser.Email,
			Name:                dbUser.Name,
			GoogleID:            dbUser.GoogleID,
			ProfilePicture:      dbUser.ProfilePicture,
			Role:                dbUser.Role,
			Plan:                dbUser.Plan,
			StripeCustomerID:    dbUser.StripeCustomerID,
			StripeSubscriptionID: dbUser.StripeSubscriptionID,
			SubscriptionStatus:  dbUser.SubscriptionStatus,
			SubscriptionEndDate: dbUser.SubscriptionEndDate,
			UsageCurrentMonth:   dbUser.UsageCurrentMonth,
			UsageLastReset:      dbUser.UsageLastReset,
			Settings:            dbUser.Settings,
			CreatedAt:           dbUser.CreatedAt,
			LastLogin:           dbUser.LastLogin,
			UpdatedAt:           dbUser.UpdatedAt,
		}
	}
	
	// Store in cache for 30 seconds
	s.usersCache = make([]*models.User, len(users))
	copy(s.usersCache, users)
	s.cacheExpiry = time.Now().Add(30 * time.Second)
	
	return users, nil
}

// InvalidateUsersCache clears the users cache
func (s *UserService) InvalidateUsersCache() {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	s.usersCache = nil
	s.cacheExpiry = time.Time{}
}

// convertRawUserToModel converts a raw JSON user object to models.User
func (s *UserService) convertRawUserToModel(rawUser map[string]interface{}) (*models.User, error) {
	// Parse ID
	idStr, ok := rawUser["id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid or missing id")
	}
	parsedID, err := uuid.Parse(idStr)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID: %v", err)
	}
	
	// Parse email
	email, ok := rawUser["email"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid or missing email")
	}
	
	user := &models.User{
		ID:    parsedID,
		Email: email,
	}
	
	// Parse optional string fields
	if name, ok := rawUser["name"].(string); ok && name != "" {
		user.Name = &name
	}
	if googleID, ok := rawUser["google_id"].(string); ok && googleID != "" {
		user.GoogleID = &googleID
	}
	if profilePicture, ok := rawUser["profile_picture"].(string); ok && profilePicture != "" {
		user.ProfilePicture = &profilePicture
	}
	if stripeCustomerID, ok := rawUser["stripe_customer_id"].(string); ok && stripeCustomerID != "" {
		user.StripeCustomerID = &stripeCustomerID
	}
	if stripeSubscriptionID, ok := rawUser["stripe_subscription_id"].(string); ok && stripeSubscriptionID != "" {
		user.StripeSubscriptionID = &stripeSubscriptionID
	}
	
	// Parse required string fields with defaults
	if role, ok := rawUser["role"].(string); ok {
		user.Role = role
	} else {
		user.Role = "user"
	}
	if plan, ok := rawUser["plan"].(string); ok {
		user.Plan = plan
	} else {
		user.Plan = "free"
	}
	if subscriptionStatus, ok := rawUser["subscription_status"].(string); ok {
		user.SubscriptionStatus = subscriptionStatus
	} else {
		user.SubscriptionStatus = "none"
	}
	
	// Parse numeric fields
	if usageCurrentMonth, ok := rawUser["usage_current_month"].(float64); ok {
		user.UsageCurrentMonth = int(usageCurrentMonth)
	}
	
	// Parse timestamp fields
	if usageLastResetStr, ok := rawUser["usage_last_reset"].(string); ok {
		if t, err := parseSupabaseTime(usageLastResetStr); err == nil {
			user.UsageLastReset = t
		} else {
			user.UsageLastReset = time.Now()
		}
	} else {
		user.UsageLastReset = time.Now()
	}
	
	if createdAtStr, ok := rawUser["created_at"].(string); ok {
		if t, err := parseSupabaseTime(createdAtStr); err == nil {
			user.CreatedAt = t
		} else {
			user.CreatedAt = time.Now()
		}
	} else {
		user.CreatedAt = time.Now()
	}
	
	if updatedAtStr, ok := rawUser["updated_at"].(string); ok {
		if t, err := parseSupabaseTime(updatedAtStr); err == nil {
			user.UpdatedAt = t
		} else {
			user.UpdatedAt = time.Now()
		}
	} else {
		user.UpdatedAt = time.Now()
	}
	
	// Parse optional timestamp fields
	if subscriptionEndDateStr, ok := rawUser["subscription_end_date"].(string); ok && subscriptionEndDateStr != "" {
		if t, err := parseSupabaseTime(subscriptionEndDateStr); err == nil {
			user.SubscriptionEndDate = &t
		}
	}
	if lastLoginStr, ok := rawUser["last_login"].(string); ok && lastLoginStr != "" {
		if t, err := parseSupabaseTime(lastLoginStr); err == nil {
			user.LastLogin = &t
		}
	}
	
	// Parse settings
	if settings, ok := rawUser["settings"].(map[string]interface{}); ok {
		user.Settings = settings
	} else {
		user.Settings = map[string]interface{}{"language": "en", "aiMode": "auto", "autoGrammarFix": true}
	}
	
	return user, nil
}

// initMockUsers initializes the mock user store
// No demo users - admin panel shows only real users from the database
func (s *UserService) initMockUsers() {
	// Create the authenticated admin user
	adminID := uuid.MustParse("e3d81f0d-637f-4a35-b5bb-af028f3891d8")
	email := "hritthikin@gmail.com"
	name := "hritthik roy"
	picture := "https://lh3.googleusercontent.com/a/ACg8ocKrpAAoN6fE1VXZUHAKSY f9g8ed_ZInpnYQ7jmji3i4n-qG6g=s96-c"
	
	s.mockUsers[adminID.String()] = &models.User{
		ID:                  adminID,
		Email:               email,
		Name:                &name,
		ProfilePicture:      &picture,
		Role:                "admin",
		Plan:                "enterprise",
		SubscriptionStatus:  "active",
		UsageCurrentMonth:   0,
		UsageLastReset:      time.Now(),
		Settings:            map[string]interface{}{"language": "en", "aiMode": "auto", "autoGrammarFix": true},
		CreatedAt:           time.Now().Add(-30 * 24 * time.Hour), // 30 days ago
		UpdatedAt:           time.Now(),
	}
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
	// Get actual user count
	users, _ := s.GetAllUsers()
	userCount := len(users)
	
	// Calculate plan distribution
	planCounts := map[string]int{
		"free":       0,
		"starter":    0,
		"pro":        0,
		"unlimited":  0,
		"enterprise": 0,
	}
	
	for _, user := range users {
		if _, exists := planCounts[user.Plan]; exists {
			planCounts[user.Plan]++
		}
	}
	
	stats := map[string]interface{}{
		"total_users":       userCount,
		"active_users_24h":  0,
		"total_requests":    0,
		"success_rate":      0.0,
		"api_usage_percent": 0.0,
		"plans":             planCounts,
		"recent_signups":    0,
		"revenue_month":     0.0,
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