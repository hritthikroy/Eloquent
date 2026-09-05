package state

import (
	"testing"
)

func TestNormalizeBanglaText(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Empty input",
			input:    "",
			expected: "",
		},
		{
			name:     "Pure English text preserved",
			input:    "Hello world, testing 123!",
			expected: "Hello world, testing 123!",
		},
		{
			name:     "Mixed ASCII and Bangla characters",
			input:    "Eloquent audio engine সংস্করণ 2.1 rock solid",
			expected: "Eloquent audio engine সংস্করণ 2.1 rock solid",
		},
		{
			name:     "Split O-kar correction (e-kar + aa-kar -> o-kar)",
			input:    "ক\u09C7\u09BEদ", // ক + ে + া + দ -> কোদ
			expected: "কোদ",
		},
		{
			name:     "Split O-kar inverted (aa-kar + e-kar -> o-kar)",
			input:    "ক\u09BE\u09C7দ", // ক + া + ে + দ -> কোদ
			expected: "কোদ",
		},
		{
			name:     "Split Ou-kar correction (e-kar + ou-length-mark -> ou-kar)",
			input:    "ক\u09C7\u09D7তুক", // ক + ে + ৗ + তুক -> কৌতুক
			expected: "কৌতুক",
		},
		{
			name:     "Split Ou-kar correction (e-kar + ou-kar -> ou-kar)",
			input:    "ক\u09C7\u09CCতুক",
			expected: "কৌতুক",
		},
		{
			name:     "Split Ai-kar correction (e-kar + ai-kar -> ai-kar)",
			input:    "ত\u09C7\u09C8রি", // ত + ে + ৈ + রি -> তৈরি
			expected: "তৈরি",
		},
		{
			name:     "Removal of zero-width spaces and formatting (ZWSP, ZWNJ, BOM)",
			input:    "বাংলা\u200Bটেক্সট\uFEFFনর্মালাইজেশন",
			expected: "বাংলাটেক্সটনর্মালাইজেশন",
		},
		{
			name:     "Legacy Khanda-Ta with ZWJ (Ta + Hasant + ZWJ -> Khanda-Ta)",
			input:    "উৎসব \u09A4\u09CD\u200Dসব", // উৎসব ৎসব
			expected: "উৎসব ৎসব",
		},
		{
			name:     "Word-final Ta + Hasant -> Khanda-Ta",
			input:    "হঠাত্ ঘটনা",
			expected: "হঠাৎ ঘটনা",
		},
		{
			name:     "Nukta normalization for Dda (ড + nukta -> ড়)",
			input:    "বা\u09A1\u09BCি", // বা + ড + ় + ি -> বাড়ি
			expected: "বাড়ি",
		},
		{
			name:     "Nukta normalization for Ddha (ঢ + nukta -> ঢ়)",
			input:    "আষা\u09A2\u09BC", // আষা + ঢ + ় -> আষাঢ়
			expected: "আষাঢ়",
		},
		{
			name:     "Nukta normalization for Ya (য + nukta -> য়)",
			input:    "সম\u09AF\u09BC", // সম + য + ় -> সময়
			expected: "সময়",
		},
		{
			name:     "Duplicate matra deduplication",
			input:    "বববববাাংলাা", // বাাংলাা -> বাংলা
			expected: "বববববাংলা",
		},
		{
			name:     "Duplicate hasants collapsed",
			input:    "ক\u09CD\u09CDলান্ত", // ক + ্ + ্ + লান্ত -> ক্লান্ত
			expected: "ক্লান্ত",
		},
		{
			name:     "Dari spacing normalization",
			input:    "আমি ভালো আছি  ।আপনি কেমন আছেন?",
			expected: "আমি ভালো আছি। আপনি কেমন আছেন?",
		},
		{
			name:     "Tuk Tuk persona standard orthography",
			input:    "Hey babe! \u09B6\u09CB\u09A8\u09CB \u09A8\u09BE\u200B, কো\u09C7\u09BEনো প্যারা নাই।",
			expected: "Hey babe! শোনো না, কোনো প্যারা নাই।",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeBanglaText(tt.input)
			if got != tt.expected {
				t.Errorf("NormalizeBanglaText(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestAudioTextService(t *testing.T) {
	service := GetAudioTextService()

	rawTranscript := "হঠাত্  দ\u09C7\u09BEখা হলো \u200B।"
	normalized := service.ProcessTranscription(rawTranscript)
	expected := "হঠাৎ দোখা হলো।"

	if normalized != expected {
		t.Errorf("ProcessTranscription(%q) = %q, want %q", rawTranscript, normalized, expected)
	}

	ttsInput := "ক\u09C7\u09BEডিং চলছে"
	normalizedTTS := service.ProcessTTSInput(ttsInput)
	expectedTTS := "কোডিং চলছে"

	if normalizedTTS != expectedTTS {
		t.Errorf("ProcessTTSInput(%q) = %q, want %q", ttsInput, normalizedTTS, expectedTTS)
	}

	normCount, transCount, ttsCount := service.Stats()
	if transCount < 1 || ttsCount < 1 || normCount < 2 {
		t.Errorf("Unexpected stats: norm=%d, trans=%d, tts=%d", normCount, transCount, ttsCount)
	}
}
