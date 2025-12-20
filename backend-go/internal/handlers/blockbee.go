package handlers

import (
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"

	"eloquent-backend/internal/models"
	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PlanInfo represents a subscription plan
type PlanInfo struct {
	ID           string
	Name         string
	PriceMonthly float64
	PriceYearly  *float64
}

type BlockBeeHandler struct {
	blockbeeService *services.BlockBeeService
	userService     *services.UserService
	orderService    *services.OrderService
	pricingService  *services.PricingService
}

func NewBlockBeeHandler(
	blockbeeService *services.BlockBeeService,
	userService *services.UserService,
	orderService *services.OrderService,
	pricingService *services.PricingService,
) *BlockBeeHandler {
	return &BlockBeeHandler{
		blockbeeService: blockbeeService,
		userService:     userService,
		orderService:    orderService,
		pricingService:  pricingService,
	}
}

// GetSupportedCoins returns list of supported cryptocurrencies
func (h *BlockBeeHandler) GetSupportedCoins(c *gin.Context) {
	coins, err := h.blockbeeService.GetSupportedCoins()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get supported coins"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"coins":   coins,
	})
}

// CreateCryptoPaymentRequest represents the request body for creating a payment
type CreateCryptoPaymentRequest struct {
	PlanID   string `json:"plan_id" binding:"required"` // Subscription plan
	Coin     string `json:"coin"`                       // Default: usdt_bep20
	Interval string `json:"interval"`                   // monthly or yearly
}

