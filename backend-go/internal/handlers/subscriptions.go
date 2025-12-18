package handlers

import (
	"net/http"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type SubscriptionHandler struct {
	stripeService *services.StripeService
	userService   *services.UserService
}

func NewSubscriptionHandler(stripeService *services.StripeService, userService *services.UserService) *SubscriptionHandler {
	return &SubscriptionHandler{
		stripeService: stripeService,
		userService:   userService,
	}
}

type CreateCheckoutRequest struct {
	PriceID    string `json:"priceId"`
	SuccessURL string `json:"successUrl"`
	CancelURL  string `json:"cancelUrl"`
}

func (h *SubscriptionHandler) CreateCheckout(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var req CreateCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	session, err := h.stripeService.CreateCheckoutSession(
		user.Email,
		req.PriceID,
		req.SuccessURL,
		req.CancelURL,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create checkout session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sessionId": session.ID,
		"url":       session.URL,
	})
}

type CreatePortalRequest struct {
	ReturnURL string `json:"returnUrl"`
}

func (h *SubscriptionHandler) CreatePortal(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	if user.StripeCustomerID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Stripe customer found"})
		return
	}

	var req CreatePortalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	session, err := h.stripeService.CreatePortalSession(*user.StripeCustomerID, req.ReturnURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create portal session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url": session.URL,
	})
}

func (h *SubscriptionHandler) GetStatus(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"plan":    user.Plan,
		"status":  user.SubscriptionStatus,
		"endDate": user.SubscriptionEndDate,
		"limits":  user.GetUsageLimits(),
	})
}