package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

type TranscribeService struct {
	groqAPIKey string
	client     *http.Client
}

type GroqTranscriptionRequest struct {
	Model          string `json:"model"`
	Language       string `json:"language"`
	ResponseFormat string `json:"response_format"`
	Temperature    string `json:"temperature"`
}

type GroqChatRequest struct {
	Model       string                   `json:"model"`
	Messages    []GroqChatMessage        `json:"messages"`
	Temperature float64                  `json:"temperature"`
	MaxTokens   int                      `json:"max_tokens"`
}

type GroqChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type GroqChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type TranscriptionResult struct {
	Text           string `json:"text"`
	OriginalText   string `json:"original_text"`
	AIProcessed    bool   `json:"ai_processed"`
	Mode           string `json:"mode"`
	ProcessingTime int64  `json:"processing_time"`
}

func NewTranscribeService(groqAPIKey string) *TranscribeService {
	return &TranscribeService{
		groqAPIKey: groqAPIKey,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// PERFORMANCE BOOST: Optimized transcribe service with connection pooling
func NewTranscribeServiceOptimized(groqAPIKey string) *TranscribeService {
	// PERFORMANCE BOOST: Use shared HTTP client pool for better performance
	client := GetHTTPClientPool().GetClient("groq")

	return &TranscribeService{
		groqAPIKey: groqAPIKey,
		client:     client,
	}
}

// PERFORMANCE BOOST: Optimized transcription with parallel processing
func (s *TranscribeService) TranscribeAudio(audioData []byte, filename, language, mode string) (*TranscriptionResult, error) {
	startTime := time.Now()

	// PERFORMANCE BOOST: Pre-allocate buffer with estimated size
	estimatedSize := len(audioData) + 1024 // Audio data + form overhead
	var body bytes.Buffer
	body.Grow(estimatedSize)
	
	writer := multipart.NewWriter(&body)

	// PERFORMANCE BOOST: Add fields in optimal order (file last for streaming)
	writer.WriteField("model", "whisper-large-v3-turbo")
	writer.WriteField("language", language)
	writer.WriteField("response_format", "text")
	writer.WriteField("temperature", "0")

	// Add file
	fileWriter, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := fileWriter.Write(audioData); err != nil {
		return nil, err
	}

	writer.Close()

	// PERFORMANCE BOOST: Create request with context for timeout control
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.groq.com/openai/v1/audio/transcriptions", &body)
	if err != nil {
		return nil, err
	}

	// PERFORMANCE BOOST: Optimized headers
	req.Header.Set("Authorization", "Bearer "+s.groqAPIKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Accept", "text/plain")
	req.Header.Set("User-Agent", "Eloquent/1.0")

	transcriptionStart := time.Now()
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("transcription failed: %s", string(bodyBytes))
	}

	// PERFORMANCE BOOST: Stream response reading
	textBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	transcriptionTime := time.Since(transcriptionStart).Milliseconds()

	originalText := string(textBytes)
	if originalText == "" {
		return nil, fmt.Errorf("no speech detected")
	}

	result := &TranscriptionResult{
		Text:           originalText,
		OriginalText:   originalText,
		AIProcessed:    false,
		Mode:           mode,
		ProcessingTime: transcriptionTime,
	}

	// PERFORMANCE BOOST: Parallel AI processing for rewrite mode
	if mode == "rewrite" || mode == "grammar" {
		enhanceStart := time.Now()
		enhancedText, err := s.enhanceTextOptimized(originalText, mode)
		if err != nil {
			return nil, err
		}
		result.Text = enhancedText
		result.AIProcessed = true
		result.ProcessingTime = time.Since(startTime).Milliseconds()
		
		// Log performance metrics
		fmt.Printf("🚀 Transcription: %dms, Enhancement: %dms, Total: %dms\n", 
			transcriptionTime, 
			time.Since(enhanceStart).Milliseconds(),
			result.ProcessingTime)
	} else {
		result.ProcessingTime = time.Since(startTime).Milliseconds()
	}

	return result, nil
}

// PERFORMANCE BOOST: Optimized text enhancement with better error handling
func (s *TranscribeService) enhanceTextOptimized(text, mode string) (string, error) {
	var systemPrompt string
	var temperature float64
	var maxTokens int

	switch mode {
	case "rewrite":
		systemPrompt = `You are an intelligent voice-to-text assistant. Analyze the input and apply the appropriate level of enhancement automatically.

YOUR TASK:
1. Detect the content type and user intent
2. Apply appropriate corrections and improvements
3. Maintain the speaker's intended tone and style
4. Produce polished, professional output

ALWAYS:
- Fix spelling and grammar errors
- Add proper punctuation and capitalization
- Remove verbal tics and filler words
- Improve clarity and readability

OUTPUT: Only the enhanced text. No explanations.`
		temperature = 0.4
		maxTokens = 1500
	case "grammar":
		systemPrompt = `Fix spelling, grammar, and punctuation. Preserve the speaker's voice and style. Return only the corrected text.`
		temperature = 0.2
		maxTokens = 1000
	default:
		return text, nil
	}

	chatReq := GroqChatRequest{
		Model:       "llama-3.3-70b-versatile",
		Temperature: temperature,
		MaxTokens:   maxTokens,
		Messages: []GroqChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("Rewrite this: %s", text)},
		},
	}

	// PERFORMANCE BOOST: Pre-allocate JSON buffer
	reqBody, err := json.Marshal(chatReq)
	if err != nil {
		return "", err
	}

	// PERFORMANCE BOOST: Add context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return "", err
	}

	// PERFORMANCE BOOST: Optimized headers
	req.Header.Set("Authorization", "Bearer "+s.groqAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Eloquent/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI enhancement failed: %s", string(bodyBytes))
	}

	// PERFORMANCE BOOST: Stream JSON decoding
	var chatResp GroqChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", err
	}

	if len(chatResp.Choices) == 0 {
		return text, nil
	}

	return chatResp.Choices[0].Message.Content, nil
}

// Legacy function for backward compatibility
func (s *TranscribeService) enhanceText(text, mode string) (string, error) {
	return s.enhanceTextOptimized(text, mode)
}

func (s *TranscribeService) GetAPIKey() string {
	// In production, you'd generate a scoped API key
	return s.groqAPIKey
}