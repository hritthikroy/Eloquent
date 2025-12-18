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