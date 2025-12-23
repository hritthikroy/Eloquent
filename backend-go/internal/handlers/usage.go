package handlers

import (
	"net/http"
	"strconv"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type UsageHandler struct {
	userService *services.UserService
}

func NewUsageHandler(userService *services.UserService) *UsageHandler {
	return &UsageHandler{
		userService: userService,
	}
}

func (h *UsageHandler) GetStats(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	usageStats, err := h.userService.GetUsageStats(user.ID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get usage stats"})
		return
	}

	c.JSON(http.StatusOK, usageStats)
}

func (h *UsageHandler) GetHistory(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 50
	}

	history, err := h.userService.GetUsageHistory(user.ID.String(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get usage history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"history": history,
	})
}

// ReportUsage allows clients to report usage from local transcriptions
func (h *UsageHandler) ReportUsage(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		DurationSeconds int    `json:"duration_seconds"`
		Mode            string `json:"mode"`
		Language        string `json:"language"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Convert seconds to minutes (minimum 1 minute)
	minutes := (req.DurationSeconds + 59) / 60 // Round up
	if minutes < 1 {
		minutes = 1
	}

	// Check usage limits before tracking
	if !h.userService.HasRemainingMinutes(user, minutes) {
		limits := h.userService.GetUsageLimits(user.Plan)
		c.JSON(http.StatusForbidden, gin.H{
			"error":        "Usage limit reached",
			"currentUsage": user.UsageCurrentMonth,
			"limit":        limits.Minutes,
			"upgradeUrl":   "/upgrade",
		})
		return
	}

	// Track the usage
	usageType := "transcription"
	if req.Mode == "rewrite" {
		usageType = "ai_rewrite"
	}

	err = h.userService.TrackUsage(
		user.ID.String(),
		minutes,
		usageType,
		req.Mode,
		req.Language,
		0, // processing time not available for local transcriptions
		true,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track usage"})
		return
	}

	// Get updated usage stats
	usageStats, _ := h.userService.GetUsageStats(user.ID.String())

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"usage":   usageStats,
	})
}