// CreatePayment creates a new crypto payment order
func (h *BlockBeeHandler) CreatePayment(c *gin.Context) {
	supabaseUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var req CreateCryptoPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Default to USDT BEP20
	if req.Coin == "" {
		req.Coin = "usdt_bep20"
	}

	// Get plan details - use hardcoded plans for now
	var plan *PlanInfo
	switch req.PlanID {
	case "starter":
		plan = &PlanInfo{
			ID:           "starter",
			Name:         "Starter",
			PriceMonthly: 2.99,
			PriceYearly:  &[]float64{29.0}[0],
		}
	case "pro":
		plan = &PlanInfo{
			ID:           "pro",
			Name:         "Pro",
			PriceMonthly: 9.99,
			PriceYearly:  &[]float64{99.0}[0],
		}
	case "enterprise":
		plan = &PlanInfo{
			ID:           "enterprise",
			Name:         "Enterprise",
			PriceMonthly: 19.99,
			PriceYearly:  &[]float64{199.0}[0],
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan: " + req.PlanID})
		return
	}

	// Determine price based on interval
	var amount float64
	if req.Interval == "yearly" && plan.PriceYearly != nil {
		amount = *plan.PriceYearly
	} else {
		amount = plan.PriceMonthly
	}

	if amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot purchase free plan"})
		return
	}

	// Generate unique order ID
	orderID := uuid.New().String()

	// Get crypto estimate
	estimate, err := h.blockbeeService.GetEstimate(req.Coin, amount, "USD")
	if err != nil {
		log.Printf("Failed to get estimate: %v", err)
		// Fallback: Use approximate USDT rate (1 USDT ≈ 1 USD) + BlockBee fee (0.25%)
		feeMultiplier := 1.0025 // Add 0.25% fee
		cryptoAmount := amount * feeMultiplier
		
		// Format with appropriate decimal places for USDT (2 decimal places like USD)
		formattedAmount := fmt.Sprintf("%.2f", cryptoAmount)
		
		estimate = &services.BlockBeeEstimate{
			Status:        "fallback",
			EstimatedCost: formattedAmount,
			ValueCoin:     formattedAmount,
			Exchange:      "1.0",
			CoinSymbol:    req.Coin,
		}
		log.Printf("Using fallback estimate: %s USDT for $%.2f (including 0.25%% fee)", estimate.ValueCoin, amount)
	}

	// Validate the estimate - if the crypto amount is suspiciously low, use fallback
	if estimate != nil && estimate.ValueCoin != "" {
		var cryptoValue float64
		if _, err := fmt.Sscanf(estimate.ValueCoin, "%f", &cryptoValue); err == nil {
			// If crypto amount is less than 10% of USD amount, something is wrong
			if cryptoValue < amount*0.1 {
				log.Printf("Suspicious estimate received: %f crypto for $%.2f USD, using fallback", cryptoValue, amount)
				feeMultiplier := 1.0025 // Add 0.25% fee
				cryptoAmount := amount * feeMultiplier
				
				// Format with appropriate decimal places for USDT (2 decimal places like USD)
				formattedAmount := fmt.Sprintf("%.2f", cryptoAmount)
				
				estimate = &services.BlockBeeEstimate{
					Status:        "fallback_suspicious",
					EstimatedCost: formattedAmount,
					ValueCoin:     formattedAmount,
					Exchange:      "1.0",
					CoinSymbol:    req.Coin,
				}
				log.Printf("Using corrected fallback estimate: %s USDT for $%.2f", estimate.ValueCoin, amount)
			}
		}
	}

	// Create BlockBee payment address
	paymentReq := services.BlockBeePaymentRequest{
		Coin:     req.Coin,
		Value:    amount,
		Currency: "USD",
		OrderID:  orderID,
		ItemDesc: fmt.Sprintf("Eloquent %s Plan (%s)", plan.Name, req.Interval),
		Email:    user.Email,
	}

	paymentAddress, err := h.blockbeeService.CreateCheckout(paymentReq,
		fmt.Sprintf("https://agile-basin-06335-9109082620ce.herokuapp.com/payment/success?order_id=%s", orderID),
		fmt.Sprintf("https://agile-basin-06335-9109082620ce.herokuapp.com/payment/cancel?order_id=%s", orderID),
	)

	if err != nil {
		log.Printf("Failed to create payment address: %v", err)
		// Fallback: Use a static address for manual payments
		paymentAddress = "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6" // Your receiving address
		log.Printf("Using fallback payment address: %s", paymentAddress)
	}

	// Create order record
	userID := user.ID
	var cryptoAmount *float64
	if estimate != nil && estimate.ValueCoin != "" {
		var amt float64
		fmt.Sscanf(estimate.ValueCoin, "%f", &amt)
		cryptoAmount = &amt
	}

	// Generate QR code URL for the payment
	qrCodeURL := fmt.Sprintf("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=%s", paymentAddress)
	log.Printf("Generated QR code URL: %s", qrCodeURL)

	// Try to fetch QR code as base64 for better compatibility
	qrCodeBase64 := ""
	if resp, err := http.Get(qrCodeURL); err == nil {
		defer resp.Body.Close()
		if qrData, err := io.ReadAll(resp.Body); err == nil {
			qrCodeBase64 = fmt.Sprintf("data:image/png;base64,%s", base64.StdEncoding.EncodeToString(qrData))
			log.Printf("Generated QR code base64 (length: %d)", len(qrCodeBase64))
		}
	}

	order := &models.CryptoOrder{
		OrderID:        orderID,
		UserID:         &userID,
		UserEmail:      user.Email,
		PlanID:         plan.ID,
		PlanName:       plan.Name,
		AmountUSD:      amount,
		AmountCrypto:   cryptoAmount,
		Coin:           req.Coin,
		PaymentAddress: paymentAddress,
		PaymentURL:     paymentAddress, // Store the payment address
		QRCodeURL:      qrCodeURL,
		Status:         models.OrderStatusPending,
	}

	// Save order to database
	savedOrder, err := h.orderService.CreateOrder(order)
	if err != nil {
		log.Printf("Warning: Failed to save order to database: %v", err)
		// Continue anyway - payment can still work
		savedOrder = order // Use the original order if save failed
	}

	// Ensure QR code URL is available in response even if not saved to DB
	if savedOrder.QRCodeURL == "" {
		savedOrder.QRCodeURL = qrCodeURL
	}

	log.Printf("Final QR code URL for response: %s", savedOrder.QRCodeURL)

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"order_id":        orderID,
		"payment_address": paymentAddress,
		"payment_amount":  estimate.ValueCoin,
		"payment_coin":    req.Coin,
		"qr_code_url":     savedOrder.QRCodeURL,
		"order":           savedOrder,
		"plan": gin.H{
			"id":       plan.ID,
			"name":     plan.Name,
			"price":    amount,
			"interval": req.Interval,
		},
		"estimate": gin.H{
			"coin":          req.Coin,
			"amount_crypto": estimate.ValueCoin,
			"amount_usd":    amount,
		},
		"payment_instructions": gin.H{
			"address":    paymentAddress,
			"amount":     estimate.ValueCoin,
			"coin":       req.Coin,
			"network":    "BEP20 (Binance Smart Chain)",
			"qr_code":    savedOrder.QRCodeURL,
			"qr_base64":  qrCodeBase64,
		},
	})
}

