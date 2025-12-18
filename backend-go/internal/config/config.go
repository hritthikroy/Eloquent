package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Environment      string
	Port             string
	BaseURL          string
	SupabaseURL      string
	SupabaseKey      string
	GroqAPIKey       string
	StripeSecretKey  string
	StripeWebhookKey string
	
	// PayPal
	PayPalClientID     string
	PayPalClientSecret string
	PayPalSandbox      bool
	
	// Razorpay
	RazorpayKeyID     string
	RazorpayKeySecret string
	
	// Square
	SquareAccessToken string
	SquareEnvironment string
	SquareLocationID  string
	
	// PERFORMANCE BOOST: Performance-related configuration
	Performance PerformanceConfig
}

// PERFORMANCE BOOST: Performance configuration structure
type PerformanceConfig struct {
	// HTTP Client settings
	MaxIdleConns        int
	MaxIdleConnsPerHost int
	IdleConnTimeout     time.Duration
	RequestTimeout      time.Duration
	
	// Rate limiting
	RateLimitWindow   time.Duration
	RateLimitRequests int
	
	// Caching
	TokenCacheTTL     time.Duration
	ResponseCacheTTL  time.Duration
	
	// Concurrency
	MaxConcurrentRequests int
	WorkerPoolSize        int
}

func New() *Config {
	return &Config{
		Environment:      getEnv("NODE_ENV", "development"),
		Port:             getEnv("PORT", "3000"),
		BaseURL:          getEnv("ELOQUENT_API_URL", "http://localhost:3000"),
		SupabaseURL:      getEnv("SUPABASE_URL", ""),
		SupabaseKey:      getEnv("SUPABASE_SERVICE_KEY", ""),
		GroqAPIKey:       getEnv("GROQ_API_KEY", ""),
		StripeSecretKey:  getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookKey: getEnv("STRIPE_WEBHOOK_SECRET", ""),
		
		// PayPal
		PayPalClientID:     getEnv("PAYPAL_CLIENT_ID", ""),
		PayPalClientSecret: getEnv("PAYPAL_CLIENT_SECRET", ""),
		PayPalSandbox:      getEnv("PAYPAL_SANDBOX", "true") == "true",
		
		// Razorpay
		RazorpayKeyID:     getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret: getEnv("RAZORPAY_KEY_SECRET", ""),
		
		// Square
		SquareAccessToken: getEnv("SQUARE_ACCESS_TOKEN", ""),
		SquareEnvironment: getEnv("SQUARE_ENVIRONMENT", "sandbox"),
		SquareLocationID:  getEnv("SQUARE_LOCATION_ID", ""),
		
		// PERFORMANCE BOOST: Optimized performance settings
		Performance: PerformanceConfig{
			MaxIdleConns:          getEnvInt("MAX_IDLE_CONNS", 100),
			MaxIdleConnsPerHost:   getEnvInt("MAX_IDLE_CONNS_PER_HOST", 10),
			IdleConnTimeout:       getEnvDuration("IDLE_CONN_TIMEOUT", 90*time.Second),
			RequestTimeout:        getEnvDuration("REQUEST_TIMEOUT", 45*time.Second),
			RateLimitWindow:       getEnvDuration("RATE_LIMIT_WINDOW", 15*time.Minute),
			RateLimitRequests:     getEnvInt("RATE_LIMIT_REQUESTS", 100),
			TokenCacheTTL:         getEnvDuration("TOKEN_CACHE_TTL", 5*time.Minute),
			ResponseCacheTTL:      getEnvDuration("RESPONSE_CACHE_TTL", 1*time.Minute),
			MaxConcurrentRequests: getEnvInt("MAX_CONCURRENT_REQUESTS", 50),
			WorkerPoolSize:        getEnvInt("WORKER_POOL_SIZE", 10),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// PERFORMANCE BOOST: Helper functions for typed environment variables
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
