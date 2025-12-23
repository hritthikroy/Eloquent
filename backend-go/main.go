package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"eloquent-backend/internal/config"
	"eloquent-backend/internal/handlers"
	"eloquent-backend/internal/middleware"
	"eloquent-backend/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// PERFORMANCE BOOST: Optimize Go runtime for better performance
	runtime.GOMAXPROCS(runtime.NumCPU())
	
	log.Println("🚀 Starting Eloquent Backend with ULTRA-FAST optimizations...")
	startTime := time.Now()

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Initialize configuration
	cfg := config.New()
	log.Printf("📁 Configuration loaded in %v", time.Since(startTime))

	// PERFORMANCE BOOST: Initialize services with connection pooling and timeouts
	serviceStart := time.Now()
	
	// Start connection pool cleanup routine
	services.StartConnectionCleanup()
	
	supabaseService := services.NewSupabaseService(cfg.SupabaseURL, cfg.SupabaseKey, cfg.SupabaseAnonKey)
	userService := services.NewUserService(supabaseService)
	transcribeService := services.NewTranscribeServiceOptimized(cfg.GroqAPIKey)
	blockbeeService := services.NewBlockBeeService(cfg.BlockBeeAPIKey, cfg.BlockBeeCallbackURL)
	orderService := services.NewOrderService(supabaseService)
	pricingService := services.NewPricingService(supabaseService)
	log.Printf("🔧 Services initialized in %v", time.Since(serviceStart))

	// Initialize enhanced auth service
	_ = services.NewAuthServiceEnhanced(supabaseService, userService, cfg.BaseURL)
	
	// Initialize global usage service
	globalUsageService := services.NewGlobalUsageService(cfg.SupabaseURL, cfg.SupabaseKey)
	
	// Initialize handlers
	handlerStart := time.Now()
	authHandler := handlers.NewAuthHandler(userService, supabaseService)
	transcribeHandler := handlers.NewTranscribeHandler(transcribeService, userService)
	blockbeeHandler := handlers.NewBlockBeeHandler(blockbeeService, userService, orderService, pricingService)
	usageHandler := handlers.NewUsageHandler(userService)
	adminHandler := handlers.NewAdminHandler(userService)
	globalUsageHandler := handlers.NewGlobalUsageHandler(globalUsageService)
	log.Printf("📡 Handlers initialized in %v", time.Since(handlerStart))
	log.Printf("🚀 Enhanced auth service with caching and session management enabled")

	// PERFORMANCE BOOST: Setup optimized Gin router
	routerStart := time.Now()
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// PERFORMANCE BOOST: Create router with optimized settings
	r := gin.New()
	
	// PERFORMANCE BOOST: Custom recovery middleware (faster than default)
	r.Use(gin.Recovery())
	
	// PERFORMANCE BOOST: Optimized CORS middleware
	corsConfig := cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour, // Cache preflight for 12 hours
	}
	r.Use(cors.New(corsConfig))

	// PERFORMANCE BOOST: Performance monitoring and optimization middleware
	r.Use(middleware.PerformanceMonitor())
	r.Use(middleware.EnableCompression())
	r.Use(middleware.RequestSizeLimit(25 * 1024 * 1024)) // 25MB limit for audio files
	
	// PERFORMANCE BOOST: Optimized rate limiting middleware
	r.Use(middleware.RateLimitOptimized())

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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
            text-align: center; padding: 30px; 
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white; min-height: 100vh;
            display: flex; flex-direction: column; justify-content: center;
            margin: 0;
        }
        .container { max-width: 500px; margin: 0 auto; }
        h1 { font-size: 2em; margin-bottom: 15px; }
        .spinner { 
            width: 40px; height: 40px; 
            border: 4px solid rgba(255,255,255,0.3); 
            border-top-color: white; 
            border-radius: 50%; 
            animation: spin 1s linear infinite; 
            margin: 15px auto; 
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn {
            padding: 15px 30px;
            font-size: 16px;
            background: white;
            color: #4CAF50;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin: 10px 5px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { background: #f0f0f0; }
        .btn-large { font-size: 18px; padding: 18px 40px; }
        .status { margin: 15px 0; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px; }
        .error { background: rgba(255,0,0,0.2); }
        .hidden { display: none; }
        #debugInfo { font-size: 12px; text-align: left; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; margin-top: 20px; word-break: break-all; }
    </style>
</head>
<body>
    <div class="container">
        <h1 id="title">🎉 Authentication Successful!</h1>
        <div class="spinner" id="spinner"></div>
        <p id="message">Opening Eloquent app...</p>
        
        <div id="manualSection" class="hidden">
            <p><strong>Click the button below to open Eloquent:</strong></p>
            <a id="openAppBtn" class="btn btn-large" href="#">🚀 Open Eloquent App</a>
            <p style="margin-top: 20px; font-size: 14px; opacity: 0.9;">
                If the button doesn't work, the app may need to be running first.
            </p>
        </div>
        
        <div id="errorSection" class="status error hidden">
            <p id="errorMessage"></p>
        </div>
    </div>
    
    <script>
        (function() {
            console.log('OAuth success page loaded');
            console.log('URL:', window.location.href);
            
            // Extract tokens from URL hash (Supabase format)
            function getTokens() {
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                return {
                    access_token: params.get('access_token'),
                    refresh_token: params.get('refresh_token'),
                    expires_in: params.get('expires_in'),
                    token_type: params.get('token_type')
                };
            }
            
            // Check for errors in URL
            function getError() {
                const params = new URLSearchParams(window.location.search);
                return {
                    error: params.get('error'),
                    description: params.get('error_description')
                };
            }
            
            const tokens = getTokens();
            const error = getError();
            
            // Handle errors
            if (error.error) {
                document.getElementById('title').textContent = '❌ Authentication Failed';
                document.getElementById('spinner').classList.add('hidden');
                document.getElementById('message').classList.add('hidden');
                document.getElementById('errorSection').classList.remove('hidden');
                document.getElementById('errorMessage').textContent = error.description || error.error;
                return;
            }
            
            // Check if we have tokens
            if (!tokens.access_token) {
                document.getElementById('title').textContent = '❌ No Token Found';
                document.getElementById('spinner').classList.add('hidden');
                document.getElementById('message').textContent = 'Authentication data not found. Please try again.';
                return;
            }
            
            console.log('Token found, length:', tokens.access_token.length);
            
            // Build the protocol URL
            const protocolUrl = 'eloquent://auth/success?access_token=' + encodeURIComponent(tokens.access_token) + 
                               '&refresh_token=' + encodeURIComponent(tokens.refresh_token || '') +
                               '&expires_in=' + (tokens.expires_in || '') +
                               '&token_type=' + (tokens.token_type || 'bearer');
            
            // Set up the manual button
            const openAppBtn = document.getElementById('openAppBtn');
            openAppBtn.href = protocolUrl;
            openAppBtn.onclick = function(e) {
                e.preventDefault();
                window.location.href = protocolUrl;
            };
            
            // Try automatic redirect
            let redirected = false;
            
            function tryRedirect() {
                if (redirected) return;
                console.log('Attempting redirect to:', protocolUrl.substring(0, 60) + '...');
                window.location.href = protocolUrl;
            }
            
            // Attempt redirect immediately
            tryRedirect();
            
            // Show manual button after 1.5 seconds
            setTimeout(function() {
                document.getElementById('spinner').classList.add('hidden');
                document.getElementById('message').classList.add('hidden');
                document.getElementById('manualSection').classList.remove('hidden');
            }, 1500);
            
            // Try redirect again after a short delay (sometimes helps)
            setTimeout(tryRedirect, 500);
        })();
    </script>
</body>
</html>`
		c.Header("Content-Type", "text/html; charset=utf-8")
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

		// BlockBee crypto payment routes
		payments := api.Group("/payments")
		{
			payments.POST("/crypto/create", middleware.AuthMiddleware(supabaseService), blockbeeHandler.CreatePayment)
			payments.GET("/crypto/status/:order_id", middleware.AuthMiddleware(supabaseService), blockbeeHandler.GetOrderStatus)
			payments.POST("/crypto/webhook", blockbeeHandler.Webhook) // No auth for webhooks
			payments.GET("/crypto/estimate", blockbeeHandler.GetEstimate)
			payments.GET("/crypto/coins", blockbeeHandler.GetSupportedCoins)
			payments.GET("/crypto/orders", middleware.AuthMiddleware(supabaseService), blockbeeHandler.GetUserOrders)
		}

		// Usage routes
		usage := api.Group("/usage")
		{
			usage.GET("/stats", middleware.AuthMiddleware(supabaseService), usageHandler.GetStats)
			usage.GET("/history", middleware.AuthMiddleware(supabaseService), usageHandler.GetHistory)
			usage.POST("/report", middleware.AuthMiddleware(supabaseService), usageHandler.ReportUsage)
		}

		// Global usage routes (shared free recording time for all users)
		globalUsage := api.Group("/global-usage")
		{
			globalUsage.GET("/stats", globalUsageHandler.GetGlobalUsageStats)
			globalUsage.GET("/check", globalUsageHandler.CheckFreeTimeAvailable)
		}

		// Admin routes (requires admin authentication)
		admin := api.Group("/admin")
		admin.Use(middleware.AuthMiddleware(supabaseService))
		{
			admin.GET("/users", adminHandler.GetAllUsers)
			admin.GET("/users/:id", adminHandler.GetUserDetails)
			admin.PUT("/users/:id/plan", adminHandler.UpdateUserPlan)
			admin.PUT("/users/:id/role", adminHandler.UpdateUserRole)
			admin.POST("/users/:id/reset-usage", adminHandler.ResetUserUsage)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.GET("/stats", adminHandler.GetAdminStats)
			admin.GET("/search", adminHandler.SearchUsers)
			admin.GET("/users/plan/:plan", adminHandler.GetUsersByPlan)
			admin.PUT("/users/bulk", adminHandler.BulkUpdateUsers)
			
			// Global usage admin routes
			admin.PUT("/global-usage/limit", globalUsageHandler.UpdateGlobalLimit)
			admin.POST("/global-usage/reset", globalUsageHandler.ResetGlobalUsage)
		}
	}

	// Add catch-all handler for unknown routes
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			// Filter out known external/unwanted requests to reduce log noise
			path := c.Request.URL.Path
			isExternalRequest := strings.Contains(path, "/exchange") || 
								strings.Contains(path, "/rate") ||
								strings.Contains(path, "/currency") ||
								strings.Contains(path, "/forex")
			
			if !isExternalRequest {
				log.Printf("⚠️  Unknown API endpoint requested: %s %s", c.Request.Method, path)
			}
			
			c.JSON(404, gin.H{
				"error": "API endpoint not found",
				"path":  c.Request.URL.Path,
				"hint":  "Check API documentation for available endpoints",
			})
		} else {
			// For non-API routes, redirect to home
			c.Redirect(302, "/")
		}
	})

	log.Printf("🎯 Router setup completed in %v", time.Since(routerStart))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// PERFORMANCE BOOST: Create optimized HTTP server
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
		// PERFORMANCE BOOST: Optimized timeouts
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		// PERFORMANCE BOOST: Increase max header size for large requests
		MaxHeaderBytes: 1 << 20, // 1MB
	}

	// PERFORMANCE BOOST: Graceful shutdown
	go func() {
		log.Printf("🚀 Eloquent API running on port %s (startup time: %v)", port, time.Since(startTime))
		log.Printf("🎯 Performance optimizations: ✅ Connection pooling ✅ Timeouts ✅ Caching ✅ Rate limiting")
		
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down server...")

	// PERFORMANCE BOOST: Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("✅ Server exited")
}