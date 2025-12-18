package main

import (
	"log"
	"os"

	"eloquent-backend/internal/config"
	"eloquent-backend/internal/handlers"
	"eloquent-backend/internal/middleware"
	"eloquent-backend/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Initialize configuration
	cfg := config.New()

	// Initialize services
	supabaseService := services.NewSupabaseService(cfg.SupabaseURL, cfg.SupabaseKey)
	userService := services.NewUserService(supabaseService)
	transcribeService := services.NewTranscribeService(cfg.GroqAPIKey)
	stripeService := services.NewStripeService(cfg.StripeSecretKey)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(userService, supabaseService)
	transcribeHandler := handlers.NewTranscribeHandler(transcribeService, userService)
	subscriptionHandler := handlers.NewSubscriptionHandler(stripeService, userService)
	usageHandler := handlers.NewUsageHandler(userService)
	webhookHandler := handlers.NewWebhookHandler(stripeService, userService)

	// Setup Gin router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"app://eloquent", "https://eloquentapp.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Rate limiting middleware
	r.Use(middleware.RateLimit())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"timestamp": "2024-01-01T00:00:00Z",
		})
	})

	// API routes
	api := r.Group("/api")
	{
		// Auth routes
		auth := api.Group("/auth")
		{
			auth.POST("/google", authHandler.GoogleAuth)
			auth.POST("/validate", middleware.AuthMiddleware(supabaseService), authHandler.ValidateToken)
			auth.PUT("/settings", middleware.AuthMiddleware(supabaseService), authHandler.UpdateSettings)
			auth.POST("/logout", middleware.AuthMiddleware(supabaseService), authHandler.Logout)
			auth.DELETE("/account", middleware.AuthMiddleware(supabaseService), authHandler.DeleteAccount)
		}

		// Transcription routes
		transcribe := api.Group("/transcribe")
		{
			transcribe.POST("/audio", middleware.AuthMiddleware(supabaseService), transcribeHandler.TranscribeAudio)
			transcribe.GET("/api-key", middleware.AuthMiddleware(supabaseService), transcribeHandler.GetAPIKey)
		}

		// Subscription routes
		subscriptions := api.Group("/subscriptions")
		{
			subscriptions.POST("/create-checkout", middleware.AuthMiddleware(supabaseService), subscriptionHandler.CreateCheckout)
			subscriptions.POST("/create-portal", middleware.AuthMiddleware(supabaseService), subscriptionHandler.CreatePortal)
			subscriptions.GET("/status", middleware.AuthMiddleware(supabaseService), subscriptionHandler.GetStatus)
		}

		// Usage routes
		usage := api.Group("/usage")
		{
			usage.GET("/stats", middleware.AuthMiddleware(supabaseService), usageHandler.GetStats)
			usage.GET("/history", middleware.AuthMiddleware(supabaseService), usageHandler.GetHistory)
		}

		// Webhook routes (no auth middleware)
		webhooks := api.Group("/webhooks")
		{
			webhooks.POST("/stripe", webhookHandler.StripeWebhook)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 Eloquent API running on port %s", port)
	log.Fatal(r.Run(":" + port))
}