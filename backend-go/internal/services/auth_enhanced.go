package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"eloquent-backend/internal/models"

	"github.com/google/uuid"
)

// AuthServiceEnhanced provides high-performance authentication with caching and session management
type AuthServiceEnhanced struct {
	supabase       *SupabaseService
	session        *SessionService
	userService    *UserService
	cache          *CacheService
	
	// Configuration
	baseURL        string
	isDevelopment  bool
	
	// Performance optimizations
	sessionCache   sync.Map // In-memory session cache
	userCache      sync.Map // In-memory user cache
	
	// Rate limiting
	rateLimiter    map[string]*time.Timer
	rateMutex      sync.RWMutex
}

type AuthResult struct {
	Success      bool                   `json:"success"`
	User         *models.User           `json:"user,omitempty"`
	Subscription map[string]interface{} `json:"subscription,omitempty"`
	Usage        *models.UsageStats     `json:"usage,omitempty"`
	Tokens       map[string]string      `json:"tokens,omitempty"`
	Error        string                 `json:"error,omitempty"`
	Offline      bool                   `json:"offline,omitempty"`
}

type SessionValidationResult struct {
	Valid        bool                   `json:"valid"`
	User         *models.User           `json:"user,omitempty"`
	Subscription map[string]interface{} `json:"subscription,omitempty"`
	Usage        *models.UsageStats     `json:"usage,omitempty"`
	Offline      bool                   `json:"offline,omitempty"`
	Reason       string                 `json:"reason,omitempty"`
}

func NewAuthServiceEnhanced(supabase *SupabaseService, userService *UserService, baseURL string) *AuthServiceEnhanced {
	deviceID := generateDeviceID()
	
	service := &AuthServiceEnhanced{
		supabase:      supabase,
		session:       NewSessionService(deviceID),
		userService:   userService,
		cache:         NewCacheService(),
		baseURL:       baseURL,
		isDevelopment: isDevMode(supabase.URL, supabase.ServiceKey),
		rateLimiter:   make(map[string]*time.Timer),
	}
	
	// Start cleanup routines
	go service.startCacheCleanup()
	go service.startRateLimitCleanup()
	
	return service
}

// High-performance Google authentication
func (a *AuthServiceEnhanced) AuthenticateGoogle(ctx context.Context, accessToken, refreshToken string, userData map[string]interface{}, deviceID string) (*AuthResult, error) {
	// Rate limiting check
	if !a.checkRateLimit(deviceID) {
		return &AuthResult{
			Success: false,
			Error:   "Rate limit exceeded. Please try again later.",
		}, nil
	}
	
	// Development mode handling
	if a.isDevelopment {
		return a.handleDevelopmentAuth(userData, deviceID)
	}
	
	// Validate with Supabase (with timeout)
	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	
	supabaseUser, err := a.validateSupabaseToken(ctxTimeout, accessToken)
	if err != nil {
		return &AuthResult{
			Success: false,
			Error:   fmt.Sprintf("Supabase validation failed: %v", err),
		}, nil
	}
	
	// Create or update user
	user, err := a.userService.CreateOrUpdateGoogleUser(userData, deviceID)
	if err != nil {
		return &AuthResult{
			Success: false,
			Error:   fmt.Sprintf("User creation failed: %v", err),
		}, nil
	}
	
	// Cache user for performance
	a.cacheUser(user)
	
	// Get subscription and usage info
	subscription := a.buildSubscriptionInfo(user)
	usage, _ := a.userService.GetUsageStats(user.ID.String())
	
	// Store session
	sessionData := &SessionData{
		SupabaseSession: map[string]interface{}{
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"user_id":       supabaseUser.ID,
		},
		User:         a.userToMap(user),
		Subscription: subscription,
		Usage:        a.usageToMap(usage),
	}
	
	userDataPath := a.getUserDataPath()
	if err := a.session.StoreSession(sessionData, userDataPath); err != nil {
		// Log error but don't fail auth
		fmt.Printf("Warning: Failed to store session: %v\n", err)
	}
	
	return &AuthResult{
		Success:      true,
		User:         user,
		Subscription: subscription,
		Usage:        usage,
		Tokens: map[string]string{
			"access_token":  accessToken,
			"refresh_token": refreshToken,
		},
	}, nil
}

