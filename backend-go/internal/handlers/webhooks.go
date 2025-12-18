package handlers

import (
	"io"
	"net/http"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type WebhookHandler struct {
	stripeService *services.StripeService
	userService   *services.UserService
}

func NewWebhookHandler(stripeService *services.StripeService, userService *services.UserService) *WebhookHandler {
	return &WebhookHandler{
		stripeService: stripeService,
		userService:   userService,
	}
}

func (h *WebhookHandler) StripeWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// In a real implementation, you would:
	// 1. Verify the webhook signature
	// 2. Parse the Stripe event
	// 3. Handle different event types (subscription created, updated, cancelled, etc.)
	// 4. Update user subscription status in database

	// For now, just acknowledge receipt
	c.JSON(http.StatusOK, gin.H{"received": true})
}