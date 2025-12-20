package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ULTRA-FAST Rate Limiter with optimized performance
type rateLimiter struct {
	requests map[string][]time.Time
	mutex    sync.RWMutex
	// PERFORMANCE BOOST: Add cleanup ticker to prevent memory leaks
	lastCleanup time.Time
}

var limiter = &rateLimiter{
	requests:    make(map[string][]time.Time),
	lastCleanup: time.Now(),
}

// PERFORMANCE BOOST: Optimized rate limiter with better memory management
func RateLimitOptimized() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip rate limiting for health checks - these should always be allowed
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}
		
		ip := c.ClientIP()
		now := time.Now()
		
		// PERFORMANCE BOOST: Use read lock first for better concurrency
		limiter.mutex.RLock()
		requests, exists := limiter.requests[ip]
		shouldCleanup := now.Sub(limiter.lastCleanup) > 5*time.Minute
		limiter.mutex.RUnlock()

		// PERFORMANCE BOOST: Periodic cleanup to prevent memory leaks
		if shouldCleanup {
			go func() {
				limiter.mutex.Lock()
				defer limiter.mutex.Unlock()
				
				if time.Since(limiter.lastCleanup) > 5*time.Minute {
					windowStart := now.Add(-15 * time.Minute)
					for ip, reqs := range limiter.requests {
						var validRequests []time.Time
						for _, reqTime := range reqs {
							if reqTime.After(windowStart) {
								validRequests = append(validRequests, reqTime)
							}
						}
						if len(validRequests) == 0 {
							delete(limiter.requests, ip)
						} else {
							limiter.requests[ip] = validRequests
						}
					}
					limiter.lastCleanup = now
				}
			}()
		}

		// PERFORMANCE BOOST: Fast path for new IPs
		if !exists {
			limiter.mutex.Lock()
			limiter.requests[ip] = []time.Time{now}
			limiter.mutex.Unlock()
			c.Next()
			return
		}

		// PERFORMANCE BOOST: Filter requests in-place for better performance
		windowStart := now.Add(-15 * time.Minute)
		validCount := 0
		for _, reqTime := range requests {
			if reqTime.After(windowStart) {
				validCount++
			}
		}

		// PERFORMANCE BOOST: Check limit before acquiring write lock
		// Higher limit for admin panel usage (500 requests per 15 minutes)
		if validCount >= 500 {
			c.Header("X-RateLimit-Limit", "500")
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", "900") // 15 minutes
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":     "Too many requests, please try again later.",
				"retryAfter": 900,
			})
			c.Abort()
			return
		}

		// PERFORMANCE BOOST: Update requests with write lock
		limiter.mutex.Lock()
		// Re-filter to ensure consistency
		var validRequests []time.Time
		for _, reqTime := range limiter.requests[ip] {
			if reqTime.After(windowStart) {
				validRequests = append(validRequests, reqTime)
			}
		}
		validRequests = append(validRequests, now)
		limiter.requests[ip] = validRequests
		remaining := 500 - len(validRequests)
		limiter.mutex.Unlock()

		// PERFORMANCE BOOST: Add rate limit headers
		c.Header("X-RateLimit-Limit", "500")
		c.Header("X-RateLimit-Remaining", string(rune(remaining)))
		c.Header("X-RateLimit-Reset", "900")

		c.Next()
	}
}

// Legacy function for backward compatibility
func RateLimit() gin.HandlerFunc {
	return RateLimitOptimized()
}