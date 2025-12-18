package handlers

import (
	"net/http"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type PaymentHandler struct {
	stripeService *services.StripeService
	userService   *services.UserService
}

func NewPaymentHandler(
	stripeService *services.StripeService,
	userService *services.UserService,
) *PaymentHandler {
	return &PaymentHandler{
		stripeService: stripeService,
		userService:   userService,
	}
}

type CreatePaymentRequest struct {
	Gateway    string `json:"gateway"`    // "stripe", "paypal", "razorpay", "square"
	Amount     int64  `json:"amount"`     // amount in smallest currency unit
	Currency   string `json:"currency"`   // "USD", "INR", etc.
	PlanID     string `json:"planId"`     // for subscriptions
	SuccessURL string `json:"successUrl"`
	CancelURL  string `json:"cancelUrl"`
}

func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var req CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Currently only Stripe is supported
	if req.Gateway != "stripe" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only Stripe is currently supported"})
		return
	}

	session, err := h.stripeService.CreateCheckoutSession(
		user.Email,
		req.PlanID,
		req.SuccessURL,
		req.CancelURL,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Stripe session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"gateway":   "stripe",
		"sessionId": session.ID,
		"url":       session.URL,
	})
}

func (h *PaymentHandler) GetAvailableGateways(c *gin.Context) {
	gateways := []map[string]interface{}{
		{
			"id":          "stripe",
			"name":        "Stripe",
			"description": "Credit/Debit Cards worldwide",
			"currencies":  []string{"USD", "EUR", "GBP", "CAD", "AUD"},
		},
	}

	c.JSON(http.StatusOK, gin.H{"gateways": gateways})
}