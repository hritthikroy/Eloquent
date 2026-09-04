package backend

import (
	"encoding/json"
	"strings"
	"testing"
)

// ============================================================================
// Basic Processing Tests
// ============================================================================

func TestNewPromptProcessor(t *testing.T) {
	processor := NewPromptProcessor()
	if processor == nil {
		t.Fatal("NewPromptProcessor returned nil")
	}
	if processor.MaxTokens != 256 {
		t.Errorf("Expected MaxTokens = 256, got %d", processor.MaxTokens)
	}
	if processor.StrictMode != false {
		t.Error("Expected StrictMode = false")
	}
	if processor.AllowUnicode != true {
		t.Error("Expected AllowUnicode = true")
	}
}

func TestNewPromptProcessorWithConfig(t *testing.T) {
	processor := NewPromptProcessorWithConfig(128, true, false)
	if processor.MaxTokens != 128 {
		t.Errorf("Expected MaxTokens = 128, got %d", processor.MaxTokens)
	}
	if processor.StrictMode != true {
		t.Error("Expected StrictMode = true")
	}
	if processor.AllowUnicode != false {
		t.Error("Expected AllowUnicode = false")
	}
}

func TestProcessEmptyPrompt(t *testing.T) {
	processor := NewPromptProcessor()
	_, err := processor.Process("")
	if err == nil {
		t.Error("Expected error for empty prompt")
	}
	if !IsValidationError(err) {
		t.Error("Expected ValidationError")
	}
}

func TestProcessSimplePrompt(t *testing.T) {
	processor := NewPromptProcessor()
	result, err := processor.Process("Hello world")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result.Content != "Hello world" {
		t.Errorf("Expected content 'Hello world', got '%s'", result.Content)
	}
	if result.TokenCount == 0 {
		t.Error("Expected non-zero token count")
	}
	if !result.WithinLimit {
		t.Error("Expected prompt to be within limit")
	}
}

// ============================================================================
// Placeholder Extraction Tests
// ============================================================================

func TestExtractPlaceholdersNone(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := processor.extractPlaceholders("No placeholders here")
	if len(placeholders) != 0 {
		t.Errorf("Expected 0 placeholders, got %d", len(placeholders))
	}
}

func TestExtractPlaceholdersSingle(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := processor.extractPlaceholders("Hello {{name}}")
	if len(placeholders) != 1 {
		t.Fatalf("Expected 1 placeholder, got %d", len(placeholders))
	}
	if placeholders[0] != "name" {
		t.Errorf("Expected placeholder 'name', got '%s'", placeholders[0])
	}
}

func TestExtractPlaceholdersMultiple(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := processor.extractPlaceholders("{{greeting}} {{name}}, welcome to {{place}}")
	if len(placeholders) != 3 {
		t.Fatalf("Expected 3 placeholders, got %d", len(placeholders))
	}
	expected := []string{"greeting", "name", "place"}
	for i, exp := range expected {
		if placeholders[i] != exp {
			t.Errorf("Expected placeholder '%s', got '%s'", exp, placeholders[i])
		}
	}
}

func TestExtractPlaceholdersNested(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := processor.extractPlaceholders("{{user.name}} from {{user.city}}")
	if len(placeholders) != 2 {
		t.Fatalf("Expected 2 placeholders, got %d", len(placeholders))
	}
	if placeholders[0] != "user.name" {
		t.Errorf("Expected 'user.name', got '%s'", placeholders[0])
	}
	if placeholders[1] != "user.city" {
		t.Errorf("Expected 'user.city', got '%s'", placeholders[1])
	}
}

func TestExtractPlaceholdersDuplicates(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := processor.extractPlaceholders("{{x}} and {{x}} and {{x}}")
	if len(placeholders) != 1 {
		t.Errorf("Expected deduplicated to 1 placeholder, got %d", len(placeholders))
	}
}

// ============================================================================
// Placeholder Validation Tests
// ============================================================================

func TestVerifyPlaceholdersValid(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := []string{"name", "user.email", "item123"}
	err := processor.verifyPlaceholders(placeholders)
	if err != nil {
		t.Errorf("Unexpected error for valid placeholders: %v", err)
	}
}

func TestVerifyPlaceholdersInvalidCharacters(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := []string{"user-name"}
	err := processor.verifyPlaceholders(placeholders)
	if err == nil {
		t.Error("Expected error for invalid placeholder name")
	}
}

func TestVerifyPlaceholdersExcessiveNesting(t *testing.T) {
	processor := NewPromptProcessor()
	placeholders := []string{"a.b.c.d.e.f.g"} // 6 dots = too deep
	err := processor.verifyPlaceholders(placeholders)
	if err == nil {
		t.Error("Expected error for excessive nesting")
	}
}

