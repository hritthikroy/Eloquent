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
	r.Use(cors.Default())

	// Rate limiting middleware
	r.Use(middleware.RateLimit())

	// Root route - Landing page
	r.GET("/", func(c *gin.Context) {
		html := `<!DOCTYPE html>
<html>
<head>
    <title>Eloquent API</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; text-align: center; min-height: 100vh;
            display: flex; flex-direction: column; justify-content: center;
        }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { font-size: 3em; margin-bottom: 20px; }
        p { font-size: 1.2em; margin-bottom: 30px; opacity: 0.9; }
        .status { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
        .api-info { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎤 Eloquent API</h1>
        <p>Voice-to-text transcription service powered by AI</p>
        
        <div class="status">
            <h3>✅ Service Status: Online</h3>
            <p>All systems operational</p>
        </div>
        
        <div class="api-info">
            <h4>Available Endpoints:</h4>
            <p>🔐 /api/auth/* - Authentication services</p>
            <p>🎙️ /api/transcribe/* - Audio transcription</p>
            <p>💳 /api/subscriptions/* - Subscription management</p>
            <p>📊 /api/usage/* - Usage statistics</p>
            <p>🔔 /api/webhooks/* - Webhook handlers</p>
        </div>
        
        <p style="margin-top: 40px; opacity: 0.7;">
            This is the backend API for Eloquent Desktop App
        </p>
    </div>
</body>
</html>`
		c.Header("Content-Type", "text/html")
		c.String(200, html)
	})

	// OAuth success page - handles redirect from Supabase
	r.GET("/auth/success", func(c *gin.Context) {
		html := `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
            text-align: center; padding: 50px; 
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white; min-height: 100vh;
            display: flex; flex-direction: column; justify-content: center;
        }
        .container { max-width: 500px; margin: 0 auto; }
        h1 { font-size: 2.5em; margin-bottom: 20px; }
        .spinner { 
            width: 40px; height: 40px; 
            border: 4px solid rgba(255,255,255,0.3); 
            border-top-color: white; 
            border-radius: 50%; 
            animation: spin 1s linear infinite; 
            margin: 20px auto; 
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Success!</h1>
        <div class="spinner"></div>
        <p>Redirecting back to Eloquent...</p>
        <p><small>You can close this window if it doesn't close automatically</small></p>
    </div>
    
    <script>
        // Extract tokens from URL fragment (Supabase OAuth)
        function getTokensFromURL() {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            
            return {
                access_token: params.get('access_token'),
                refresh_token: params.get('refresh_token'),
                expires_in: params.get('expires_in'),
                token_type: params.get('token_type')
            };
        }
        
        // Send tokens to Electron app
        const tokens = getTokensFromURL();
        
        if (tokens.access_token) {
            console.log('✅ Tokens received:', tokens);
            
            // Try multiple methods to communicate with Electron
            const authData = {
                success: true,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                token_type: tokens.token_type
            };
            
            // Method 1: Custom protocol (for Electron)
            try {
                window.location.href = 'eloquent://auth/success?data=' + encodeURIComponent(JSON.stringify(authData));
            } catch (e) {
                console.log('Custom protocol failed, trying other methods...');
            }
            
            // Method 2: PostMessage (if opened in popup)
            if (window.opener) {
                window.opener.postMessage(authData, '*');
            }
            
            // Method 3: Local storage (fallback)
            localStorage.setItem('eloquent_auth_result', JSON.stringify(authData));
            
        } else {
            console.error('❌ No access token found in URL');
            
            // Check for error parameters
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error') || 'No access token received';
            
            const errorData = { success: false, error: error };
            
            try {
                window.location.href = 'eloquent://auth/error?data=' + encodeURIComponent(JSON.stringify(errorData));
            } catch (e) {
                console.log('Custom protocol failed for error');
            }
        }
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            try {
                window.close();
            } catch (e) {
                console.log('Cannot close window automatically');
            }
        }, 3000);
    </script>
</body>
</html>`
		c.Header("Content-Type", "text/html")
		c.String(200, html)
	})

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
			auth.GET("/callback", authHandler.OAuthCallback) // OAuth callback (no auth middleware)
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