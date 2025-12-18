package services

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
)

type PayPalService struct {
	clientID     string
	clientSecret string
	baseURL      string // sandbox: https://api.sandbox.paypal.com, live: https://api.paypal.com
}

type PayPalAccessToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type PayPalSubscription struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Links  []struct {
		Href   string `json:"href"`
		Rel    string `json:"rel"`
		Method string `json:"method"`
	} `json:"links"`
}

func NewPayPalService(clientID, clientSecret string, sandbox bool) *PayPalService {
	baseURL := "https://api.paypal.com"
	if sandbox {
		baseURL = "https://api.sandbox.paypal.com"
	}
	
	return &PayPalService{
		clientID:     clientID,
		clientSecret: clientSecret,
		baseURL:      baseURL,
	}
}

func (p *PayPalService) getAccessToken() (*PayPalAccessToken, error) {
	url := p.baseURL + "/v1/oauth2/token"
	
	data := strings.NewReader("grant_type=client_credentials")
	req, err := http.NewRequest("POST", url, data)
	if err != nil {
		return nil, err
	}
	
	req.SetBasicAuth(p.clientID, p.clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var token PayPalAccessToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, err
	}
	
	return &token, nil
}

func (p *PayPalService) CreateSubscription(planID, returnURL, cancelURL string) (*PayPalSubscription, error) {
	token, err := p.getAccessToken()
	if err != nil {
		return nil, err
	}
	
	subscriptionData := map[string]interface{}{
		"plan_id": planID,
		"application_context": map[string]string{
			"return_url": returnURL,
			"cancel_url": cancelURL,
		},
	}
	
	jsonData, _ := json.Marshal(subscriptionData)
	
	url := p.baseURL + "/v1/billing/subscriptions"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var subscription PayPalSubscription
	if err := json.NewDecoder(resp.Body).Decode(&subscription); err != nil {
		return nil, err
	}
	
	return &subscription, nil
}