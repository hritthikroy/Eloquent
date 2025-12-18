package config

import "os"

type Config struct {
	Environment      string
	Port             string
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
}

func New() *Config {
	return &Config{
		Environment:      getEnv("NODE_ENV", "development"),
		Port:             getEnv("PORT", "3000"),
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
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