// High-performance session validation with caching
func (a *AuthServiceEnhanced) ValidateSession(ctx context.Context, token string, deviceID string) (*SessionValidationResult, error) {
	// Check cache first for performance
	if cached := a.getCachedSession(token); cached != nil {
		return cached, nil
	}
	
	// Development mode
	if a.isDevelopment {
		return a.handleDevelopmentValidation(deviceID)
	}
	
	// Try to load from disk
	userDataPath := a.getUserDataPath()
	sessionData, err := a.session.LoadSession(userDataPath)
	if err != nil || sessionData == nil {
		return &SessionValidationResult{
			Valid:  false,
			Reason: "No session found",
		}, nil
	}
	
	// Check if user is admin (offline access)
	if user := a.mapToUser(sessionData.User); user != nil && models.IsAdminEmail(user.Email) {
		result := &SessionValidationResult{
			Valid:   true,
			Offline: true,
			User:    user,
			Subscription: map[string]interface{}{
				"plan":   "enterprise",
				"status": "active",
			},
			Usage: &models.UsageStats{
				CurrentMonth: 0,
				Limit:        -1,
				Remaining:    -1,
			},
		}
		a.cacheSession(token, result, 5*time.Minute) // Cache for 5 minutes
		return result, nil
	}
	
	// Validate with Supabase (with retry logic)
	ctxTimeout, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	
	supabaseUser, err := a.validateSupabaseTokenWithRetry(ctxTimeout, token, 2)
	if err != nil {
		// Fallback to offline mode if we have cached data
		if user := a.mapToUser(sessionData.User); user != nil {
			result := &SessionValidationResult{
				Valid:        true,
				Offline:      true,
				User:         user,
				Subscription: sessionData.Subscription,
				Usage:        a.mapToUsage(sessionData.Usage),
			}
			a.cacheSession(token, result, 2*time.Minute) // Shorter cache for offline
			return result, nil
		}
		
		return &SessionValidationResult{
			Valid:  false,
			Reason: "Cannot validate session",
		}, nil
	}
	
	// Get fresh user data
	user, err := a.userService.GetUserByID(supabaseUser.ID)
	if err != nil {
		return &SessionValidationResult{
			Valid:  false,
			Reason: "User not found",
		}, nil
	}
	
	// Update usage if needed
	a.userService.CheckAndResetUsage(user.ID.String())
	
	subscription := a.buildSubscriptionInfo(user)
	usage, _ := a.userService.GetUsageStats(user.ID.String())
	
	result := &SessionValidationResult{
		Valid:        true,
		User:         user,
		Subscription: subscription,
		Usage:        usage,
	}
	
	// Cache successful validation
	a.cacheSession(token, result, 10*time.Minute)
	a.cacheUser(user)
	
	// Update stored session with fresh data
	sessionData.User = a.userToMap(user)
	sessionData.Subscription = subscription
	sessionData.Usage = a.usageToMap(usage)
	a.session.StoreSession(sessionData, userDataPath)
	
	return result, nil
}

// Logout with cleanup
func (a *AuthServiceEnhanced) Logout(userID string) error {
	// Clear caches
	a.clearUserCache(userID)
	
	// Clear session file
	userDataPath := a.getUserDataPath()
	return a.session.ClearSession(userDataPath)
}

// Performance optimizations and helper methods

func (a *AuthServiceEnhanced) checkRateLimit(deviceID string) bool {
	a.rateMutex.Lock()
	defer a.rateMutex.Unlock()
	
	if timer, exists := a.rateLimiter[deviceID]; exists {
		select {
		case <-timer.C:
			delete(a.rateLimiter, deviceID)
		default:
			return false // Rate limited
		}
	}
	
	// Set rate limit (1 request per 2 seconds per device)
	a.rateLimiter[deviceID] = time.NewTimer(2 * time.Second)
	return true
}

func (a *AuthServiceEnhanced) cacheSession(token string, result *SessionValidationResult, duration time.Duration) {
	a.sessionCache.Store(token, &cacheEntry{
		data:      result,
		expiresAt: time.Now().Add(duration),
	})
}

