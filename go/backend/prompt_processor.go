package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

// PromptProcessor handles prompt parsing, validation, and sanitization
// for the audio backend, ensuring prompt integrity and token limits.
type PromptProcessor struct {
	MaxTokens      int
	MaxChars       int
	StrictMode     bool
	AllowUnicode   bool
	placeholderRgx *regexp.Regexp
}

// ProcessedPrompt represents a validated and sanitized prompt ready for audio engine
type ProcessedPrompt struct {
	Content       string   `json:"content"`
	TokenCount    int      `json:"tokenCount"`
	Placeholders  []string `json:"placeholders"`
	Warnings      []string `json:"warnings"`
	Sanitized     bool     `json:"sanitized"`
	WithinLimit   bool     `json:"withinLimit"`
}

// ValidationError represents a prompt validation failure
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation error [%s]: %s", e.Field, e.Message)
}

// NewPromptProcessor creates a new processor with default settings
func NewPromptProcessor() *PromptProcessor {
	return &PromptProcessor{
		MaxTokens:      256,
		MaxChars:       4096,
		StrictMode:     false,
		AllowUnicode:   true,
		placeholderRgx: regexp.MustCompile(`\{\{([a-zA-Z0-9_.]+)\}\}`),
	}
}

// NewPromptProcessorWithConfig creates a processor with custom configuration
func NewPromptProcessorWithConfig(maxTokens int, strictMode bool, allowUnicode bool) *PromptProcessor {
	return &PromptProcessor{
		MaxTokens:      maxTokens,
		MaxChars:       4096,
		StrictMode:     strictMode,
		AllowUnicode:   allowUnicode,
		placeholderRgx: regexp.MustCompile(`\{\{([a-zA-Z0-9_.]+)\}\}`),
	}
}

// Process validates and sanitizes an incoming prompt string
func (p *PromptProcessor) Process(prompt string) (*ProcessedPrompt, error) {
	if strings.TrimSpace(prompt) == "" {
		return nil, &ValidationError{Field: "prompt", Message: "prompt cannot be empty or whitespace-only"}
	}

	warnings := []string{}

	// Enforce maximum character limit (> 4096 chars)
	maxChars := p.MaxChars
	if maxChars <= 0 {
		maxChars = 4096
	}
	runeCount := utf8.RuneCountInString(prompt)
	if runeCount > maxChars {
		if p.StrictMode {
			return nil, &ValidationError{
				Field:   "prompt",
				Message: fmt.Sprintf("prompt exceeds maximum length: %d > %d characters", runeCount, maxChars),
			}
		}
		runes := []rune(prompt)
		prompt = string(runes[:maxChars])
		warnings = append(warnings, fmt.Sprintf("prompt exceeds maximum character limit (%d) and was truncated", maxChars))
	}

	result := &ProcessedPrompt{
		Content:      prompt,
		Placeholders: []string{},
		Warnings:     warnings,
		Sanitized:    false,
	}

	// Extract placeholders
	placeholders := p.extractPlaceholders(prompt)
	result.Placeholders = placeholders

	// Verify placeholder integrity
	if err := p.verifyPlaceholders(placeholders); err != nil {
		if p.StrictMode {
			return nil, err
		}
		result.Warnings = append(result.Warnings, err.Error())
	}

	// Sanitize content
	sanitized, didSanitize := p.sanitize(prompt)
	result.Content = sanitized
	result.Sanitized = didSanitize

	if didSanitize {
		result.Warnings = append(result.Warnings, "prompt was sanitized to remove unsafe characters")
	}

	// Estimate token count
	tokenCount := p.estimateTokenCount(result.Content)
	result.TokenCount = tokenCount
	result.WithinLimit = tokenCount <= p.MaxTokens

	// Enforce token limit
	if !result.WithinLimit {
		if p.StrictMode {
			return nil, &ValidationError{
				Field: "tokenCount",
				Message: fmt.Sprintf(
					"prompt exceeds token limit: %d > %d",
					tokenCount,
					p.MaxTokens,
				),
			}
		}
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("prompt exceeds token limit: %d > %d", tokenCount, p.MaxTokens))
	}

	return result, nil
}

// ProcessJSON processes a JSON-encoded prompt payload
func (p *PromptProcessor) ProcessJSON(jsonData []byte) (*ProcessedPrompt, error) {
	var payload struct {
		Template  string                 `json:"template"`
		Variables map[string]interface{} `json:"variables"`
		Options   map[string]interface{} `json:"options"`
	}

	if err := json.Unmarshal(jsonData, &payload); err != nil {
		return nil, fmt.Errorf("invalid JSON payload: %w", err)
	}

	if payload.Template == "" {
		return nil, &ValidationError{Field: "template", Message: "template field is required"}
	}

	// If variables provided, substitute them
	prompt := payload.Template
	if len(payload.Variables) > 0 {
		var err error
		prompt, err = p.substituteVariables(prompt, payload.Variables)
		if err != nil {
			return nil, err
		}
	}

	return p.Process(prompt)
}

// extractPlaceholders finds all {{variable}} placeholders in the prompt
func (p *PromptProcessor) extractPlaceholders(prompt string) []string {
	matches := p.placeholderRgx.FindAllStringSubmatch(prompt, -1)
	placeholders := make([]string, 0, len(matches))
	seen := make(map[string]bool)

	for _, match := range matches {
		if len(match) > 1 {
			placeholder := match[1]
			if !seen[placeholder] {
				placeholders = append(placeholders, placeholder)
				seen[placeholder] = true
			}
		}
	}

	return placeholders
}

