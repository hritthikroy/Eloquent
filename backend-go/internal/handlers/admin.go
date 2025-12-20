package handlers

import (
	"net/http"
	"strconv"
	"time"

	"eloquent-backend/internal/models"
	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	userService *services.UserService
}

func NewAdminHandler(userService *services.UserService) *AdminHandler {
	if userService == nil {
		panic("userService cannot be nil when creating AdminHandler")
	}
	return &AdminHandler{
		userService: userService,
	}
}

// Helper function to check admin access
func (h *AdminHandler) checkAdminAccess(c *gin.Context) (*models.User, bool) {
	// Safety check
	if h.userService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User service not initialized"})
		return nil, false
	}

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized - no user in context"})
		return nil, false
	}

	supabaseUser, ok := userInterface.(*services.SupabaseUser)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context type"})
		return nil, false
	}

	if supabaseUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User context is nil"})
		return nil, false
	}

	// Check if this is development mode
	if devMode, exists := c.Get("dev_mode"); exists && devMode.(bool) {
		// In dev mode, create a mock admin user
		mockUser := &models.User{
			Email: supabaseUser.Email,
			Role:  "admin",
			Plan:  "enterprise",
		}
		return mockUser, true
	}

	// Check if the email is an admin email (for users not yet in database)
	if supabaseUser.Email != "" && models.IsAdminEmail(supabaseUser.Email) {
		// Create a temporary admin user object
		mockUser := &models.User{
			Email: supabaseUser.Email,
			Role:  "admin",
			Plan:  "enterprise",
		}
		return mockUser, true
	}

	// Try to get user from database
	user, err := h.userService.GetUserByID(supabaseUser.ID)
	if err != nil {
		// User not found in database and not an admin email
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Admin access required",
			"details": "User not found in database or not an admin",
		})
		return nil, false
	}

	if !user.IsAdmin() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Admin access required",
			"details": "User does not have admin role",
		})
		return nil, false
	}

	return user, true
}

// GetAllUsers returns all users for admin management
func (h *AdminHandler) GetAllUsers(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	users, err := h.userService.GetAllUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// GetUserDetails returns detailed information about a specific user
func (h *AdminHandler) GetUserDetails(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	targetUserID := c.Param("id")
	targetUser, err := h.userService.GetUserByID(targetUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Get user's usage statistics
	usageStats, err := h.userService.GetUserUsageStats(targetUserID)
	if err != nil {
		usageStats = &models.UsageStats{CurrentMonth: 0, Limit: 0, Remaining: 0}
	}

	// Get user's recent usage logs
	usageLogs, err := h.userService.GetUserUsageLogs(targetUserID, 10) // Last 10 logs
	if err != nil {
		usageLogs = []models.UsageLog{}
	}

	response := gin.H{
		"user":        targetUser,
		"usage_stats": usageStats,
		"usage_logs":  usageLogs,
	}

	c.JSON(http.StatusOK, response)
}

// UpdateUserPlan updates a user's subscription plan
func (h *AdminHandler) UpdateUserPlan(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	targetUserID := c.Param("id")

	var req struct {
		Plan               string     `json:"plan" binding:"required"`
		SubscriptionStatus string     `json:"subscription_status"`
		SubscriptionEndDate *time.Time `json:"subscription_end_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Validate plan
	validPlans := []string{"free", "starter", "pro", "unlimited", "enterprise"}
	isValidPlan := false
	for _, plan := range validPlans {
		if req.Plan == plan {
			isValidPlan = true
			break
		}
	}

	if !isValidPlan {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan"})
		return
	}

	err := h.userService.UpdateUserPlan(targetUserID, req.Plan, req.SubscriptionStatus, req.SubscriptionEndDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User plan updated successfully"})
}

// UpdateUserRole updates a user's role
func (h *AdminHandler) UpdateUserRole(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	targetUserID := c.Param("id")

	var req struct {
		Role string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Validate role
	validRoles := []string{"user", "admin", "moderator"}
	isValidRole := false
	for _, role := range validRoles {
		if req.Role == role {
			isValidRole = true
			break
		}
	}

	if !isValidRole {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	err := h.userService.UpdateUserRole(targetUserID, req.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User role updated successfully"})
}

// ResetUserUsage resets a user's monthly usage
func (h *AdminHandler) ResetUserUsage(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	targetUserID := c.Param("id")

	err := h.userService.ResetUserUsage(targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset user usage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User usage reset successfully"})
}

// DeleteUser deletes a user account (admin only)
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	// Check admin access
	adminUser, ok := h.checkAdminAccess(c); 
	if !ok {
		return
	}

	targetUserID := c.Param("id")

	// Prevent admin from deleting themselves
	if targetUserID == adminUser.ID.String() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	err := h.userService.DeleteUser(targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// GetAdminStats returns admin dashboard statistics
func (h *AdminHandler) GetAdminStats(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	stats, err := h.userService.GetAdminStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch admin stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// SearchUsers searches for users by email or name
func (h *AdminHandler) SearchUsers(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	limit := 50 // Default limit
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	users, err := h.userService.SearchUsers(query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// GetUsersByPlan returns users filtered by plan
func (h *AdminHandler) GetUsersByPlan(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	plan := c.Param("plan")
	if plan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plan parameter is required"})
		return
	}

	users, err := h.userService.GetUsersByPlan(plan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users by plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// BulkUpdateUsers updates multiple users at once
func (h *AdminHandler) BulkUpdateUsers(c *gin.Context) {
	// Check admin access
	if _, ok := h.checkAdminAccess(c); !ok {
		return
	}

	var req struct {
		UserIDs []string `json:"user_ids" binding:"required"`
		Updates struct {
			Plan               *string    `json:"plan,omitempty"`
			Role               *string    `json:"role,omitempty"`
			SubscriptionStatus *string    `json:"subscription_status,omitempty"`
			SubscriptionEndDate *time.Time `json:"subscription_end_date,omitempty"`
		} `json:"updates" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	if len(req.UserIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No user IDs provided"})
		return
	}

	if len(req.UserIDs) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Too many users (max 100)"})
		return
	}

	results, err := h.userService.BulkUpdateUsers(req.UserIDs, req.Updates.Plan, req.Updates.Role, req.Updates.SubscriptionStatus, req.Updates.SubscriptionEndDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk update users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Bulk update completed",
		"results": results,
	})
}