// GetEstimate returns crypto amount for fiat value
func (h *BlockBeeHandler) GetEstimate(c *gin.Context) {
	coin := c.DefaultQuery("coin", "usdt_bep20")
	planID := c.Query("plan_id")
	interval := c.DefaultQuery("interval", "monthly")

	var amount float64

	if planID != "" {
		// Get amount from plan
		plan, err := h.pricingService.GetPlanByID(planID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan"})
			return
		}

		if interval == "yearly" && plan.PriceYearly != nil {
			amount = *plan.PriceYearly
		} else {
			amount = plan.PriceMonthly
		}
	} else {
		// Get amount from query param
		amountStr := c.Query("amount")
		if amountStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "amount or plan_id is required"})
			return
		}
		fmt.Sscanf(amountStr, "%f", &amount)
	}

	if amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid amount"})
		return
	}

	estimate, err := h.blockbeeService.GetEstimate(coin, amount, "USD")
	if err != nil {
		log.Printf("Failed to get estimate: %v", err)
		// Fallback: Use approximate USDT rate (1 USDT ≈ 1 USD) + BlockBee fee (0.25%)
		feeMultiplier := 1.0025 // Add 0.25% fee
		cryptoAmount := amount * feeMultiplier
		
		// Format with appropriate decimal places for USDT (2 decimal places like USD)
		formattedAmount := fmt.Sprintf("%.2f", cryptoAmount)
		
		estimate = &services.BlockBeeEstimate{
			Status:        "fallback",
			EstimatedCost: formattedAmount,
			ValueCoin:     formattedAmount,
			Exchange:      "1.0",
			CoinSymbol:    coin,
		}
		log.Printf("Using fallback estimate: %s USDT for $%.2f", estimate.ValueCoin, amount)
	}

	// Validate the estimate - if the crypto amount is suspiciously low, use fallback
	if estimate != nil && estimate.ValueCoin != "" {
		var cryptoValue float64
		if _, err := fmt.Sscanf(estimate.ValueCoin, "%f", &cryptoValue); err == nil {
			// If crypto amount is less than 10% of USD amount, something is wrong
			if cryptoValue < amount*0.1 {
				log.Printf("Suspicious estimate received: %f crypto for $%.2f USD, using fallback", cryptoValue, amount)
				feeMultiplier := 1.0025 // Add 0.25% fee
				cryptoAmount := amount * feeMultiplier
				
				// Format with appropriate decimal places for USDT (2 decimal places like USD)
				formattedAmount := fmt.Sprintf("%.2f", cryptoAmount)
				
				estimate = &services.BlockBeeEstimate{
					Status:        "fallback_suspicious",
					EstimatedCost: formattedAmount,
					ValueCoin:     formattedAmount,
					Exchange:      "1.0",
					CoinSymbol:    coin,
				}
				log.Printf("Using corrected fallback estimate: %s USDT for $%.2f", estimate.ValueCoin, amount)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"estimate": gin.H{
			"coin":          coin,
			"amount_crypto": estimate.ValueCoin,
			"amount_usd":    amount,
			"exchange_rate": estimate.Exchange,
		},
	})
}

// GetOrderStatus returns the status of an order
func (h *BlockBeeHandler) GetOrderStatus(c *gin.Context) {
	orderID := c.Param("order_id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order ID is required"})
		return
	}

	order, err := h.orderService.GetOrderByID(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"order":   order,
	})
}

// GetUserOrders returns all orders for the authenticated user
func (h *BlockBeeHandler) GetUserOrders(c *gin.Context) {
	supabaseUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	orders, err := h.orderService.GetUserOrders(user.Email)
	if err != nil {
		log.Printf("Failed to get user orders: %v", err)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"orders":  []interface{}{},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"orders":  orders,
	})
}

// Webhook handles payment callbacks from BlockBee
func (h *BlockBeeHandler) Webhook(c *gin.Context) {
	// Parse callback data from query parameters
	var callback services.BlockBeeCallbackData
	callback.AddressIn = c.Query("address_in")
	callback.AddressOut = c.Query("address_out")
	callback.TxIDIn = c.Query("txid_in")
	callback.TxIDOut = c.Query("txid_out")
	callback.ValueCoin = c.Query("value_coin")
	callback.ValueForwarded = c.Query("value_forwarded")
	callback.Coin = c.Query("coin")
	callback.UUID = c.Query("uuid")

	// Get custom parameters
	orderID := c.Query("order_id")
	email := c.Query("email")

	// Parse confirmations
	if conf := c.Query("confirmations"); conf != "" {
		var confirmations int
		fmt.Sscanf(conf, "%d", &confirmations)
		callback.Confirmations = confirmations
	}

	// Parse pending status
	if pending := c.Query("pending"); pending == "1" {
		callback.Pending = 1
	}

	log.Printf("BlockBee webhook: order=%s, txid=%s, value=%s, confirmations=%d, pending=%d",
		orderID, callback.TxIDIn, callback.ValueCoin, callback.Confirmations, callback.Pending)

	// Validate callback
	if !h.blockbeeService.ValidateCallback(callback) {
		log.Printf("Invalid BlockBee callback")
		c.String(http.StatusBadRequest, "*not ok*")
		return
	}

	// Update order status
	if orderID != "" {
		var status string
		if callback.Pending == 1 {
			status = models.OrderStatusConfirming
		} else {
			status = models.OrderStatusCompleted
		}

		err := h.orderService.UpdateOrderStatus(orderID, status, callback.TxIDIn, callback.Confirmations)
		if err != nil {
			log.Printf("Failed to update order status: %v", err)
		}

		// If payment completed, update user subscription
		if status == models.OrderStatusCompleted {
			order, err := h.orderService.GetOrderByID(orderID)
			if err == nil && order != nil {
				log.Printf("Payment completed for order %s, upgrading user %s to plan %s",
					orderID, order.UserEmail, order.PlanID)

				// Update user plan
				if order.UserID != nil {
					h.userService.UpdateUserPlan(order.UserID.String(), order.PlanID, "active", nil)
				}
			}
		}
	}

	// Check if payment is pending
	if callback.Pending == 1 {
		log.Printf("Payment confirming for order %s", orderID)
		c.String(http.StatusOK, "*ok*")
		return
	}

	log.Printf("Payment completed for order %s, email: %s", orderID, email)

	// Return *ok* to acknowledge receipt
	c.String(http.StatusOK, "*ok*")
}