// verifyPlaceholders validates placeholder integrity and naming
func (p *PromptProcessor) verifyPlaceholders(placeholders []string) error {
	placeholderNameRgx := regexp.MustCompile(`^[a-zA-Z0-9_.]+$`)

	for _, placeholder := range placeholders {
		if !placeholderNameRgx.MatchString(placeholder) {
			return &ValidationError{
				Field:   "placeholder",
				Message: fmt.Sprintf("invalid placeholder name: %s", placeholder),
			}
		}

		// Check for excessive nesting (security measure)
		if strings.Count(placeholder, ".") > 5 {
			return &ValidationError{
				Field:   "placeholder",
				Message: fmt.Sprintf("placeholder nesting too deep: %s", placeholder),
			}
		}
	}

	return nil
}

// sanitize removes or escapes unsafe characters from prompt
func (p *PromptProcessor) sanitize(prompt string) (string, bool) {
	original := prompt
	sanitized := prompt

	// Remove control characters except newline, tab, and carriage return
	sanitized = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == '\t' {
			return r
		}
		if r < 32 || r == 127 {
			return -1 // Remove character
		}
		return r
	}, sanitized)

	// Handle Unicode if not allowed
	if !p.AllowUnicode {
		sanitized = strings.Map(func(r rune) rune {
			if r > 127 {
				return '?'
			}
			return r
		}, sanitized)
	}

	// Remove excessive whitespace
	sanitized = regexp.MustCompile(`\s+`).ReplaceAllString(sanitized, " ")
	sanitized = strings.TrimSpace(sanitized)

	return sanitized, sanitized != original
}

// estimateTokenCount provides rough token count estimation
// Uses ~4 characters per token heuristic (GPT-style)
func (p *PromptProcessor) estimateTokenCount(text string) int {
	if text == "" {
		return 0
	}
	charCount := utf8.RuneCountInString(text)
	return (charCount + 3) / 4 // Ceiling division
}

// substituteVariables replaces placeholders with provided variable values
func (p *PromptProcessor) substituteVariables(template string, variables map[string]interface{}) (string, error) {
	result := template
	placeholders := p.extractPlaceholders(template)

	for _, placeholder := range placeholders {
		value, ok := p.resolveNestedVariable(variables, placeholder)
		if !ok {
			if p.StrictMode {
				return "", &ValidationError{
					Field:   "variables",
					Message: fmt.Sprintf("missing required variable: %s", placeholder),
				}
			}
			// Replace with empty string in non-strict mode
			value = ""
		}

		// Convert value to string safely
		strValue := p.valueToString(value)

		// Escape the placeholder for regex replacement
		escapedPlaceholder := regexp.QuoteMeta(fmt.Sprintf("{{%s}}", placeholder))
		rgx := regexp.MustCompile(escapedPlaceholder)
		result = rgx.ReplaceAllString(result, strValue)
	}

	return result, nil
}

// resolveNestedVariable resolves nested variable access (e.g., "user.name")
func (p *PromptProcessor) resolveNestedVariable(variables map[string]interface{}, path string) (interface{}, bool) {
	parts := strings.Split(path, ".")
	var current interface{} = variables

	for _, part := range parts {
		switch v := current.(type) {
		case map[string]interface{}:
			val, ok := v[part]
			if !ok {
				return nil, false
			}
			current = val
		default:
			return nil, false
		}
	}

	return current, true
}

// valueToString converts interface{} to string safely
func (p *PromptProcessor) valueToString(value interface{}) string {
	if value == nil {
		return ""
	}

	switch v := value.(type) {
	case string:
		return v
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", v)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", v)
	case float32, float64:
		return fmt.Sprintf("%f", v)
	case bool:
		return fmt.Sprintf("%t", v)
	default:
		// Attempt JSON encoding for complex types
		if bytes, err := json.Marshal(v); err == nil {
			return string(bytes)
		}
		return fmt.Sprintf("%v", v)
	}
}

// ToJSON serializes processed prompt to JSON
func (pr *ProcessedPrompt) ToJSON() ([]byte, error) {
	return json.Marshal(pr)
}

// FromJSON deserializes processed prompt from JSON
func FromJSON(jsonData []byte) (*ProcessedPrompt, error) {
	var result ProcessedPrompt
	if err := json.Unmarshal(jsonData, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ValidateAndSanitize is a convenience method for one-step processing
func ValidateAndSanitize(prompt string, maxTokens int) (string, error) {
	processor := NewPromptProcessorWithConfig(maxTokens, true, true)
	result, err := processor.Process(prompt)
	if err != nil {
		return "", err
	}
	return result.Content, nil
}

// BatchProcess processes multiple prompts efficiently
func (p *PromptProcessor) BatchProcess(prompts []string) ([]*ProcessedPrompt, []error) {
	results := make([]*ProcessedPrompt, len(prompts))
	errs := make([]error, len(prompts))

	for i, prompt := range prompts {
		result, err := p.Process(prompt)
		results[i] = result
		errs[i] = err
	}

	return results, errs
}

// GetSafePrompt returns sanitized prompt content or error message
func (pr *ProcessedPrompt) GetSafePrompt() string {
	if !pr.WithinLimit {
		// Truncate to approximate token limit
		maxChars := pr.TokenCount * 4
		if len(pr.Content) > maxChars {
			return pr.Content[:maxChars] + "..."
		}
	}
	return pr.Content
}

// HasErrors checks if processing resulted in critical issues
func (pr *ProcessedPrompt) HasErrors() bool {
	return !pr.WithinLimit && len(pr.Warnings) > 0
}

// NewValidationError creates a new validation error
func NewValidationError(field, message string) error {
	return &ValidationError{Field: field, Message: message}
}

// IsValidationError checks if error is a ValidationError
func IsValidationError(err error) bool {
	var validationErr *ValidationError
	return errors.As(err, &validationErr)
}
