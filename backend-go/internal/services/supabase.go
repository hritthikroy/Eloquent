package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type SupabaseService struct {
	URL        string
	ServiceKey string
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

func NewSupabaseService(url, serviceKey string) *SupabaseService {
	return &SupabaseService{
		URL:        url,
		ServiceKey: serviceKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *SupabaseService) GetUser(token string) (*SupabaseUser, error) {
	url := fmt.Sprintf("%s/auth/v1/user", s.URL)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("apikey", s.ServiceKey)

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