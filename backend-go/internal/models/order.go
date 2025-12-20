package models

import (
	"time"

	"github.com/google/uuid"
)

// CryptoOrder represents a crypto payment order
type CryptoOrder struct {
	ID             uuid.UUID  `json:"id"`
	OrderID        string     `json:"order_id"`
	UserID         *uuid.UUID `json:"user_id,omitempty"`
	UserEmail      string     `json:"user_email"`
	PlanID         string     `json:"plan_id"`
	PlanName       string     `json:"plan_name"`
	AmountUSD      float64    `json:"amount_usd"`
	AmountCrypto   *float64   `json:"amount_crypto,omitempty"`
	Coin           string     `json:"coin"`
	PaymentAddress string     `json:"payment_address,omitempty"`
	PaymentURL     string     `json:"payment_url,omitempty"`
	QRCodeURL      string     `json:"qr_code_url,omitempty"`
	TxIDIn         string     `json:"txid_in,omitempty"`
	TxIDOut        string     `json:"txid_out,omitempty"`
	Confirmations  int        `json:"confirmations"`
	Status         string     `json:"status"` // pending, confirming, completed, failed, expired
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
	ExpiresAt      time.Time  `json:"expires_at"`
}

// OrderStatus constants
const (
	OrderStatusPending    = "pending"
	OrderStatusConfirming = "confirming"
	OrderStatusCompleted  = "completed"
	OrderStatusFailed     = "failed"
	OrderStatusExpired    = "expired"
)
