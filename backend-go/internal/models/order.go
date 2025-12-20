package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// CustomTime handles flexible time parsing from database
type CustomTime struct {
	time.Time
}

// UnmarshalJSON implements custom JSON unmarshaling for flexible time formats
func (ct *CustomTime) UnmarshalJSON(data []byte) error {
	var timeStr string
	if err := json.Unmarshal(data, &timeStr); err != nil {
		return err
	}

	// Try different time formats
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		time.RFC3339Nano,
	}

	for _, format := range formats {
		if t, err := time.Parse(format, timeStr); err == nil {
			ct.Time = t
			return nil
		}
	}

	// If all formats fail, try parsing as RFC3339 (fallback)
	t, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		return err
	}
	ct.Time = t
	return nil
}

// MarshalJSON implements custom JSON marshaling
func (ct CustomTime) MarshalJSON() ([]byte, error) {
	return json.Marshal(ct.Time.Format(time.RFC3339))
}

// CryptoOrder represents a crypto payment order
type CryptoOrder struct {
	ID             uuid.UUID   `json:"id"`
	OrderID        string      `json:"order_id"`
	UserID         *uuid.UUID  `json:"user_id,omitempty"`
	UserEmail      string      `json:"user_email"`
	PlanID         string      `json:"plan_id"`
	PlanName       string      `json:"plan_name"`
	AmountUSD      float64     `json:"amount_usd"`
	AmountCrypto   *float64    `json:"amount_crypto,omitempty"`
	Coin           string      `json:"coin"`
	PaymentAddress string      `json:"payment_address,omitempty"`
	PaymentURL     string      `json:"payment_url,omitempty"`
	QRCodeURL      string      `json:"qr_code_url,omitempty"`
	TxIDIn         string      `json:"txid_in,omitempty"`
	TxIDOut        string      `json:"txid_out,omitempty"`
	Confirmations  int         `json:"confirmations"`
	Status         string      `json:"status"` // pending, confirming, completed, failed, expired
	CreatedAt      CustomTime  `json:"created_at"`
	UpdatedAt      CustomTime  `json:"updated_at"`
	PaidAt         *CustomTime `json:"paid_at,omitempty"`
	ExpiresAt      CustomTime  `json:"expires_at"`
}

// OrderStatus constants
const (
	OrderStatusPending    = "pending"
	OrderStatusConfirming = "confirming"
	OrderStatusCompleted  = "completed"
	OrderStatusFailed     = "failed"
	OrderStatusExpired    = "expired"
)
