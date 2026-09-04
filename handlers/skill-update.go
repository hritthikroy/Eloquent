// Package handlers provides HTTP and IPC event handlers for the Eloquent backend.
package handlers

import (
	"eloquent-backend/internal/handlers"

	"github.com/gin-gonic/gin"
)

// SkillUpdateBridge exposes the internal skill update handler to root callers.
type SkillUpdateBridge struct {
	handler *handlers.SkillUpdateHandler
}

// NewSkillUpdateBridge instantiates a new SkillUpdateBridge.
func NewSkillUpdateBridge(configDir string) *SkillUpdateBridge {
	return &SkillUpdateBridge{
		handler: handlers.NewSkillUpdateHandler(configDir),
	}
}

// UpdateSkillProfile proxies requests to internal handler.
func (b *SkillUpdateBridge) UpdateSkillProfile(c *gin.Context) {
	b.handler.UpdateSkillProfile(c)
}

// GetSkillProfile proxies requests to internal handler.
func (b *SkillUpdateBridge) GetSkillProfile(c *gin.Context) {
	b.handler.GetSkillProfile(c)
}

// GetSkillTelemetry proxies requests to internal handler.
func (b *SkillUpdateBridge) GetSkillTelemetry(c *gin.Context) {
	b.handler.GetSkillTelemetry(c)
}
