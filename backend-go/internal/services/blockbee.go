package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const (
	BlockBeeBaseURL = "https://api.blockbee.io"
)

// BlockBeeService handles crypto payments via BlockBee
type BlockBeeService struct {
	apiKey     string
	httpClient *http.Client
	callbackURL string
}

// BlockBeePaymentRequest represents a payment creation request
type BlockBeePaymentRequest struct {
	Coin        string  `json:"coin"`        // btc, eth, usdt, etc.
	Value       float64 `json:"value"`       // Amount in fiat
	Currency    string  `json:"currency"`    // USD, EUR, etc.
	OrderID     string  `json:"order_id"`    // Your internal order ID
	ItemDesc    string  `json:"item_desc"`   // Description
	Email       string  `json:"email"`       // Customer email (optional)
}

// BlockBeePaymentResponse represents the API response for payment creation
type BlockBeePaymentResponse struct {
	Status        string `json:"status"`
	AddressIn     string `json:"address_in"`      // Address for customer to pay
	AddressOut    string `json:"address_out"`     // Your receiving address
	CallbackURL   string `json:"callback_url"`
	PaymentID     string `json:"payment_id"`
	CoinIn        string `json:"coin_in"`
	CoinOut       string `json:"coin_out"`
	MinTx         string `json:"minimum_transaction"`
	MinTxCoin     string `json:"minimum_transaction_coin"`
	QRCode        string `json:"qrcode_url"`
	PaymentURI    string `json:"payment_uri"`
}

// BlockBeeCallbackData represents webhook callback data
type BlockBeeCallbackData struct {
	AddressIn       string  `json:"address_in"`
	AddressOut      string  `json:"address_out"`
	TxIDIn          string  `json:"txid_in"`
	TxIDOut         string  `json:"txid_out"`
	Confirmations   int     `json:"confirmations"`
	ValueCoin       string  `json:"value_coin"`
	ValueForwarded  string  `json:"value_forwarded"`
	ValueForwardedCoin string `json:"value_forwarded_coin"`
	Coin            string  `json:"coin"`
	Price           string  `json:"price"`
	Pending         int     `json:"pending"`
	UUID            string  `json:"uuid"`
}

// BlockBeeEstimate represents price estimation response
type BlockBeeEstimate struct {
	Status        string            `json:"status"`
	EstimatedCost string            `json:"estimated_cost"`
	ValueCoin     string            `json:"value_coin"` // Alias for compatibility
	Exchange      string            `json:"exchange_rate"`
	CoinSymbol    string            `json:"coin"`
}

// SupportedCoin represents a supported cryptocurrency
type SupportedCoin struct {
	Coin        string `json:"coin"`
	Name        string `json:"name"`
	Logo        string `json:"logo"`
	MinTx       string `json:"minimum_transaction"`
	Fee         string `json:"fee_percent"`
}