// ============================================================================
// Sanitization Tests
// ============================================================================

func TestSanitizeNoChange(t *testing.T) {
	processor := NewPromptProcessor()
	sanitized, changed := processor.sanitize("Clean text")
	if changed {
		t.Error("Expected no changes for clean text")
	}
	if sanitized != "Clean text" {
		t.Errorf("Expected 'Clean text', got '%s'", sanitized)
	}
}

func TestSanitizeControlCharacters(t *testing.T) {
	processor := NewPromptProcessor()
	input := "Text\x00with\x01control\x1fchars"
	sanitized, changed := processor.sanitize(input)
	if !changed {
		t.Error("Expected changes for control characters")
	}
	if strings.Contains(sanitized, "\x00") {
		t.Error("Control character not removed")
	}
}

func TestSanitizeExcessiveWhitespace(t *testing.T) {
	processor := NewPromptProcessor()
	sanitized, changed := processor.sanitize("Too    many     spaces")
	if !changed {
		t.Error("Expected changes for excessive whitespace")
	}
	if sanitized != "Too many spaces" {
		t.Errorf("Expected 'Too many spaces', got '%s'", sanitized)
	}
}

func TestSanitizeUnicodeAllowed(t *testing.T) {
	processor := NewPromptProcessor()
	processor.AllowUnicode = true
	sanitized, _ := processor.sanitize("你好世界 🚀")
	if !strings.Contains(sanitized, "你好") {
		t.Error("Unicode should be preserved when allowed")
	}
}

func TestSanitizeUnicodeDisallowed(t *testing.T) {
	processor := NewPromptProcessor()
	processor.AllowUnicode = false
	sanitized, changed := processor.sanitize("你好世界")
	if !changed {
		t.Error("Expected changes when Unicode not allowed")
	}
	if strings.Contains(sanitized, "你") {
		t.Error("Unicode character not replaced")
	}
}

// ============================================================================
// Token Count Tests
// ============================================================================

func TestEstimateTokenCountEmpty(t *testing.T) {
	processor := NewPromptProcessor()
	count := processor.estimateTokenCount("")
	if count != 0 {
		t.Errorf("Expected 0 tokens for empty string, got %d", count)
	}
}

func TestEstimateTokenCountSimple(t *testing.T) {
	processor := NewPromptProcessor()
	count := processor.estimateTokenCount("Hello world")
	expected := 3 // 11 chars / 4 = 2.75 -> 3
	if count != expected {
		t.Errorf("Expected %d tokens, got %d", expected, count)
	}
}

func TestEstimateTokenCountUnicode(t *testing.T) {
	processor := NewPromptProcessor()
	count := processor.estimateTokenCount("你好世界") // 4 characters
	expected := 1 // 4 / 4 = 1
	if count != expected {
		t.Errorf("Expected %d tokens, got %d", expected, count)
	}
}

// ============================================================================
// Token Limit Enforcement Tests
// ============================================================================

func TestProcessWithinTokenLimit(t *testing.T) {
	processor := NewPromptProcessor()
	result, err := processor.Process("Short prompt")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !result.WithinLimit {
		t.Error("Expected prompt to be within limit")
	}
}

func TestProcessExceedsTokenLimitNonStrict(t *testing.T) {
	processor := NewPromptProcessor()
	processor.MaxTokens = 5
	longPrompt := strings.Repeat("a", 100)
	result, err := processor.Process(longPrompt)
	if err != nil {
		t.Fatalf("Unexpected error in non-strict mode: %v", err)
	}
	if result.WithinLimit {
		t.Error("Expected prompt to exceed limit")
	}
	if len(result.Warnings) == 0 {
		t.Error("Expected warnings for exceeding token limit")
	}
}

func TestProcessExceedsTokenLimitStrict(t *testing.T) {
	processor := NewPromptProcessor()
	processor.MaxTokens = 5
	processor.StrictMode = true
	longPrompt := strings.Repeat("a", 100)
	_, err := processor.Process(longPrompt)
	if err == nil {
		t.Error("Expected error in strict mode for exceeding token limit")
	}
	if !IsValidationError(err) {
		t.Error("Expected ValidationError")
	}
}

// ============================================================================
// Variable Substitution Tests
// ============================================================================

func TestSubstituteVariablesSimple(t *testing.T) {
	processor := NewPromptProcessor()
	variables := map[string]interface{}{
		"name": "World",
	}
	result, err := processor.substituteVariables("Hello {{name}}", variables)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result != "Hello World" {
		t.Errorf("Expected 'Hello World', got '%s'", result)
	}
}