func (a *AuthServiceEnhanced) getCachedSession(token string) *SessionValidationResult {
	if entry, ok := a.sessionCache.Load(token); ok {
		cached := entry.(*cacheEntry)
		if time.Now().Before(cached.expiresAt) {
			return cached.data.(*SessionValidationResult)
		}
		a.sessionCache.Delete(token)
	}
	return nil
}

func (a *AuthServiceEnhanced) cacheUser(user *models.User) {
	a.userCache.Store(user.ID.String(), &cacheEntry{
		data:      user,
		expiresAt: time.Now().Add(5 * time.Minute),
	})
}

func (a *AuthServiceEnhanced) clearUserCache(userID string) {
	a.userCache.Delete(userID)
}

func (a *AuthServiceEnhanced) validateSupabaseToken(ctx context.Context, token string) (*SupabaseUser, error) {
	return a.supabase.GetUser(token)
}

func (a *AuthServiceEnhanced) validateSupabaseTokenWithRetry(ctx context.Context, token string, maxRetries int) (*SupabaseUser, error) {
	var lastErr error
	
	for attempt := 0; attempt < maxRetries; attempt++ {
		user, err := a.validateSupabaseToken(ctx, token)
		if err == nil {
			return user, nil
		}
		
		lastErr = err
		if attempt < maxRetries-1 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt+1) * 500 * time.Millisecond):
				// Exponential backoff
			}
		}
	}
	
	return nil, lastErr
}

func (a *AuthServiceEnhanced) handleDevelopmentAuth(userData map[string]interface{}, deviceID string) (*AuthResult, error) {
	user := &models.User{
		ID:                 uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Email:              "hritthikin@gmail.com",
		Role:               "admin",
		Plan:               "enterprise",
		SubscriptionStatus: "active",
		UsageCurrentMonth:  0,
		Settings: map[string]interface{}{
			"language":        "en",
			"aiMode":          "auto",
			"autoGrammarFix":  true,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	if name, ok := userData["name"].(string); ok {
		user.Name = &name
	}
	
	return &AuthResult{
		Success: true,
		User:    user,
		Subscription: map[string]interface{}{
			"plan":   "enterprise",
			"status": "active",
		},
		Usage: &models.UsageStats{
			CurrentMonth: 0,
			Limit:        -1,
			Remaining:    -1,
		},
		Tokens: map[string]string{
			"access_token": "dev-token",
		},
	}, nil
}

func (a *AuthServiceEnhanced) handleDevelopmentValidation(deviceID string) (*SessionValidationResult, error) {
	user := &models.User{
		ID:                 uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Email:              "hritthikin@gmail.com",
		Role:               "admin",
		Plan:               "enterprise",
		SubscriptionStatus: "active",
		UsageCurrentMonth:  0,
		Settings: map[string]interface{}{
			"language":        "en",
			"aiMode":          "auto",
			"autoGrammarFix":  true,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	return &SessionValidationResult{
		Valid: true,
		User:  user,
		Subscription: map[string]interface{}{
			"plan":   "enterprise",
			"status": "active",
		},
		Usage: &models.UsageStats{
			CurrentMonth: 0,
			Limit:        -1,
			Remaining:    -1,
		},
	}, nil
}

func (a *AuthServiceEnhanced) buildSubscriptionInfo(user *models.User) map[string]interface{} {
	// Override for admin users
	if models.IsAdminEmail(user.Email) {
		return map[string]interface{}{
			"plan":   "enterprise",
			"status": "active",
			"limits": models.UsageLimits{
				Minutes:  -1,
				Features: []string{"all"},
			},
		}
	}
	
	return map[string]interface{}{
		"plan":    user.Plan,
		"status":  user.SubscriptionStatus,
		"endDate": user.SubscriptionEndDate,
		"limits":  user.GetUsageLimits(),
	}
}

// Cleanup routines
func (a *AuthServiceEnhanced) startCacheCleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		now := time.Now()
		
		// Clean session cache
		a.sessionCache.Range(func(key, value interface{}) bool {
			entry := value.(*cacheEntry)
			if now.After(entry.expiresAt) {
				a.sessionCache.Delete(key)
			}
			return true
		})
		
		// Clean user cache
		a.userCache.Range(func(key, value interface{}) bool {
			entry := value.(*cacheEntry)
			if now.After(entry.expiresAt) {
				a.userCache.Delete(key)
			}
			return true
		})
	}
}

func (a *AuthServiceEnhanced) startRateLimitCleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		a.rateMutex.Lock()
		for deviceID, timer := range a.rateLimiter {
			select {
			case <-timer.C:
				delete(a.rateLimiter, deviceID)
			default:
				// Timer still active
			}
		}
		a.rateMutex.Unlock()
	}
}

