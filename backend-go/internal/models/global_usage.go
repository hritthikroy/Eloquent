package models

import (
	"time"

	"github.com/google/uuid"
)

// GlobalUsage tracks system-wide free recording time shared by all users
type GlobalUsage struct {
	ID               string    `json:"id" db:"id"`
	FreeSecondsUsed  int       `json:"free_seconds_used" db:"free_seconds_used"`
	FreeSecondsLimit int       `json:"free_seconds_limit" db:"free_seconds_limit"`
	LastReset        time.Time `json:"last_reset" db:"last_reset"`
	ResetPeriod      string    `json:"reset_period" db:"reset_period"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// GlobalUsageLog tracks individual contributions to global usage
type GlobalUsageLog struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      *uuid.UUID `json:"user_id" db:"user_id"`
	SecondsUsed int        `json:"seconds_used" db:"seconds_used"`
	Mode        *string    `json:"mode" db:"mode"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// GlobalUsageStats is returned to frontend
type GlobalUsageStats struct {
	FreeSecondsUsed      int     `json:"free_seconds_used"`
	FreeSecondsLimit     int     `json:"free_seconds_limit"`
	FreeSecondsRemaining int     `json:"free_seconds_remaining"`
	PercentageUsed       float64 `json:"percentage_used"`
	ResetPeriod          string  `json:"reset_period"`
	IsLimitReached       bool    `json:"is_limit_reached"`
}

// HasFreeSecondsRemaining checks if there's free time available
func (g *GlobalUsage) HasFreeSecondsRemaining(secondsNeeded int) bool {
	return g.FreeSecondsUsed+secondsNeeded <= g.FreeSecondsLimit
}

// GetRemainingSeconds returns remaining free seconds
func (g *GlobalUsage) GetRemainingSeconds() int {
	remaining := g.FreeSecondsLimit - g.FreeSecondsUsed
	if remaining < 0 {
		return 0
	}
	return remaining
}

// ShouldReset checks if usage should be reset based on period
func (g *GlobalUsage) ShouldReset() bool {
	now := time.Now()
	switch g.ResetPeriod {
	case "daily":
		return now.Day() != g.LastReset.Day() || now.Month() != g.LastReset.Month() || now.Year() != g.LastReset.Year()
	case "weekly":
		_, currentWeek := now.ISOWeek()
		_, lastWeek := g.LastReset.ISOWeek()
		return currentWeek != lastWeek || now.Year() != g.LastReset.Year()
	case "monthly":
		return now.Month() != g.LastReset.Month() || now.Year() != g.LastReset.Year()
	default:
		return false
	}
}
