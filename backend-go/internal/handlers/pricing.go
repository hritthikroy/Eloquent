package handlers

import (
	"log"
	"net/http"

	"eloquent-backend/internal/models"
	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type PricingHandler struct {
	pricingService *services.PricingService
	userService    *services.UserService
}

func NewPricingHandler(pricingService *services.PricingService, userService *services.UserService) *PricingHandler {
	return &PricingHandler{
		pricingService: pricingService,
		userService:    userService,
	}
}

// GetAllPlans returns all active pricing plans (public endpoint)
func (h *PricingHandler) GetAllPlans(c *gin.Context) {
	plans, err := h.pricingService.GetAllPlans()
	if err != nil {
		log.Printf("❌ Failed to fetch pricing plans: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pricing plans", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"plans":   plans,
	})
}

// GetPlanByID returns a specific pricing plan
func (h *PricingHandler) GetPlanByID(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plan ID is required"})
		return
	}

	plan, err := h.pricingService.GetPlanByID(planID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"plan":    plan,
	})
}

// UpdatePlan updates a pricing plan (admin only)
func (h *PricingHandler) UpdatePlan(c *gin.Context) {
	// Check if user is admin
	supabaseUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil || user.GetRole() != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plan ID is required"})
		return
	}

	var update models.PricingPlanUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updatedPlan, err := h.pricingService.UpdatePlan(planID, &update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update plan: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"plan":    updatedPlan,
		"message": "Plan updated successfully",
	})
}

// BulkUpdatePlans updates multiple pricing plans at once (admin only)
func (h *PricingHandler) BulkUpdatePlans(c *gin.Context) {
	// Check if user is admin
	supabaseUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil || user.GetRole() != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var updates []struct {
		ID     string                   `json:"id"`
		Update models.PricingPlanUpdate `json:"update"`
	}

	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	results := make([]map[string]interface{}, 0)
	for _, u := range updates {
		updatedPlan, err := h.pricingService.UpdatePlan(u.ID, &u.Update)
		if err != nil {
			results = append(results, map[string]interface{}{
				"id":      u.ID,
				"success": false,
				"error":   err.Error(),
			})
		} else {
			results = append(results, map[string]interface{}{
				"id":      u.ID,
				"success": true,
				"plan":    updatedPlan,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"results": results,
	})
}