func TestSubstituteVariablesNested(t *testing.T) {
	processor := NewPromptProcessor()
	variables := map[string]interface{}{
		"user": map[string]interface{}{
			"name": "Alice",
		},
	}
	result, err := processor.substituteVariables("Hello {{user.name}}", variables)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result != "Hello Alice" {
		t.Errorf("Expected 'Hello Alice', got '%s'", result)
	}
}

func TestSubstituteVariablesMissingNonStrict(t *testing.T) {
	processor := NewPromptProcessor()
	processor.StrictMode = false
	variables := map[string]interface{}{}
	result, err := processor.substituteVariables("Hello {{name}}", variables)
	if err != nil {
		t.Fatalf("Unexpected error in non-strict mode: %v", err)
	}
	if result != "Hello " {
		t.Errorf("Expected 'Hello ', got '%s'", result)
	}
}

func TestSubstituteVariablesMissingStrict(t *testing.T) {
	processor := NewPromptProcessor()
	processor.StrictMode = true
	variables := map[string]interface{}{}
	_, err := processor.substituteVariables("Hello {{name}}", variables)
	if err == nil {
		t.Error("Expected error in strict mode for missing variable")
	}
}

func TestSubstituteVariablesMultipleTypes(t *testing.T) {
	processor := NewPromptProcessor()
	variables := map[string]interface{}{
		"str":   "text",
		"int":   42,
		"float": 3.14,
		"bool":  true,
	}
	template := "{{str}} {{int}} {{float}} {{bool}}"
	result, err := processor.substituteVariables(template, variables)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !strings.Contains(result, "text") {
		t.Error("String not substituted")
	}
	if !strings.Contains(result, "42") {
		t.Error("Integer not substituted")
	}
	if !strings.Contains(result, "3.14") {
		t.Error("Float not substituted")
	}
	if !strings.Contains(result, "true") {
		t.Error("Boolean not substituted")
	}
}

// ============================================================================
// JSON Processing Tests
// ============================================================================

func TestProcessJSONValid(t *testing.T) {
	processor := NewPromptProcessor()
	jsonData := []byte(`{
		"template": "Hello {{name}}",
		"variables": {"name": "World"}
	}`)
	result, err := processor.ProcessJSON(jsonData)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result.Content != "Hello World" {
		t.Errorf("Expected 'Hello World', got '%s'", result.Content)
	}
}

