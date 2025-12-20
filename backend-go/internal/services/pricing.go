package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"eloquent-backend/internal/models"
)

// PricingService handles pricing plan operations
type PricingService struct {
	supabase *SupabaseService
}

// NewPricingService creates a new pricing service
func NewPricingService(supabase *SupabaseService) *PricingService {
	return &PricingService{
		supabase: supabase,
	}
}

// GetAllPlans returns all active pricing plans
func (s *PricingService) GetAllPlans() ([]*models.PricingPlan, error) {
	url := fmt.Sprintf("%s/rest/v1/pricing_plans?is_active=eq.true&order=display_order.asc", s.supabase.URL)

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
		return nil, fmt.Errorf("failed to fetch plans: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// If table doesn't exist, return default plans
		if resp.StatusCode == 404 || strings.Contains(string(body), "does not exist") {
			return s.getDefaultPlans(), nil
		}
		return nil, fmt.Errorf("API error: %s", string(body))
	}

	var plans []*models.PricingPlan
	if err := json.Unmarshal(body, &plans); err != nil {
		return nil, fmt.Errorf("failed to parse plans: %w", err)
	}

	// If no plans found, return defaults
	if len(plans) == 0 {
		return s.getDefaultPlans(), nil
	}

	return plans, nil
}

// GetPlanByID returns a specific pricing plan
func (s *PricingService) GetPlanByID(planID string) (*models.PricingPlan, error) {
	url := fmt.Sprintf("%s/rest/v1/pricing_plans?id=eq.%s", s.supabase.URL, planID)

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
		return nil, fmt.Errorf("failed to fetch plan: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var plans []*models.PricingPlan
	if err := json.Unmarshal(body, &plans); err != nil {
		return nil, fmt.Errorf("failed to parse plan: %w", err)
	}

	if len(plans) == 0 {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	return plans[0], nil
}

// UpdatePlan updates a pricing plan
func (s *PricingService) UpdatePlan(planID string, update *models.PricingPlanUpdate) (*models.PricingPlan, error) {
	// Build update data
	updateData := make(map[string]interface{})
	
	if update.Name != nil {
		updateData["name"] = *update.Name
	}
	if update.Description != nil {
		updateData["description"] = *update.Description
	}
	if update.PriceMonthly != nil {
		updateData["price_monthly"] = *update.PriceMonthly
	}
	if update.PriceYearly != nil {
		updateData["price_yearly"] = *update.PriceYearly
	}
	if update.MinutesPerDay != nil {
		updateData["minutes_per_day"] = *update.MinutesPerDay
	}
	if update.OverageRate != nil {
		updateData["overage_rate"] = *update.OverageRate
	}
	if update.Features != nil {
		featuresJSON, _ := json.Marshal(*update.Features)
		updateData["features"] = string(featuresJSON)
	}
	if update.IsPopular != nil {
		updateData["is_popular"] = *update.IsPopular
	}
	if update.IsActive != nil {
		updateData["is_active"] = *update.IsActive
	}
	if update.DisplayOrder != nil {
		updateData["display_order"] = *update.DisplayOrder
	}
	updateData["updated_at"] = time.Now().Format(time.RFC3339)

	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal update data: %w", err)
	}

	url := fmt.Sprintf("%s/rest/v1/pricing_plans?id=eq.%s", s.supabase.URL, planID)

	req, err := http.NewRequest("PATCH", url, strings.NewReader(string(jsonData)))
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
		return nil, fmt.Errorf("failed to update plan: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error: %s", string(body))
	}

	var plans []*models.PricingPlan
	if err := json.Unmarshal(body, &plans); err != nil {
		return nil, fmt.Errorf("failed to parse updated plan: %w", err)
	}

	if len(plans) == 0 {
		return nil, fmt.Errorf("plan not found after update")
	}

	return plans[0], nil
}

// CreatePlan creates a new pricing plan
func (s *PricingService) CreatePlan(plan *models.PricingPlan) (*models.PricingPlan, error) {
	planData := map[string]interface{}{
		"id":              plan.ID,
		"name":            plan.Name,
		"description":     plan.Description,
		"price_monthly":   plan.PriceMonthly,
		"price_yearly":    plan.PriceYearly,
		"minutes_per_day": plan.MinutesPerDay,
		"overage_rate":    plan.OverageRate,
		"features":        string(plan.Features),
		"is_popular":      plan.IsPopular,
		"is_active":       plan.IsActive,
		"display_order":   plan.DisplayOrder,
	}

	jsonData, err := json.Marshal(planData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal plan data: %w", err)
	}

	url := fmt.Sprintf("%s/rest/v1/pricing_plans", s.supabase.URL)

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
		return nil, fmt.Errorf("failed to create plan: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error: %s", string(body))
	}

	var plans []*models.PricingPlan
	if err := json.Unmarshal(body, &plans); err != nil {
		return nil, fmt.Errorf("failed to parse created plan: %w", err)
	}

	if len(plans) == 0 {
		return plan, nil
	}

	return plans[0], nil
}

// getDefaultPlans returns hardcoded default plans when database is not available
func (s *PricingService) getDefaultPlans() []*models.PricingPlan {
	yearly29 := 29.0
	yearly99 := 99.0
	yearly199 := 199.0
	overage005 := 0.05
	overage003 := 0.03

	return []*models.PricingPlan{
		{
			ID:            "free",
			Name:          "Free",
			Description:   "Try it out",
			PriceMonthly:  0,
			PriceYearly:   nil,
			MinutesPerDay: 5,
			OverageRate:   nil,
			Features:      json.RawMessage(`["5 minutes/day", "Basic transcription", "Standard mode only"]`),
			IsPopular:     false,
			IsActive:      true,
			DisplayOrder:  1,
		},
		{
			ID:            "starter",
			Name:          "Starter",
			Description:   "Perfect for light users",
			PriceMonthly:  2.99,
			PriceYearly:   &yearly29,
			MinutesPerDay: 15,
			OverageRate:   &overage005,
			Features:      json.RawMessage(`["15 minutes/day included", "$0.05/min over limit", "Basic AI enhancement", "Standard processing", "3 languages"]`),
			IsPopular:     false,
			IsActive:      true,
			DisplayOrder:  2,
		},
		{
			ID:            "pro",
			Name:          "Pro",
			Description:   "Most popular",
			PriceMonthly:  9.99,
			PriceYearly:   &yearly99,
			MinutesPerDay: 60,
			OverageRate:   &overage003,
			Features:      json.RawMessage(`["60 minutes/day included", "$0.03/min over limit", "Advanced AI enhancement", "Priority processing", "All languages"]`),
			IsPopular:     true,
			IsActive:      true,
			DisplayOrder:  3,
		},
		{
			ID:            "enterprise",
			Name:          "Enterprise",
			Description:   "Unlimited usage",
			PriceMonthly:  19.99,
			PriceYearly:   &yearly199,
			MinutesPerDay: -1,
			OverageRate:   nil,
			Features:      json.RawMessage(`["Unlimited minutes", "No overage charges", "Premium AI models", "Custom shortcuts", "Priority support"]`),
			IsPopular:     false,
			IsActive:      true,
			DisplayOrder:  4,
		},
	}
}
