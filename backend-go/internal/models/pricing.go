package models

import (
	"encoding/json"
	"strings"
	"time"
)

// FlexTime is a custom time type that handles multiple timestamp formats
type FlexTime struct {
	time.Time
}

// UnmarshalJSON handles multiple timestamp formats from Supabase
func (ft *FlexTime) UnmarshalJSON(data []byte) error {
	// Remove quotes
	s := strings.Trim(string(data), "\"")
	if s == "null" || s == "" {
		ft.Time = time.Time{}
		return nil
	}

	// Try different formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05.999999",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}

	var err error
	for _, format := range formats {
		ft.Time, err = time.Parse(format, s)
		if err == nil {
			return nil
		}
	}

	return err
}

// MarshalJSON formats time for JSON output
func (ft FlexTime) MarshalJSON() ([]byte, error) {
	if ft.Time.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(ft.Time.Format(time.RFC3339))
}

// PricingPlan represents a subscription plan
type PricingPlan struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Description   string          `json:"description"`
	PriceMonthly  float64         `json:"price_monthly"`
	PriceYearly   *float64        `json:"price_yearly,omitempty"`
	MinutesPerDay int             `json:"minutes_per_day"` // -1 for unlimited
	OverageRate   *float64        `json:"overage_rate,omitempty"`
	Features      json.RawMessage `json:"features"`
	IsPopular     bool            `json:"is_popular"`
	IsActive      bool            `json:"is_active"`
	DisplayOrder  int             `json:"display_order"`
	CreatedAt     FlexTime        `json:"created_at"`
	UpdatedAt     FlexTime        `json:"updated_at"`
}

// PricingPlanUpdate represents the fields that can be updated
type PricingPlanUpdate struct {
	Name          *string   `json:"name,omitempty"`
	Description   *string   `json:"description,omitempty"`
	PriceMonthly  *float64  `json:"price_monthly,omitempty"`
	PriceYearly   *float64  `json:"price_yearly,omitempty"`
	MinutesPerDay *int      `json:"minutes_per_day,omitempty"`
	OverageRate   *float64  `json:"overage_rate,omitempty"`
	Features      *[]string `json:"features,omitempty"`
	IsPopular     *bool     `json:"is_popular,omitempty"`
	IsActive      *bool     `json:"is_active,omitempty"`
	DisplayOrder  *int      `json:"display_order,omitempty"`
}

// GetFeaturesArray returns features as a string array
func (p *PricingPlan) GetFeaturesArray() []string {
	var features []string
	if err := json.Unmarshal(p.Features, &features); err != nil {
		return []string{}
	}
	return features
}
