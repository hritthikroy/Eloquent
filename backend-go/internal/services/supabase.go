package services

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type SupabaseService struct {
	URL        string
	ServiceKey string
	AnonKey    string
	client     *http.Client
}

type SupabaseUser struct {
	ID           string                 `json:"id"`
	Email        string                 `json:"email"`
	UserMetadata map[string]interface{} `json:"user_metadata"`
}

type SupabaseAuthResponse struct {
	User  *SupabaseUser `json:"user"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func NewSupabaseService(url, serviceKey, anonKey string) *SupabaseService {
	return &SupabaseService{
		URL:        url,
		ServiceKey: serviceKey,
		AnonKey:    anonKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *SupabaseService) GetUser(token string) (*SupabaseUser, error) {
	// Development mode: Handle dev token
	if token == "dev-token" {
		return &SupabaseUser{
			ID:    "00000000-0000-0000-0000-000000000001", // Valid UUID for dev user
			Email: "hritthikin@gmail.com", // Admin email for development
			UserMetadata: map[string]interface{}{
				"name": "Development User",
			},
		}, nil
	}

	// Check for placeholder service key OR placeholder URL - use JWT decoding
	if s.URL == "https://your-project.supabase.co" ||
	   strings.Contains(s.ServiceKey, "placeholder_service_key") ||
	   s.ServiceKey == "" {
		// Decode JWT token to get user info without validating signature
		// This is for development/testing only
		user, err := s.decodeJWTToken(token)
		if err != nil {
			return nil, fmt.Errorf("failed to decode JWT token: %v", err)
		}
		return user, nil
	}

	url := fmt.Sprintf("%s/auth/v1/user", s.URL)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	// Use anon key for user token validation, fall back to service key if anon key not set
	apiKey := s.AnonKey
	if apiKey == "" {
		apiKey = s.ServiceKey
	}
	req.Header.Set("apikey", apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supabase auth failed with status: %d", resp.StatusCode)
	}

	var authResp SupabaseAuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return nil, err
	}

	if authResp.Error != nil {
		return nil, fmt.Errorf("supabase error: %s", authResp.Error.Message)
	}

	return authResp.User, nil
}

// decodeJWTToken decodes a JWT token without validating the signature
// This is for development/testing only when Supabase is not configured
func (s *SupabaseService) decodeJWTToken(token string) (*SupabaseUser, error) {
	// Split the token into parts
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT token format")
	}

	// Decode the payload (second part)
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode JWT payload: %v", err)
	}

	// Parse the payload JSON
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse JWT payload: %v", err)
	}

	// Extract user information
	userID, ok := claims["sub"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'sub' claim in JWT")
	}

	email, ok := claims["email"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'email' claim in JWT")
	}

	// Extract user metadata if available
	userMetadata := make(map[string]interface{})
	if metadata, ok := claims["user_metadata"].(map[string]interface{}); ok {
		userMetadata = metadata
	}

	return &SupabaseUser{
		ID:           userID,
		Email:        email,
		UserMetadata: userMetadata,
	}, nil
}

func (s *SupabaseService) DeleteUser(userID string) error {
	url := fmt.Sprintf("%s/auth/v1/admin/users/%s", s.URL, userID)
	
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+s.ServiceKey)
	req.Header.Set("apikey", s.ServiceKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to delete user: %d", resp.StatusCode)
	}

	return nil
}

func (s *SupabaseService) Query(table string, query interface{}) ([]byte, error) {
	url := fmt.Sprintf("%s/rest/v1/%s", s.URL, table)
	
	var body []byte
	var err error
	
	if query != nil {
		body, err = json.Marshal(query)
		if err != nil {
			return nil, err
		}
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.ServiceKey)
	req.Header.Set("apikey", s.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	result := make([]byte, 0)
	buf := make([]byte, 1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			result = append(result, buf[:n]...)
		}
		if err != nil {
			break
		}
	}

	return result, nil
}