// Helper functions
func (a *AuthServiceEnhanced) getUserDataPath() string {
	// In a real implementation, this would get the actual user data path
	// For now, use a temp directory
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".eloquent")
}

func (a *AuthServiceEnhanced) userToMap(user *models.User) map[string]interface{} {
	result := map[string]interface{}{
		"id":                  user.ID.String(),
		"email":               user.Email,
		"role":                user.Role,
		"plan":                user.Plan,
		"subscriptionStatus":  user.SubscriptionStatus,
		"usageCurrentMonth":   user.UsageCurrentMonth,
		"settings":            user.Settings,
		"createdAt":           user.CreatedAt,
		"updatedAt":           user.UpdatedAt,
	}
	
	if user.Name != nil {
		result["name"] = *user.Name
	}
	if user.ProfilePicture != nil {
		result["profilePicture"] = *user.ProfilePicture
	}
	
	return result
}

func (a *AuthServiceEnhanced) mapToUser(data map[string]interface{}) *models.User {
	if data == nil {
		return nil
	}
	
	user := &models.User{}
	
	if id, ok := data["id"].(string); ok {
		if parsed, err := uuid.Parse(id); err == nil {
			user.ID = parsed
		}
	}
	
	if email, ok := data["email"].(string); ok {
		user.Email = email
	}
	
	if role, ok := data["role"].(string); ok {
		user.Role = role
	}
	
	if plan, ok := data["plan"].(string); ok {
		user.Plan = plan
	}
	
	if status, ok := data["subscriptionStatus"].(string); ok {
		user.SubscriptionStatus = status
	}
	
	if usage, ok := data["usageCurrentMonth"].(float64); ok {
		user.UsageCurrentMonth = int(usage)
	}
	
	if settings, ok := data["settings"].(map[string]interface{}); ok {
		user.Settings = settings
	}
	
	if name, ok := data["name"].(string); ok {
		user.Name = &name
	}
	
	if picture, ok := data["profilePicture"].(string); ok {
		user.ProfilePicture = &picture
	}
	
	return user
}

func (a *AuthServiceEnhanced) usageToMap(usage *models.UsageStats) map[string]interface{} {
	if usage == nil {
		return map[string]interface{}{
			"currentMonth": 0,
			"limit":        60,
			"remaining":    60,
		}
	}
	
	return map[string]interface{}{
		"currentMonth": usage.CurrentMonth,
		"limit":        usage.Limit,
		"remaining":    usage.Remaining,
	}
}

func (a *AuthServiceEnhanced) mapToUsage(data map[string]interface{}) *models.UsageStats {
	if data == nil {
		return &models.UsageStats{
			CurrentMonth: 0,
			Limit:        60,
			Remaining:    60,
		}
	}
	
	usage := &models.UsageStats{}
	
	if current, ok := data["currentMonth"].(float64); ok {
		usage.CurrentMonth = int(current)
	}
	
	if limit, ok := data["limit"].(float64); ok {
		usage.Limit = int(limit)
	}
	
	if remaining, ok := data["remaining"].(float64); ok {
		usage.Remaining = int(remaining)
	}
	
	return usage
}

type cacheEntry struct {
	data      interface{}
	expiresAt time.Time
}

// Utility functions
func generateDeviceID() string {
	hostname, _ := os.Hostname()
	machineInfo := fmt.Sprintf("%s-%s-%s", hostname, runtime.GOOS, runtime.GOARCH)
	return fmt.Sprintf("%x", machineInfo)[:32]
}

func isDevMode(supabaseURL, serviceKey string) bool {
	return supabaseURL == "https://your-project.supabase.co" ||
		serviceKey == "placeholder_service_key" ||
		serviceKey == "" ||
		os.Getenv("FORCE_DEV_MODE") == "true"
}