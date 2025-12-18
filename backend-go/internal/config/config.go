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
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
