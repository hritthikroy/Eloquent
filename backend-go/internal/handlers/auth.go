package handlers

import (
	"net/http"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	userService     *services.UserService
	supabaseService *services.SupabaseService
}

func NewAuthHandler(userService *services.UserService, supabaseService *services.SupabaseService) *AuthHandler {
	return &AuthHandler{
		userService:     userService,
		supabaseService: supabaseService,
	}
}

type GoogleAuthRequest struct {
	AccessToken  string                 `json:"access_token"`
	RefreshToken string                 `json:"refresh_token"`
	User         map[string]interface{} `json:"user"`
	DeviceID     string                 `json:"deviceId"`
}

func (h *AuthHandler) GoogleAuth(c *gin.Context) {
	var req GoogleAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.User == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Supabase user data required"})
		return
	}

	// Create or update user
	user, err := h.userService.CreateOrUpdateGoogleUser(req.User, req.DeviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Authentication failed"})
		return
	}

	// Reset usage if needed
	h.userService.CheckAndResetUsage(user.ID.String())

	// Get usage stats
	usageStats, _ := h.userService.GetUsageStats(user.ID.String())

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"user": gin.H{
			"id":             user.ID,
			"email":          user.Email,
			"name":           user.Name,
			"plan":           user.Plan,
			"profilePicture": user.ProfilePicture,
			"settings":       user.Settings,
		},
		"tokens": gin.H{
			"access_token":  req.AccessToken,
			"refresh_token": req.RefreshToken,
		},
		"subscription": gin.H{
			"plan":    user.Plan,
			"status":  user.SubscriptionStatus,
			"endDate": user.SubscriptionEndDate,
			"limits":  user.GetUsageLimits(),
		},
		"usage": usageStats,
	})
}

type ValidateTokenRequest struct {
	DeviceID string `json:"deviceId"`
}

func (h *AuthHandler) ValidateToken(c *gin.Context) {
	supabaseUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	var req ValidateTokenRequest
	c.ShouldBindJSON(&req)

	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// Update device activity
	if req.DeviceID != "" {
		h.userService.AddOrUpdateDevice(user.ID.String(), req.DeviceID)
	}

	// Reset usage if needed
	h.userService.CheckAndResetUsage(user.ID.String())

	// Get usage stats
	usageStats, _ := h.userService.GetUsageStats(user.ID.String())

	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"user": gin.H{
			"id":             user.ID,
			"email":          user.Email,
			"name":           user.Name,
			"plan":           user.Plan,
			"profilePicture": user.ProfilePicture,
			"settings":       user.Settings,
		},
		"subscription": gin.H{
			"plan":    user.Plan,
			"status":  user.SubscriptionStatus,
			"endDate": user.SubscriptionEndDate,
			"limits":  user.GetUsageLimits(),
		},
		"usage": usageStats,
	})
}

type UpdateSettingsRequest struct {
	Language        *string `json:"language"`
	AIMode          *string `json:"aiMode"`
	AutoGrammarFix  *bool   `json:"autoGrammarFix"`
	Name            *string `json:"name"`
}

func (h *AuthHandler) UpdateSettings(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var req UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	newSettings := make(map[string]interface{})
	for k, v := range user.Settings {
		newSettings[k] = v
	}

	if req.Language != nil {
		newSettings["language"] = *req.Language
	}
	if req.AIMode != nil {
		newSettings["aiMode"] = *req.AIMode
	}
	if req.AutoGrammarFix != nil {
		newSettings["autoGrammarFix"] = *req.AutoGrammarFix
	}

	updatedUser, err := h.userService.UpdateSettings(user.ID.String(), newSettings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"settings": updatedUser.Settings,
		"name":     updatedUser.Name,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Logged out successfully",
	})
}

func (h *AuthHandler) DeleteAccount(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	// Delete user from Supabase Auth
	if err := h.supabaseService.DeleteUser(user.ID.String()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Account deleted successfully",
	})
}