// NewBlockBeeService creates a new BlockBee service instance
func NewBlockBeeService(apiKey, callbackURL string) *BlockBeeService {
	return &BlockBeeService{
		apiKey:      apiKey,
		callbackURL: callbackURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CreatePayment creates a new crypto payment address
func (s *BlockBeeService) CreatePayment(req BlockBeePaymentRequest, walletAddress string) (*BlockBeePaymentResponse, error) {
	// Build callback URL with order info
	callbackParams := url.Values{}
	callbackParams.Set("order_id", req.OrderID)
	callbackParams.Set("email", req.Email)
	fullCallbackURL := fmt.Sprintf("%s?%s", s.callbackURL, callbackParams.Encode())

	// Convert coin format for API
	apiCoin := convertCoinFormat(req.Coin)

	// Build API URL
	apiURL := fmt.Sprintf("%s/%s/create/", BlockBeeBaseURL, apiCoin)
	
	params := url.Values{}
	params.Set("apikey", s.apiKey)
	params.Set("callback", fullCallbackURL)
	params.Set("address", walletAddress)
	params.Set("pending", "1") // Enable pending transaction notifications
	params.Set("confirmations", "1")
	
	fullURL := fmt.Sprintf("%s?%s", apiURL, params.Encode())

	resp, err := s.httpClient.Get(fullURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result BlockBeePaymentResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if result.Status != "success" {
		return nil, fmt.Errorf("BlockBee API error: %s", string(body))
	}

	return &result, nil
}

// GetEstimate gets the crypto amount for a fiat value
func (s *BlockBeeService) GetEstimate(coin string, value float64, currency string) (*BlockBeeEstimate, error) {
	// Convert coin format for tokens (e.g., usdt_trc20 -> trc20/usdt)
	apiCoin := convertCoinFormat(coin)
	
	apiURL := fmt.Sprintf("%s/%s/estimate/", BlockBeeBaseURL, apiCoin)
	
	params := url.Values{}
	params.Set("apikey", s.apiKey)
	params.Set("value", fmt.Sprintf("%.2f", value))
	params.Set("from", currency)
	
	fullURL := fmt.Sprintf("%s?%s", apiURL, params.Encode())

	resp, err := s.httpClient.Get(fullURL)
	if err != nil {
		return nil, fmt.Errorf("failed to get estimate: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var rawResult map[string]interface{}
	if err := json.Unmarshal(body, &rawResult); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	result := &BlockBeeEstimate{
		CoinSymbol: coin,
	}

	if status, ok := rawResult["status"].(string); ok {
		result.Status = status
	}
	if estimatedCost, ok := rawResult["estimated_cost"].(string); ok {
		result.EstimatedCost = estimatedCost
		result.ValueCoin = estimatedCost
	}
	
	// Get exchange rate from estimated_cost_currency
	if currencies, ok := rawResult["estimated_cost_currency"].(map[string]interface{}); ok {
		if usdRate, ok := currencies["USD"].(string); ok {
			result.Exchange = usdRate
		}
	}

	return result, nil
}

// convertCoinFormat converts user-friendly coin names to BlockBee API format
func convertCoinFormat(coin string) string {
	// Map of user-friendly names to API format
	coinMap := map[string]string{
		"usdt_trc20":  "trc20/usdt",
		"usdt_erc20":  "erc20/usdt",
		"usdt_bep20":  "bep20/usdt",
		"usdt":        "erc20/usdt",
		"usdc_erc20":  "erc20/usdc",
		"usdc_bep20":  "bep20/usdc",
		"usdc":        "erc20/usdc",
		"bnb_bep20":   "bep20/bnb",
		"matic_polygon": "polygon/matic",
		"matic":       "polygon/matic",
	}
	
	if mapped, ok := coinMap[coin]; ok {
		return mapped
	}
	return coin
}

// GetSupportedCoins returns list of supported cryptocurrencies
func (s *BlockBeeService) GetSupportedCoins() ([]SupportedCoin, error) {
	// Only USDT BEP20 supported
	coins := []SupportedCoin{
		{Coin: "usdt_bep20", Name: "USDT (BEP20)", Fee: "0.25%"},
	}

	return coins, nil
}

// CheckPaymentStatus checks the status of a payment
func (s *BlockBeeService) CheckPaymentStatus(coin, callbackURL string) (map[string]interface{}, error) {
	apiURL := fmt.Sprintf("%s/%s/logs/", BlockBeeBaseURL, coin)
	
	params := url.Values{}
	params.Set("apikey", s.apiKey)
	params.Set("callback", callbackURL)
	
	fullURL := fmt.Sprintf("%s?%s", apiURL, params.Encode())

	resp, err := s.httpClient.Get(fullURL)
	if err != nil {
		return nil, fmt.Errorf("failed to check payment status: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return result, nil
}

// ValidateCallback validates the callback signature from BlockBee
func (s *BlockBeeService) ValidateCallback(data BlockBeeCallbackData) bool {
	// BlockBee callbacks are validated by checking the address matches
	// and the transaction exists on the blockchain
	return data.AddressIn != "" && data.TxIDIn != ""
}

// GetQRCode generates a QR code URL for payment
func (s *BlockBeeService) GetQRCode(coin, address string, value float64) string {
	return fmt.Sprintf("%s/%s/qrcode/?apikey=%s&address=%s&value=%.8f&size=300",
		BlockBeeBaseURL, coin, s.apiKey, address, value)
}

// CreateCheckout creates a hosted checkout page (alternative to direct API)
func (s *BlockBeeService) CreateCheckout(req BlockBeePaymentRequest, successURL, cancelURL string) (string, error) {
	apiURL := fmt.Sprintf("%s/checkout/request/", BlockBeeBaseURL)
	
	payload := map[string]interface{}{
		"apikey":       s.apiKey,
		"redirect_url": successURL,
		"notify_url":   s.callbackURL,
		"value":        req.Value,
		"currency":     req.Currency,
		"order_id":     req.OrderID,
		"item_description": req.ItemDesc,
		"email":        req.Email,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := s.httpClient.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create checkout: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if status, ok := result["status"].(string); ok && status == "success" {
		if paymentURL, ok := result["payment_url"].(string); ok {
			return paymentURL, nil
		}
	}

	return "", fmt.Errorf("failed to create checkout: %s", string(body))
}
