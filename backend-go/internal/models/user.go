package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                     uuid.UUID              `json:"id" db:"id"`
	Email                  string                 `json:"email" db:"email"`
	Name                   *string                `json:"name" db:"name"`
	GoogleID               *string                `json:"google_id" db:"google_id"`
	ProfilePicture         *string                `json:"profile_picture" db:"profile_picture"`
	Role                   string                 `json:"role" db:"role"`
	Plan                   string                 `json:"plan" db:"plan"`
	StripeCustomerID       *string                `json:"stripe_customer_id" db:"stripe_customer_id"`
	StripeSubscriptionID   *string                `json:"stripe_subscription_id" db:"stripe_subscription_id"`
	SubscriptionStatus     string                 `json:"subscription_status" db:"subscription_status"`
	SubscriptionEndDate    *time.Time             `json:"subscription_end_date" db:"subscription_end_date"`
	UsageCurrentMonth      int                    `json:"usage_current_month" db:"usage_current_month"`
	UsageLastReset         time.Time              `json:"usage_last_reset" db:"usage_last_reset"`
	Settings               map[string]interface{} `json:"settings" db:"settings"`
	CreatedAt              time.Time              `json:"created_at" db:"created_at"`
	LastLogin              *time.Time             `json:"last_login" db:"last_login"`
	UpdatedAt              time.Time              `json:"updated_at" db:"updated_at"`
}

type Device struct {
	ID         uuid.UUID `json:"id" db:"id"`
	UserID     uuid.UUID `json:"user_id" db:"user_id"`
	DeviceID   string    `json:"device_id" db:"device_id"`
	Name       string    `json:"name" db:"name"`
	LastActive time.Time `json:"last_active" db:"last_active"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type UsageLog struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	UserID         uuid.UUID  `json:"user_id" db:"user_id"`
	Type           string     `json:"type" db:"type"`
	Minutes        int        `json:"minutes" db:"minutes"`
	Mode           *string    `json:"mode" db:"mode"`
	Language       *string    `json:"language" db:"language"`
	ProcessingTime *int       `json:"processing_time" db:"processing_time"`
	Success        bool       `json:"success" db:"success"`
	ErrorMessage   *string    `json:"error_message" db:"error_message"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type UsageLimits struct {
	Minutes  int      `json:"minutes"`
	Features []string `json:"features"`
}

type UsageStats struct {
	CurrentMonth int `json:"current_month"`
	Limit        int `json:"limit"`
	Remaining    int `json:"remaining"`
}

// GetUsageLimits returns usage limits based on user plan
func (u *User) GetUsageLimits() UsageLimits {
	limits := map[string]UsageLimits{
		"free": {
			Minutes:  60,
			Features: []string{"basic_transcription"},
		},
		"starter": {
			Minutes:  180,
			Features: []string{"basic_transcription", "ai_rewrite"},
		},
		"pro": {
			Minutes:  600,
			Features: []string{"basic_transcription", "ai_rewrite", "custom_shortcuts", "priority_support"},
		},
		"unlimited": {
			Minutes:  -1,
			Features: []string{"basic_transcription", "ai_rewrite", "custom_shortcuts", "priority_support", "api_access"},
		},
		"enterprise": {
			Minutes:  -1,
			Features: []string{"all"},
		},
	}

	if limit, exists := limits[u.Plan]; exists {
		return limit
	}
	return limits["free"]
}

// CanUseFeature checks if user can use a specific feature
func (u *User) CanUseFeature(feature string) bool {
	limits := u.GetUsageLimits()
	for _, f := range limits.Features {
		if f == feature || f == "all" {
			return true
		}
	}
	return false
}

// HasRemainingMinutes checks if user has remaining minutes
func (u *User) HasRemainingMinutes(minutesNeeded int) bool {
	limits := u.GetUsageLimits()
	if limits.Minutes == -1 {
		return true // Unlimited
	}
	return u.UsageCurrentMonth+minutesNeeded <= limits.Minutes
}

// ShouldResetUsage checks if usage should be reset for new month
func (u *User) ShouldResetUsage() bool {
	now := time.Now()
	return now.Month() != u.UsageLastReset.Month() || now.Year() != u.UsageLastReset.Year()
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}

// GetRole returns the user's role, defaulting to "user" if not set
func (u *User) GetRole() string {
	if u.Role == "" {
		return "user"
	}
	return u.Role
}

// IsAdminEmail checks if an email should have admin privileges
func IsAdminEmail(email string) bool {
	adminEmails := []string{
		"hritthikin@gmail.com",
	}
	
	for _, adminEmail := range adminEmails {
		if email == adminEmail {
			return true
		}
	}
	return false
}