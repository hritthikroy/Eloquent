package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// AuthClient provides a high-performance Go client for auth operations
// This can be used by the Electron app via CGO or as a separate service
type AuthClient struct {
	baseURL    string
	httpClient *http.Client
	deviceID   string
}

type AuthRequest struct {
	AccessToken  string                 `json:"access_token"`
	RefreshToken string                 `json:"refresh_token"`
	User         map[string]interface{} `json:"user"`
	DeviceID     string                 `json:"deviceId"`
}

type AuthResponse struct {
	Success      bool                   `json:"success"`
	User         map[string]interface{} `json:"user,omitempty"`
	Subscription map[string]interface{} `json:"subscription,omitempty"`
	Usage        map[string]interface{} `json:"usage,omitempty"`
	Tokens       map[string]string      `json:"tokens,omitempty"`
	Error        string                 `json:"error,omitempty"`
}

type ValidateRequest struct {
	DeviceID string `json:"deviceId"`
}

type ValidateResponse struct {
	Valid        bool                   `json:"valid"`
	User         map[string]interface{} `json:"user,omitempty"`
	Subscription map[string]interface{} `json:"subscription,omitempty"`
	Usage        map[string]interface{} `json:"usage,omitempty"`
	Offline      bool                   `json:"offline,omitempty"`
	Reason       string                 `json:"reason,omitempty"`
}

func NewAuthClient(baseURL, deviceID string) *AuthClient {
	return &AuthClient{
		baseURL:  baseURL,
		deviceID: deviceID,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				IdleConnTimeout:     30 * time.Second,
				DisableCompression:  false,
				MaxIdleConnsPerHost: 5,
			},
		},
	}
}

// GoogleAuth performs Google authentication
func (c *AuthClient) GoogleAuth(ctx context.Context, accessToken, refreshToken string, userData map[string]interface{}) (*AuthResponse, error) {
	req := AuthRequest{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         userData,
		DeviceID:     c.deviceID,
	}
	
	return c.makeAuthRequest(ctx, "POST", "/api/auth/google", req)
}

// ValidateSession validates an existing session
func (c *AuthClient) ValidateSession(ctx context.Context, token string) (*ValidateResponse, error) {
	req := ValidateRequest{
		DeviceID: c.deviceID,
	}
	
	var resp ValidateResponse
	err := c.makeRequest(ctx, "POST", "/api/auth/validate", req, &resp, token)
	return &resp, err
}

// UpdateSettings updates user settings
func (c *AuthClient) UpdateSettings(ctx context.Context, token string, settings map[string]interface{}) (*AuthResponse, error) {
	var resp AuthResponse
	err := c.makeRequest(ctx, "PUT", "/api/auth/settings", settings, &resp, token)
	return &resp, err
}

// Logout logs out the user
func (c *AuthClient) Logout(ctx context.Context, token string) error {
	var resp map[string]interface{}
	return c.makeRequest(ctx, "POST", "/api/auth/logout", nil, &resp, token)
}

// Helper methods
func (c *AuthClient) makeAuthRequest(ctx context.Context, method, endpoint string, payload interface{}) (*AuthResponse, error) {
	var resp AuthResponse
	err := c.makeRequest(ctx, method, endpoint, payload, &resp, "")
	return &resp, err
}

func (c *AuthClient) makeRequest(ctx context.Context, method, endpoint string, payload interface{}, response interface{}, token string) error {
	var body []byte
	var err error
	
	if payload != nil {
		body, err = json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal request: %w", err)
		}
	}
	
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+endpoint, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		var errorResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errorResp)
		if msg, ok := errorResp["error"].(string); ok {
			return fmt.Errorf("API error: %s", msg)
		}
		return fmt.Errorf("API error: status %d", resp.StatusCode)
	}
	
	if response != nil {
		if err := json.NewDecoder(resp.Body).Decode(response); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}
	
	return nil
}

// Batch operations for better performance
func (c *AuthClient) BatchValidate(ctx context.Context, tokens []string) (map[string]*ValidateResponse, error) {
	results := make(map[string]*ValidateResponse)
	
	// Use goroutines for concurrent validation (limited concurrency)
	semaphore := make(chan struct{}, 5) // Max 5 concurrent requests
	resultChan := make(chan struct {
		token string
		resp  *ValidateResponse
		err   error
	}, len(tokens))
	
	for _, token := range tokens {
		go func(t string) {
			semaphore <- struct{}{} // Acquire
			defer func() { <-semaphore }() // Release
			
			resp, err := c.ValidateSession(ctx, t)
			resultChan <- struct {
				token string
				resp  *ValidateResponse
				err   error
			}{t, resp, err}
		}(token)
	}
	
	// Collect results
	for i := 0; i < len(tokens); i++ {
		result := <-resultChan
		if result.err == nil {
			results[result.token] = result.resp
		}
	}
	
	return results, nil
}

// Health check
func (c *AuthClient) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed: status %d", resp.StatusCode)
	}
	
	return nil
}