package middleware

import (
	"net/http"
	"strings"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(supabaseService *services.SupabaseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No token provided"})
			c.Abort()
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		user, err := supabaseService.GetUser(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Store user in context
		c.Set("user", user)
		c.Set("token", token)
		c.Next()
	}
}