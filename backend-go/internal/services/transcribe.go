package services

import (
	"bytes"
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

func (s *TranscribeService) TranscribeAudio(audioData []byte, filename, language, mode string) (*TranscriptionResult, error) {
	startTime := time.Now()

	// Create multipart form for Groq API
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// Add file
	fileWriter, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := fileWriter.Write(audioData); err != nil {
		return nil, err
	}

	// Add other fields
	writer.WriteField("model", "whisper-large-v3-turbo")
	writer.WriteField("language", language)
	writer.WriteField("response_format", "text")
	writer.WriteField("temperature", "0")

	writer.Close()

	// Make transcription request
	req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/audio/transcriptions", &body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.groqAPIKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("transcription failed: %s", string(bodyBytes))
	}

	textBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	originalText := string(textBytes)
	if originalText == "" {
		return nil, fmt.Errorf("no speech detected")
	}

	result := &TranscriptionResult{
		Text:           originalText,
		OriginalText:   originalText,
		AIProcessed:    false,
		Mode:           mode,
		ProcessingTime: time.Since(startTime).Milliseconds(),
	}

	// Apply AI processing if requested
	if mode == "rewrite" {
		enhancedText, err := s.enhanceText(originalText, "rewrite")
		if err != nil {
			return nil, err
		}
		result.Text = enhancedText
		result.AIProcessed = true
	} else if mode == "grammar" {
		enhancedText, err := s.enhanceText(originalText, "grammar")
		if err != nil {
			return nil, err
		}
		result.Text = enhancedText
		result.AIProcessed = true
	}

	result.ProcessingTime = time.Since(startTime).Milliseconds()
	return result, nil
}

func (s *TranscribeService) enhanceText(text, mode string) (string, error) {
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

	reqBody, err := json.Marshal(chatReq)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+s.groqAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI enhancement failed: %s", string(bodyBytes))
	}

	var chatResp GroqChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", err
	}

	if len(chatResp.Choices) == 0 {
		return text, nil
	}

	return chatResp.Choices[0].Message.Content, nil
}

func (s *TranscribeService) GetAPIKey() string {
	// In production, you'd generate a scoped API key
	return s.groqAPIKey
}