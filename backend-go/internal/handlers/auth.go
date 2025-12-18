package handlers

import (
	"net/http"

	"eloquent-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	userService     *services.UserService
	supabaseService *services.SupabaseService
}

func NewAuthHandler(userService *services.UserService, supabaseService *services.SupabaseService) *AuthHandler {
	return &AuthHandler{
		userService:     userService,
		supabaseService: supabaseService,
	}
}

type GoogleAuthRequest struct {
	AccessToken  string                 `json:"access_token"`
	RefreshToken string                 `json:"refresh_token"`
	User         map[string]interface{} `json:"user"`
	DeviceID     string                 `json:"deviceId"`
}

func (h *AuthHandler) GoogleAuth(c *gin.Context) {
	var req GoogleAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.User == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Supabase user data required"})
		return
	}

	// Create or update user
	user, err := h.userService.CreateOrUpdateGoogleUser(req.User, req.DeviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Authentication failed"})
		return
	}

	// Reset usage if needed
	h.userService.CheckAndResetUsage(user.ID.String())

	// Get usage stats
	usageStats, _ := h.userService.GetUsageStats(user.ID.String())

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"user": gin.H{
			"id":             user.ID,
			"email":          user.Email,
			"name":           user.Name,
			"role":           user.GetRole(),
			"plan":           user.Plan,
			"profilePicture": user.ProfilePicture,
			"settings":       user.Settings,
		},
		"tokens": gin.H{
			"access_token":  req.AccessToken,
			"refresh_token": req.RefreshToken,
		},
		"subscription": gin.H{
			"plan":    user.Plan,
			"status":  user.SubscriptionStatus,
			"endDate": user.SubscriptionEndDate,
			"limits":  user.GetUsageLimits(),
		},
		"usage": usageStats,
	})
}

type ValidateTokenRequest struct {
	DeviceID string `json:"deviceId"`
}

func (h *AuthHandler) ValidateToken(c *gin.Context) {
	supabaseUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	var req ValidateTokenRequest
	c.ShouldBindJSON(&req)

	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// Update device activity
	if req.DeviceID != "" {
		h.userService.AddOrUpdateDevice(user.ID.String(), req.DeviceID)
	}

	// Reset usage if needed
	h.userService.CheckAndResetUsage(user.ID.String())

	// Get usage stats
	usageStats, _ := h.userService.GetUsageStats(user.ID.String())

	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"user": gin.H{
			"id":             user.ID,
			"email":          user.Email,
			"name":           user.Name,
			"role":           user.GetRole(),
			"plan":           user.Plan,
			"profilePicture": user.ProfilePicture,
			"settings":       user.Settings,
		},
		"subscription": gin.H{
			"plan":    user.Plan,
			"status":  user.SubscriptionStatus,
			"endDate": user.SubscriptionEndDate,
			"limits":  user.GetUsageLimits(),
		},
		"usage": usageStats,
	})
}

type UpdateSettingsRequest struct {
	Language        *string `json:"language"`
	AIMode          *string `json:"aiMode"`
	AutoGrammarFix  *bool   `json:"autoGrammarFix"`
	Name            *string `json:"name"`
}

func (h *AuthHandler) UpdateSettings(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var req UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	newSettings := make(map[string]interface{})
	for k, v := range user.Settings {
		newSettings[k] = v
	}

	if req.Language != nil {
		newSettings["language"] = *req.Language
	}
	if req.AIMode != nil {
		newSettings["aiMode"] = *req.AIMode
	}
	if req.AutoGrammarFix != nil {
		newSettings["autoGrammarFix"] = *req.AutoGrammarFix
	}

	updatedUser, err := h.userService.UpdateSettings(user.ID.String(), newSettings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"settings": updatedUser.Settings,
		"name":     updatedUser.Name,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Logged out successfully",
	})
}

// OAuth callback handler for production
func (h *AuthHandler) OAuthCallback(c *gin.Context) {
	// Get the session data from query parameters or fragments
	accessToken := c.Query("access_token")
	refreshToken := c.Query("refresh_token")
	
	if accessToken == "" {
		// Handle error case
		errorMsg := c.Query("error_description")
		if errorMsg == "" {
			errorMsg = "Authentication failed"
		}
		
		// Return HTML page that communicates with Electron app
		html := `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d32f2f; }
    </style>
</head>
<body>
    <h2 class="error">Authentication Failed</h2>
    <p>` + errorMsg + `</p>
    <p>You can close this window and try again.</p>
    <script>
        // Try to communicate with Electron app
        if (window.electronAPI) {
            window.electronAPI.authResult({ success: false, error: "` + errorMsg + `" });
        }
        // Auto-close after 3 seconds
        setTimeout(() => window.close(), 3000);
    </script>
</body>
</html>`
		c.Header("Content-Type", "text/html")
		c.String(http.StatusOK, html)
		return
	}

	// Success case - return HTML that communicates with Electron
	html := `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
        .success { color: #2e7d32; }
    </style>
</head>
<body>
    <h2 class="success">Authentication Successful!</h2>
    <p>Redirecting back to Eloquent...</p>
    <script>
        // Send tokens to Electron app
        const authData = {
            success: true,
            access_token: "` + accessToken + `",
            refresh_token: "` + refreshToken + `"
        };
        
        // Try multiple methods to communicate with Electron
        if (window.electronAPI) {
            window.electronAPI.authResult(authData);
        } else if (window.opener) {
            window.opener.postMessage(authData, '*');
        } else {
            // Fallback: try to trigger a custom event
            try {
                const encodedData = encodeURIComponent(JSON.stringify(authData));
                window.location.href = 'eloquent://auth/success?data=' + encodedData;
            } catch (e) {
                console.log('Protocol redirect failed:', e);
                // Try simple format
                window.location.href = 'eloquent://auth/success?access_token=' + authData.access_token + 
                                     '&refresh_token=' + (authData.refresh_token || '');
            }
        }
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            try {
                window.close();
            } catch (e) {
                console.log('Could not close window automatically');
            }
        }, 3000);
        
        // Show manual close button after 5 seconds if window is still open
        setTimeout(() => {
            if (document.body) {
                const button = document.createElement('button');
                button.textContent = 'Close Window';
                button.style.cssText = 'padding: 10px 20px; font-size: 16px; background: white; color: #2e7d32; border: 2px solid white; border-radius: 5px; cursor: pointer; margin-top: 20px; display: block; margin-left: auto; margin-right: auto;';
                button.onclick = () => window.close();
                document.body.appendChild(button);
            }
        }, 5000);
    </script>
</body>
</html>`

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, html)
}

func (h *AuthHandler) DeleteAccount(c *gin.Context) {
	supabaseUser, _ := c.Get("user")
	user, err := h.userService.GetUserByID(supabaseUser.(*services.SupabaseUser).ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	// Delete user from Supabase Auth
	if err := h.supabaseService.DeleteUser(user.ID.String()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Account deleted successfully",
	})
}