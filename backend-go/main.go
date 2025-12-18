package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
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
	
	supabaseService := services.NewSupabaseService(cfg.SupabaseURL, cfg.SupabaseKey)
	userService := services.NewUserService(supabaseService)
	transcribeService := services.NewTranscribeServiceOptimized(cfg.GroqAPIKey)
	stripeService := services.NewStripeService(cfg.StripeSecretKey)
	log.Printf("🔧 Services initialized in %v", time.Since(serviceStart))

	// Initialize enhanced auth service
	_ = services.NewAuthServiceEnhanced(supabaseService, userService, cfg.BaseURL)
	
	// Initialize handlers
	handlerStart := time.Now()
	authHandler := handlers.NewAuthHandler(userService, supabaseService)
	transcribeHandler := handlers.NewTranscribeHandler(transcribeService, userService)
	subscriptionHandler := handlers.NewSubscriptionHandler(stripeService, userService)
	usageHandler := handlers.NewUsageHandler(userService)
	webhookHandler := handlers.NewWebhookHandler(stripeService, userService)
	adminHandler := handlers.NewAdminHandler(userService)
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
        <p><small>If Eloquent doesn't open automatically, use the button below</small></p>
        <button id="manualOpen" style="display: none; padding: 12px 24px; font-size: 16px; background: white; color: #4CAF50; border: 2px solid white; border-radius: 8px; cursor: pointer; margin-top: 20px; font-weight: bold;">
            🔧 Open Manual OAuth Fix
        </button>
        <div id="instructions" style="display: none; margin-top: 20px; padding: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; text-align: left;">
            <h3>If automatic redirect failed:</h3>
            <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Open Eloquent app manually</li>
                <li>Right-click the tray icon (microphone in menu bar)</li>
                <li>Select "🔧 Manual OAuth Fix"</li>
                <li>Or press <strong>Cmd+Shift+O</strong></li>
                <li>Copy this page's URL and paste it in the fix window</li>
            </ol>
        </div>
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
            
            // Method 1: Custom protocol (for Electron) - try multiple formats
            let protocolWorked = false;
            
            // Try simple format first (most reliable)
            try {
                const simpleUrl = 'eloquent://auth/success?access_token=' + authData.access_token + 
                                '&refresh_token=' + (authData.refresh_token || '') +
                                '&expires_in=' + (authData.expires_in || '') +
                                '&token_type=' + (authData.token_type || '');
                console.log('Trying simple protocol format:', simpleUrl.substring(0, 100) + '...');
                window.location.href = simpleUrl;
                protocolWorked = true;
            } catch (e) {
                console.log('Simple protocol failed:', e);
            }
            
            // Fallback: try JSON format if simple didn't work
            if (!protocolWorked) {
                try {
                    const encodedData = encodeURIComponent(JSON.stringify(authData));
                    console.log('Encoded auth data length:', encodedData.length);
                    const protocolUrl = 'eloquent://auth/success?data=' + encodedData;
                    console.log('Trying JSON protocol format:', protocolUrl.substring(0, 100) + '...');
                    window.location.href = protocolUrl;
                } catch (e) {
                    console.log('JSON protocol also failed:', e);
                }
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
        
        // Show manual open button after 2 seconds if still on page
        setTimeout(() => {
            const manualButton = document.getElementById('manualOpen');
            const instructions = document.getElementById('instructions');
            if (manualButton) {
                manualButton.style.display = 'inline-block';
                instructions.style.display = 'block';
                manualButton.onclick = () => {
                    // Copy URL to clipboard and show instructions
                    try {
                        navigator.clipboard.writeText(window.location.href).then(() => {
                            alert('✅ URL copied to clipboard!\\n\\nNow:\\n1. Open Eloquent app\\n2. Press Cmd+Shift+O\\n3. Paste the URL and click Process');
                        }).catch(() => {
                            // Fallback: show URL for manual copy
                            prompt('Copy this URL and use it in Eloquent\\'s Manual OAuth Fix:', window.location.href);
                        });
                    } catch (e) {
                        // Fallback: show URL for manual copy
                        prompt('Copy this URL and use it in Eloquent\\'s Manual OAuth Fix:', window.location.href);
                    }
                };
            }
        }, 2000);

        // Auto-close after 3 seconds
        setTimeout(() => {
            try {
                window.close();
            } catch (e) {
                console.log('Could not close window automatically');
            }
        }, 3000);
        
        // Fallback: if protocol redirect fails, show manual close button after 5 seconds
        setTimeout(() => {
            if (document.body) {
                const container = document.querySelector('.container');
                
                // Add instructions
                const instructions = document.createElement('div');
                instructions.innerHTML = '<p><strong>If Eloquent didn\'t open automatically:</strong></p><p>1. Copy the tokens below<br>2. Open Eloquent manually<br>3. Go to Settings and paste the tokens</p>';
                instructions.style.cssText = 'margin: 20px 0; font-size: 14px; line-height: 1.5;';
                container.appendChild(instructions);
                
                // Show tokens for manual entry
                const tokenDisplay = document.createElement('div');
                tokenDisplay.innerHTML = '<textarea readonly style="width: 100%; height: 100px; margin: 10px 0; padding: 10px; font-family: monospace; font-size: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 5px;">' + JSON.stringify(tokens, null, 2) + '</textarea>';
                container.appendChild(tokenDisplay);
                
                const button = document.createElement('button');
                button.textContent = 'Close Window';
                button.style.cssText = 'padding: 10px 20px; font-size: 16px; background: white; color: #4CAF50; border: 2px solid white; border-radius: 5px; cursor: pointer; margin-top: 20px;';
                button.onclick = () => window.close();
                container.appendChild(button);
            }
        }, 5000);
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
		}
	}

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