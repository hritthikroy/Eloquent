package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
)

type RazorpayService struct {
	keyID     string
	keySecret string
	baseURL   string
}

type RazorpayOrder struct {
	ID       string `json:"id"`
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
	Status   string `json:"status"`
}

type RazorpaySubscription struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	PlanID string `json:"plan_id"`
}

func NewRazorpayService(keyID, keySecret string) *RazorpayService {
	return &RazorpayService{
		keyID:     keyID,
		keySecret: keySecret,
		baseURL:   "https://api.razorpay.com/v1",
	}
}

func (r *RazorpayService) CreateOrder(amount int, currency, receipt string) (*RazorpayOrder, error) {
	orderData := map[string]interface{}{
		"amount":   amount, // amount in smallest currency unit (paise for INR)
		"currency": currency,
		"receipt":  receipt,
	}
	
	jsonData, _ := json.Marshal(orderData)
	
	url := r.baseURL + "/orders"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	req.SetBasicAuth(r.keyID, r.keySecret)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var order RazorpayOrder
	if err := json.NewDecoder(resp.Body).Decode(&order); err != nil {
		return nil, err
	}
	
	return &order, nil
}

func (r *RazorpayService) CreateSubscription(planID, customerID string) (*RazorpaySubscription, error) {
	subscriptionData := map[string]interface{}{
		"plan_id":     planID,
		"customer_id": customerID,
		"total_count": 12, // 12 months
	}
	
	jsonData, _ := json.Marshal(subscriptionData)
	
	url := r.baseURL + "/subscriptions"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	req.SetBasicAuth(r.keyID, r.keySecret)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var subscription RazorpaySubscription
	if err := json.NewDecoder(resp.Body).Decode(&subscription); err != nil {
		return nil, err
	}
	
	return &subscription, nil
}

func (r *RazorpayService) VerifyWebhookSignature(payload []byte, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}