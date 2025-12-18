package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	requests map[string][]time.Time
	mutex    sync.RWMutex
}

var limiter = &rateLimiter{
	requests: make(map[string][]time.Time),
}

func RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		
		limiter.mutex.Lock()
		defer limiter.mutex.Unlock()

		now := time.Now()
		windowStart := now.Add(-15 * time.Minute)

		// Clean old requests
		if requests, exists := limiter.requests[ip]; exists {
			var validRequests []time.Time
			for _, reqTime := range requests {
				if reqTime.After(windowStart) {
					validRequests = append(validRequests, reqTime)
				}
			}
			limiter.requests[ip] = validRequests
		}

		// Check if limit exceeded
		if len(limiter.requests[ip]) >= 100 {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many requests, please try again later.",
			})
			c.Abort()
			return
		}

		// Add current request
		limiter.requests[ip] = append(limiter.requests[ip], now)
		c.Next()
	}
}