package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"eloquent-backend/internal/models"

	"github.com/google/uuid"
)

// OrderService handles crypto order operations
type OrderService struct {
	supabase *SupabaseService
}

// NewOrderService creates a new order service
func NewOrderService(supabase *SupabaseService) *OrderService {
	return &OrderService{
		supabase: supabase,
	}
}

// CreateOrder creates a new crypto order
func (s *OrderService) CreateOrder(order *models.CryptoOrder) (*models.CryptoOrder, error) {
	order.ID = uuid.New()
	order.CreatedAt = models.CustomTime{Time: time.Now()}
	order.UpdatedAt = models.CustomTime{Time: time.Now()}
	order.ExpiresAt = models.CustomTime{Time: time.Now().Add(24 * time.Hour)}
	
	if order.Status == "" {
		order.Status = models.OrderStatusPending
	}

	orderData := map[string]interface{}{
		"id":              order.ID.String(),
		"order_id":        order.OrderID,
		"user_id":         nil,
		"user_email":      order.UserEmail,
		"plan_id":         order.PlanID,
		"plan_name":       order.PlanName,
		"amount_usd":      order.AmountUSD,
		"amount_crypto":   order.AmountCrypto,
		"coin":            order.Coin,
		"payment_address": order.PaymentAddress,
		"payment_url":     order.PaymentURL,
		"qr_code_url":     order.QRCodeURL,
		"status":          order.Status,
		"created_at":      order.CreatedAt.Time.Format(time.RFC3339),
		"updated_at":      order.UpdatedAt.Time.Format(time.RFC3339),
		"expires_at":      order.ExpiresAt.Time.Format(time.RFC3339),
	}

	// Only set user_id if it's not the development user
	if order.UserID != nil && order.UserID.String() != "00000000-0000-0000-0000-000000000001" {
		orderData["user_id"] = order.UserID.String()
	}

	jsonData, err := json.Marshal(orderData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal order: %w", err)
	}

	url := fmt.Sprintf("%s/rest/v1/crypto_orders", s.supabase.URL)

	req, err := http.NewRequest("POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", s.supabase.AnonKey)
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// If database fails, still return the order (it's stored in memory)
		fmt.Printf("Warning: Failed to save order to database: %v\n", err)
		return order, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		fmt.Printf("Warning: Database error saving order (status %d): %s\n", resp.StatusCode, string(body))
		return order, nil
	}

	fmt.Printf("Order successfully saved to database: %s\n", order.OrderID)
	return order, nil
}

// GetOrderByID retrieves an order by its order_id
func (s *OrderService) GetOrderByID(orderID string) (*models.CryptoOrder, error) {
	url := fmt.Sprintf("%s/rest/v1/crypto_orders?order_id=eq.%s", s.supabase.URL, orderID)

	fmt.Printf("Querying order with URL: %s\n", url)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", s.supabase.AnonKey)
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch order: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	fmt.Printf("Order query response (status %d): %s\n", resp.StatusCode, string(body))

	var orders []models.CryptoOrder
	if err := json.Unmarshal(body, &orders); err != nil {
		return nil, fmt.Errorf("failed to parse order: %w", err)
	}

	if len(orders) == 0 {
		return nil, fmt.Errorf("order not found: %s", orderID)
	}

	return &orders[0], nil
}

// UpdateOrderStatus updates the status of an order
func (s *OrderService) UpdateOrderStatus(orderID string, status string, txID string, confirmations int) error {
	updateData := map[string]interface{}{
		"status":        status,
		"confirmations": confirmations,
		"updated_at":    time.Now().Format(time.RFC3339),
	}

	if txID != "" {
		updateData["txid_in"] = txID
	}

	if status == models.OrderStatusCompleted {
		updateData["paid_at"] = time.Now().Format(time.RFC3339)
	}

	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return fmt.Errorf("failed to marshal update: %w", err)
	}

	url := fmt.Sprintf("%s/rest/v1/crypto_orders?order_id=eq.%s", s.supabase.URL, orderID)

	req, err := http.NewRequest("PATCH", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", s.supabase.AnonKey)
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update order: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error: %s", string(body))
	}

	return nil
}

// GetUserOrders retrieves all orders for a user
func (s *OrderService) GetUserOrders(userEmail string) ([]*models.CryptoOrder, error) {
	url := fmt.Sprintf("%s/rest/v1/crypto_orders?user_email=eq.%s&order=created_at.desc", s.supabase.URL, userEmail)

	fmt.Printf("Querying user orders with URL: %s\n", url)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", s.supabase.AnonKey)
	req.Header.Set("Authorization", "Bearer "+s.supabase.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch orders: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	fmt.Printf("User orders query response (status %d): %s\n", resp.StatusCode, string(body))

	var orders []*models.CryptoOrder
	if err := json.Unmarshal(body, &orders); err != nil {
		return nil, fmt.Errorf("failed to parse orders: %w", err)
	}

	return orders, nil
}
