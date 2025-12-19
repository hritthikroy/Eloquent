package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// PERFORMANCE BOOST: Token cache for faster authentication
type tokenCache struct {
	users map[string]*cacheEntry
	mutex sync.RWMutex
}

type cacheEntry struct {
	user      *services.SupabaseUser
	expiresAt time.Time
}

var cache = &tokenCache{
	users: make(map[string]*cacheEntry),
}

// PERFORMANCE BOOST: Optimized auth middleware with caching
func AuthMiddleware(supabaseService *services.SupabaseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No token provided"})
			c.Abort()
			return
		}

		// PERFORMANCE BOOST: Fast token extraction
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}
		
		token := authHeader[7:] // Skip "Bearer "
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Empty token"})
			c.Abort()
			return
		}

		// Development mode bypass for admin panel
		if token == "dev-token" {
			// Create a mock admin user for development
			devUser := &services.SupabaseUser{
				ID:    "dev-admin-user-id", // Use a recognizable dev ID
				Email: "hritthikin@gmail.com", // Admin email
				UserMetadata: map[string]interface{}{
					"name": "Development Admin",
				},
			}
			c.Set("user", devUser)
			c.Set("token", token)
			c.Set("dev_mode", true) // Flag to indicate dev mode
			c.Next()
			return
		}

		// PERFORMANCE BOOST: Check cache first
		cache.mutex.RLock()
		entry, exists := cache.users[token]
		cache.mutex.RUnlock()

		if exists && time.Now().Before(entry.expiresAt) {
			// Cache hit - use cached user
			c.Set("user", entry.user)
			c.Set("token", token)
			c.Next()
			return
		}

		// Cache miss or expired - fetch from Supabase
		user, err := supabaseService.GetUser(token)
		if err != nil {
			// PERFORMANCE BOOST: Remove invalid token from cache
			cache.mutex.Lock()
			delete(cache.users, token)
			cache.mutex.Unlock()
			
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// PERFORMANCE BOOST: Cache valid token for 5 minutes
		cache.mutex.Lock()
		cache.users[token] = &cacheEntry{
			user:      user,
			expiresAt: time.Now().Add(5 * time.Minute),
		}
		
		// PERFORMANCE BOOST: Cleanup expired entries periodically
		if len(cache.users) > 1000 {
			go cleanupExpiredTokens()
		}
		cache.mutex.Unlock()

		// Store user in context
		c.Set("user", user)
		c.Set("token", token)
		c.Next()
	}
}

// PERFORMANCE BOOST: Background cleanup of expired tokens
func cleanupExpiredTokens() {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	
	now := time.Now()
	for token, entry := range cache.users {
		if now.After(entry.expiresAt) {
			delete(cache.users, token)
		}
	}
}