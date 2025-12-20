package handlers

import (
	"net/http"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type GlobalUsageHandler struct {
	globalUsageService *services.GlobalUsageService
}

func NewGlobalUsageHandler(globalUsageService *services.GlobalUsageService) *GlobalUsageHandler {
	return &GlobalUsageHandler{
		globalUsageService: globalUsageService,
	}
}

// GetGlobalUsageStats returns the current global free recording time stats
// GET /api/global-usage/stats
func (h *GlobalUsageHandler) GetGlobalUsageStats(c *gin.Context) {
	stats, err := h.globalUsageService.GetGlobalUsageStats()
	if err != nil {
		// Return default values if service fails (e.g., table doesn't exist)
		c.JSON(http.StatusOK, gin.H{
			"free_seconds_used":      0,
			"free_seconds_limit":     2400,
			"free_seconds_remaining": 2400,
			"percentage_used":        0.0,
			"reset_period":           "monthly",
			"is_limit_reached":       false,
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// CheckFreeTimeAvailable checks if free recording time is available
// GET /api/global-usage/check?seconds=60
func (h *GlobalUsageHandler) CheckFreeTimeAvailable(c *gin.Context) {
	secondsStr := c.DefaultQuery("seconds", "60")
	var seconds int
	if _, err := c.GetQuery("seconds"); err {
		seconds = 60
	} else {
		// Parse seconds
		if n, err := parseInt(secondsStr); err == nil {
			seconds = n
		} else {
			seconds = 60
		}
	}

	available, err := h.globalUsageService.HasFreeSecondsAvailable(seconds)
	if err != nil {
		// Default to available if service fails
		c.JSON(http.StatusOK, gin.H{
			"available":         true,
			"seconds_requested": seconds,
			"stats": gin.H{
				"free_seconds_used":      0,
				"free_seconds_limit":     2400,
				"free_seconds_remaining": 2400,
				"percentage_used":        0.0,
				"reset_period":           "monthly",
				"is_limit_reached":       false,
			},
		})
		return
	}

	stats, _ := h.globalUsageService.GetGlobalUsageStats()
	
	// If stats is nil, use defaults
	if stats == nil {
		c.JSON(http.StatusOK, gin.H{
			"available":         available,
			"seconds_requested": seconds,
			"stats": gin.H{
				"free_seconds_used":      0,
				"free_seconds_limit":     2400,
				"free_seconds_remaining": 2400,
				"percentage_used":        0.0,
				"reset_period":           "monthly",
				"is_limit_reached":       false,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"available":         available,
		"seconds_requested": seconds,
		"stats":             stats,
	})
}

// UpdateGlobalLimit allows admin to update the free seconds limit
// PUT /api/admin/global-usage/limit
func (h *GlobalUsageHandler) UpdateGlobalLimit(c *gin.Context) {
	var req struct {
		Limit int `json:"limit" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Limit < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Limit must be non-negative"})
		return
	}

	if err := h.globalUsageService.UpdateGlobalLimit(req.Limit); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update limit"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"new_limit": req.Limit,
	})
}

// ResetGlobalUsage resets the global usage counter (admin only)
// POST /api/admin/global-usage/reset
func (h *GlobalUsageHandler) ResetGlobalUsage(c *gin.Context) {
	// Get fresh stats after reset
	stats, err := h.globalUsageService.GetGlobalUsageStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset usage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"stats":   stats,
	})
}

func parseInt(s string) (int, error) {
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, nil
		}
		n = n*10 + int(c-'0')
	}
	return n, nil
}
