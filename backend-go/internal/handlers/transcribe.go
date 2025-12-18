package handlers

import (
	"io"
	"math"
	"net/http"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type TranscribeHandler struct {
	transcribeService *services.TranscribeService
	userService       *services.UserService
}

func NewTranscribeHandler(transcribeService *services.TranscribeService, userService *services.UserService) *TranscribeHandler {
	return &TranscribeHandler{
		transcribeService: transcribeService,
		userService:       userService,
	}
}

func (h *TranscribeHandler) TranscribeAudio(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	language := c.DefaultPostForm("language", "en")
	mode := c.DefaultPostForm("mode", "standard")

	// Check usage limits
	if !h.userService.HasRemainingMinutes(user, 1) {
		limits := h.userService.GetUsageLimits(user.Plan)
		c.JSON(http.StatusForbidden, gin.H{
			"error":        "Usage limit reached",
			"currentUsage": user.UsageCurrentMonth,
			"limit":        limits.Minutes,
			"upgradeUrl":   "/upgrade",
		})
		return
	}

	// Check if AI rewrite is allowed for this plan
	if mode == "rewrite" && !h.userService.CanUseFeature(user, "ai_rewrite") {
		c.JSON(http.StatusForbidden, gin.H{
			"error":      "AI rewrite requires Pro plan",
			"currentPlan": user.Plan,
			"upgradeUrl": "/upgrade",
		})
		return
	}

	// Get uploaded file
	file, header, err := c.Request.FormFile("audio")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No audio file provided"})
		return
	}
	defer file.Close()

	// Read file data
	audioData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read audio file"})
		return
	}

	// Check file size (25MB max)
	if len(audioData) > 25*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 25MB)"})
		return
	}

	// PERFORMANCE BOOST: Use worker pool for transcription
	var result *services.TranscriptionResult
	
	transcriptionErr := services.SubmitTranscriptionJob(c.Request.Context(), func() error {
		var transcribeErr error
		result, transcribeErr = h.transcribeService.TranscribeAudio(audioData, header.Filename, language, mode)
		return transcribeErr
	})
	
	if transcriptionErr != nil {
		// Log failed attempt
		h.userService.TrackUsage(
			user.ID.String(),
			0,
			"transcription",
			"standard",
			language,
			0,
			false,
			transcriptionErr.Error(),
		)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Transcription failed",
			"details": transcriptionErr.Error(),
		})
		return
	}
	
	if err != nil {
		// Log failed attempt
		h.userService.TrackUsage(
			user.ID.String(),
			0,
			"transcription",
			"standard",
			language,
			int(result.ProcessingTime),
			false,
			err.Error(),
		)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Transcription failed",
			"details": err.Error(),
		})
		return
	}

	// Estimate duration (rough: 32KB per second for 16kHz 16-bit mono)
	estimatedMinutes := int(math.Max(1, math.Ceil(float64(len(audioData))/32000/60)))

	// Track usage
	usageType := "transcription"
	if mode == "rewrite" {
		usageType = "ai_rewrite"
	}

	h.userService.TrackUsage(
		user.ID.String(),
		estimatedMinutes,
		usageType,
		mode,
		language,
		int(result.ProcessingTime),
		true,
	)

	// Get updated usage stats
	usageStats, _ := h.userService.GetUsageStats(user.ID.String())

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"text":           result.Text,
		"originalText":   result.OriginalText,
		"aiProcessed":    result.AIProcessed,
		"mode":           result.Mode,
		"processingTime": result.ProcessingTime,
		"usage":          usageStats,
	})
}

func (h *TranscribeHandler) GetAPIKey(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	// Check if user can access API
	if !h.userService.CanUseFeature(user, "api_access") {
		c.JSON(http.StatusForbidden, gin.H{"error": "API access requires Business plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"apiKey":    h.transcribeService.GetAPIKey(),
		"rateLimit": 100, // requests per day
		"expiresIn": 3600, // 1 hour
	})
}