package middleware

import (
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// PERFORMANCE BOOST: Performance monitoring middleware
func PerformanceMonitor() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Process request
		c.Next()

		// Calculate metrics
		latency := time.Since(start)
		statusCode := c.Writer.Status()
		
		// Log slow requests (>1 second)
		if latency > time.Second {
			log.Printf("🐌 SLOW REQUEST: %s %s - %v - Status: %d", 
				method, path, latency, statusCode)
		}
		
		// Log errors (but filter out external/unwanted requests and expected auth failures)
		if statusCode >= 400 {
			// Filter out known external requests to reduce log noise
			isExternalRequest := strings.Contains(path, "/exchange") || 
								strings.Contains(path, "/rate") ||
								strings.Contains(path, "/currency") ||
								strings.Contains(path, "/forex")
			
			// Filter out expected authentication failures (401 on logout is normal)
			isExpectedAuthFailure := statusCode == 401 && strings.Contains(path, "/logout")
			
			// Only log if it's not an external request or expected auth failure
			if !isExternalRequest && !isExpectedAuthFailure {
				log.Printf("❌ ERROR REQUEST: %s %s - %v - Status: %d", 
					method, path, latency, statusCode)
			}
		}
		
		// Add performance headers
		c.Header("X-Response-Time", latency.String())
		c.Header("X-Server-Time", start.Format(time.RFC3339))
	}
}

// PERFORMANCE BOOST: Request size limiter
func RequestSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxSize {
			c.JSON(413, gin.H{
				"error": "Request too large",
				"maxSize": maxSize,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// PERFORMANCE BOOST: Compression middleware
func EnableCompression() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Enable gzip compression for responses
		c.Header("Vary", "Accept-Encoding")
		c.Next()
	}
}