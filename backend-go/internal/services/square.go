package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type SquareService struct {
	accessToken string
	baseURL     string
	environment string // "sandbox" or "production"
}

type SquarePayment struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Amount struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount_money"`
}

type SquareCheckoutRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
	Order          struct {
		LocationID string `json:"location_id"`
		LineItems  []struct {
			Quantity string `json:"quantity"`
			ItemType string `json:"item_type"`
			BasePrice struct {
				Amount   int64  `json:"amount"`
				Currency string `json:"currency"`
			} `json:"base_price_money"`
		} `json:"line_items"`
	} `json:"order"`
	CheckoutOptions struct {
		RedirectURL string `json:"redirect_url"`
	} `json:"checkout_options"`
}

func NewSquareService(accessToken, environment string) *SquareService {
	baseURL := "https://connect.squareup.com"
	if environment == "sandbox" {
		baseURL = "https://connect.squareupsandbox.com"
	}
	
	return &SquareService{
		accessToken: accessToken,
		baseURL:     baseURL,
		environment: environment,
	}
}

func (s *SquareService) CreatePayment(amount int64, currency, sourceID, locationID string) (*SquarePayment, error) {
	paymentData := map[string]interface{}{
		"source_id": sourceID,
		"idempotency_key": fmt.Sprintf("payment_%d", time.Now().UnixNano()),
		"amount_money": map[string]interface{}{
			"amount":   amount,
			"currency": currency,
		},
		"location_id": locationID,
	}
	
	jsonData, _ := json.Marshal(paymentData)
	
	url := s.baseURL + "/v2/payments"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+s.accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Square-Version", "2023-10-18")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result struct {
		Payment *SquarePayment `json:"payment"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	return result.Payment, nil
}

func (s *SquareService) CreateCheckoutLink(amount int64, currency, redirectURL, locationID string) (string, error) {
	checkoutData := SquareCheckoutRequest{
		IdempotencyKey: fmt.Sprintf("checkout_%d", time.Now().UnixNano()),
		Order: struct {
			LocationID string `json:"location_id"`
			LineItems  []struct {
				Quantity string `json:"quantity"`
				ItemType string `json:"item_type"`
				BasePrice struct {
					Amount   int64  `json:"amount"`
					Currency string `json:"currency"`
				} `json:"base_price_money"`
			} `json:"line_items"`
		}{
			LocationID: locationID,
			LineItems: []struct {
				Quantity string `json:"quantity"`
				ItemType string `json:"item_type"`
				BasePrice struct {
					Amount   int64  `json:"amount"`
					Currency string `json:"currency"`
				} `json:"base_price_money"`
			}{
				{
					Quantity: "1",
					ItemType: "ITEM_VARIATION",
					BasePrice: struct {
						Amount   int64  `json:"amount"`
						Currency string `json:"currency"`
					}{
						Amount:   amount,
						Currency: currency,
					},
				},
			},
		},
		CheckoutOptions: struct {
			RedirectURL string `json:"redirect_url"`
		}{
			RedirectURL: redirectURL,
		},
	}
	
	jsonData, _ := json.Marshal(checkoutData)
	
	url := s.baseURL + "/v2/online-checkout/payment-links"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	
	req.Header.Set("Authorization", "Bearer "+s.accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Square-Version", "2023-10-18")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	var result struct {
		PaymentLink struct {
			URL string `json:"url"`
		} `json:"payment_link"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	
	return result.PaymentLink.URL, nil
}