func TestProcessJSONInvalid(t *testing.T) {
	processor := NewPromptProcessor()
	jsonData := []byte(`{invalid json}`)
	_, err := processor.ProcessJSON(jsonData)
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestProcessJSONMissingTemplate(t *testing.T) {
	processor := NewPromptProcessor()
	jsonData := []byte(`{"variables": {"name": "World"}}`)
	_, err := processor.ProcessJSON(jsonData)
	if err == nil {
		t.Error("Expected error for missing template")
	}
}

// ============================================================================
// Batch Processing Tests
// ============================================================================

func TestBatchProcess(t *testing.T) {
	processor := NewPromptProcessor()
	prompts := []string{"First", "Second", "Third"}
	results, errs := processor.BatchProcess(prompts)
	if len(results) != 3 {
		t.Errorf("Expected 3 results, got %d", len(results))
	}
	if len(errs) != 3 {
		t.Errorf("Expected 3 error slots, got %d", len(errs))
	}
	for i, result := range results {
		if result == nil {
			t.Errorf("Result %d is nil", i)
		}
	}
}

func TestBatchProcessWithErrors(t *testing.T) {
	processor := NewPromptProcessor()
	prompts := []string{"Valid", "", "Also valid"}
	results, errs := processor.BatchProcess(prompts)
	if len(results) != 3 {
		t.Errorf("Expected 3 results, got %d", len(results))
	}
	if errs[0] != nil {
		t.Error("Expected no error for first prompt")
	}
	if errs[1] == nil {
		t.Error("Expected error for empty prompt")
	}
	if errs[2] != nil {
		t.Error("Expected no error for third prompt")
	}
}

// ============================================================================
// Serialization Tests
// ============================================================================

func TestProcessedPromptToJSON(t *testing.T) {
	result := &ProcessedPrompt{
		Content:      "Test content",
		TokenCount:   10,
		Placeholders: []string{"var1", "var2"},
		Warnings:     []string{},
		Sanitized:    false,
		WithinLimit:  true,
	}
	jsonData, err := result.ToJSON()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(jsonData) == 0 {
		t.Error("Expected non-empty JSON")
	}
}

func TestProcessedPromptFromJSON(t *testing.T) {
	jsonData := []byte(`{
		"content": "Test",
		"tokenCount": 5,
		"placeholders": ["var"],
		"warnings": [],
		"sanitized": false,
		"withinLimit": true
	}`)
	result, err := FromJSON(jsonData)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result.Content != "Test" {
		t.Errorf("Expected 'Test', got '%s'", result.Content)
	}
	if result.TokenCount != 5 {
		t.Errorf("Expected TokenCount 5, got %d", result.TokenCount)
	}
}

// ============================================================================
// Utility Tests
// ============================================================================

func TestValidateAndSanitize(t *testing.T) {
	prompt, err := ValidateAndSanitize("Test prompt", 256)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if prompt == "" {
		t.Error("Expected non-empty prompt")
	}
}

func TestValidateAndSanitizeExceedsLimit(t *testing.T) {
	longPrompt := strings.Repeat("a", 1000)
	_, err := ValidateAndSanitize(longPrompt, 10)
	if err == nil {
		t.Error("Expected error for exceeding limit in strict mode")
	}
}

func TestGetSafePrompt(t *testing.T) {
	result := &ProcessedPrompt{
		Content:     "Test content",
		TokenCount:  5,
		WithinLimit: true,
	}
	safe := result.GetSafePrompt()
	if safe != "Test content" {
		t.Errorf("Expected 'Test content', got '%s'", safe)
	}
}

func TestHasErrors(t *testing.T) {
	result := &ProcessedPrompt{
		WithinLimit: false,
		Warnings:    []string{"warning"},
	}
	if !result.HasErrors() {
		t.Error("Expected HasErrors to return true")
	}
}

func TestIsValidationError(t *testing.T) {
	err := &ValidationError{Field: "test", Message: "error"}
	if !IsValidationError(err) {
		t.Error("Expected IsValidationError to return true")
	}
	
	regularErr := json.SyntaxError{}
	if IsValidationError(&regularErr) {
		t.Error("Expected IsValidationError to return false for non-ValidationError")
	}
}

// ============================================================================
// Edge Cases
// ============================================================================

func TestEdgeCaseVeryLongPlaceholder(t *testing.T) {
	processor := NewPromptProcessor()
	longName := strings.Repeat("a", 200)
	template := "{{" + longName + "}}"
	placeholders := processor.extractPlaceholders(template)
	if len(placeholders) != 1 || placeholders[0] != longName {
		t.Error("Failed to extract very long placeholder")
	}
}

func TestEdgeCaseMultipleSamePlaceholder(t *testing.T) {
	processor := NewPromptProcessor()
	variables := map[string]interface{}{"x": "value"}
	result, err := processor.substituteVariables("{{x}} {{x}} {{x}}", variables)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result != "value value value" {
		t.Errorf("Expected 'value value value', got '%s'", result)
	}
}

func TestEdgeCaseEmptyVariableValue(t *testing.T) {
	processor := NewPromptProcessor()
	variables := map[string]interface{}{"empty": ""}
	result, err := processor.substituteVariables("Test {{empty}} end", variables)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result != "Test  end" {
		t.Errorf("Expected 'Test  end', got '%s'", result)
	}
}

// ============================================================================
// Empty, Whitespace, Length, and Unicode Edge Case Tests
// ============================================================================

func TestProcessWhitespaceOnlyPrompt(t *testing.T) {
	processor := NewPromptProcessor()
	_, err := processor.Process("   \t\r\n   ")
	if err == nil {
		t.Error("Expected error for whitespace-only prompt")
	}
	if !IsValidationError(err) {
		t.Error("Expected ValidationError for whitespace-only prompt")
	}
}

func TestProcessOver4096CharsStrictMode(t *testing.T) {
	processor := NewPromptProcessorWithConfig(256, true, true)
	processor.MaxChars = 4096
	longPrompt := strings.Repeat("A", 5000)
	_, err := processor.Process(longPrompt)
	if err == nil {
		t.Fatal("Expected error for >4096 chars prompt in strict mode")
	}
	if !IsValidationError(err) {
		t.Error("Expected ValidationError for length limit")
	}
}

func TestProcessOver4096CharsTruncated(t *testing.T) {
	processor := NewPromptProcessorWithConfig(256, false, true)
	processor.MaxChars = 4096
	longPrompt := strings.Repeat("X", 5000)
	result, err := processor.Process(longPrompt)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(result.Content) != 4096 {
		t.Errorf("Expected content to be truncated to 4096, got %d", len(result.Content))
	}
	hasWarning := false
	for _, w := range result.Warnings {
		if strings.Contains(w, "truncated") {
			hasWarning = true
			break
		}
	}
	if !hasWarning {
		t.Error("Expected warning about truncation")
	}
}

func TestProcessUnicodePreservation(t *testing.T) {
	processor := NewPromptProcessor()
	unicodePrompt := "বাংলা ও হিন্দি এআই প্রম্পট 🚀 नमस्ते दुनिया"
	result, err := processor.Process(unicodePrompt)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result.Content != unicodePrompt {
		t.Errorf("Expected Unicode content to be preserved, got '%s'", result.Content)
	}
}
