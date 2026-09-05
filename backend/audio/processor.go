// Package state provides core Go audio processing engine, stream management,
// buffer allocation, and linguistic text normalization routines.
package state

import (
	"regexp"
	"strings"

	"golang.org/x/text/unicode/norm"
)

var (
	// Split matras and composite vowel combinations
	reSplitOkar1  = regexp.MustCompile(`\x{09C7}\x{09BE}`) // e-kar + aa-kar -> o-kar (ো)
	reSplitOkar2  = regexp.MustCompile(`\x{09BE}\x{09C7}`) // aa-kar + e-kar -> o-kar (ো)
	reSplitOukar1 = regexp.MustCompile(`\x{09C7}\x{09D7}`) // e-kar + ou-length-mark -> ou-kar (ৌ)
	reSplitOukar2 = regexp.MustCompile(`\x{09C7}\x{09CC}`) // e-kar + ou-kar -> ou-kar (ৌ)
	reSplitOukar3 = regexp.MustCompile(`\x{09CC}\x{09C7}`) // ou-kar + e-kar -> ou-kar (ৌ)
	reSplitAikar1 = regexp.MustCompile(`\x{09C7}\x{09C8}`) // e-kar + ai-kar -> ai-kar (ৈ)
	reSplitAikar2 = regexp.MustCompile(`\x{09C8}\x{09C7}`) // ai-kar + e-kar -> ai-kar (ৈ)

	// Nukta combinations (consonant + nukta -> precomposed letter)
	reNuktaRra = regexp.MustCompile(`\x{09A1}\x{09BC}`) // Dda + Nukta -> Rra (ড়)
	reNuktaRha = regexp.MustCompile(`\x{09A2}\x{09BC}`) // Ddha + Nukta -> Rrha (ঢ়)
	reNuktaYya = regexp.MustCompile(`\x{09AF}\x{09BC}`) // Ya + Nukta -> Yya (য়)

	// Khanda-Ta legacy encodings
	reKhandaTaZwj   = regexp.MustCompile(`\x{09A4}\x{09CD}\x{200D}`) // Ta + Hasant + ZWJ -> ৎ
	reKhandaTaZwnj  = regexp.MustCompile(`\x{09A4}\x{09CD}\x{200C}`) // Ta + Hasant + ZWNJ -> ৎ
	reKhandaTaFinal = regexp.MustCompile(`\x{09A4}\x{09CD}(?:[\s।\.,!?;:]|$)`) // Word-final Ta + Hasant -> ৎ

	// Duplicate matras and diacritics
	reDupAakar    = regexp.MustCompile(`\x{09BE}{2,}`)
	reDupIkar     = regexp.MustCompile(`\x{09BF}{2,}`)
	reDupEekar    = regexp.MustCompile(`\x{09C0}{2,}`)
	reDupUkar     = regexp.MustCompile(`\x{09C1}{2,}`)
	reDupOokar    = regexp.MustCompile(`\x{09C2}{2,}`)
	reDupRrikar   = regexp.MustCompile(`\x{09C3}{2,}`)
	reDupEkar     = regexp.MustCompile(`\x{09C7}{2,}`)
	reDupAikar    = regexp.MustCompile(`\x{09C8}{2,}`)
	reDupOkar     = regexp.MustCompile(`\x{09CB}{2,}`)
	reDupOukar    = regexp.MustCompile(`\x{09CC}{2,}`)
	reDupHasant   = regexp.MustCompile(`\x{09CD}{2,}`)
	reDupChandra  = regexp.MustCompile(`\x{0981}{2,}`)
	reDupAnusvara = regexp.MustCompile(`\x{0982}{2,}`)
	reDupVisarga  = regexp.MustCompile(`\x{0983}{2,}`)

	// Invisible and zero-width characters
	reZeroWidth = regexp.MustCompile(`[\x{200B}\x{200C}\x{200D}\x{FEFF}]`)

	// Dari spacing
	reDariPreSpace  = regexp.MustCompile(`[ \t]+\x{0964}`)
	reDariPostSpace = regexp.MustCompile(`\x{0964}([^\s\x{0964}\.,!?;:\)\]\}])`)

	// Excess horizontal whitespace
	reSpaces = regexp.MustCompile(`[ \t]{2,}`)
)

// NormalizeBanglaText performs deterministic, linguistic Unicode normalization,
// zero-width artifact removal, and typographical correction for Bengali (Bangla) text.
// It preserves mixed ASCII English words, code identifiers, numbers, and layout.
func NormalizeBanglaText(input string) string {
	if input == "" {
		return ""
	}

	// 1. Initial Unicode NFC canonical decomposition & precomposition for general Unicode.
	text := norm.NFC.String(input)

	// 2. Normalize Khanda-Ta combinations before zero-width characters are stripped
	text = reKhandaTaZwj.ReplaceAllString(text, "\u09CE")
	text = reKhandaTaZwnj.ReplaceAllString(text, "\u09CE")

	// Convert word-boundary / final Ta + Hasant to Khanda-Ta (e.g., হঠাত্ -> হঠাৎ)
	text = reKhandaTaFinal.ReplaceAllStringFunc(text, func(m string) string {
		trailing := m[len("\u09A4\u09CD"):]
		return "\u09CE" + trailing
	})

	// 3. Remove zero-width formatting characters (ZWSP, ZWNJ, ZWJ, BOM)
	text = reZeroWidth.ReplaceAllString(text, "")

	// 4. Normalize Nukta combinations into canonical precomposed consonants.
	// (Note: Unicode NFC excludes these in CompositionExclusions.txt, so we enforce
	// canonical precomposed Bangla orthography after NFC).
	text = reNuktaRra.ReplaceAllString(text, "\u09DC") // ড়
	text = reNuktaRha.ReplaceAllString(text, "\u09DD") // ঢ়
	text = reNuktaYya.ReplaceAllString(text, "\u09DF") // য়

	// 5. Correct split matras (O-kar, Ou-kar, Ai-kar)
	text = reSplitOkar1.ReplaceAllString(text, "\u09CB") // ো
	text = reSplitOkar2.ReplaceAllString(text, "\u09CB") // ো
	text = reSplitOukar1.ReplaceAllString(text, "\u09CC") // ৌ
	text = reSplitOukar2.ReplaceAllString(text, "\u09CC") // ৌ
	text = reSplitOukar3.ReplaceAllString(text, "\u09CC") // ৌ
	text = reSplitAikar1.ReplaceAllString(text, "\u09C8") // ৈ
	text = reSplitAikar2.ReplaceAllString(text, "\u09C8") // ৈ

	// 6. Deduplicate repeated vowel signs (matras), hasants, and modifiers
	text = reDupAakar.ReplaceAllString(text, "\u09BE")
	text = reDupIkar.ReplaceAllString(text, "\u09BF")
	text = reDupEekar.ReplaceAllString(text, "\u09C0")
	text = reDupUkar.ReplaceAllString(text, "\u09C1")
	text = reDupOokar.ReplaceAllString(text, "\u09C2")
	text = reDupRrikar.ReplaceAllString(text, "\u09C3")
	text = reDupEkar.ReplaceAllString(text, "\u09C7")
	text = reDupAikar.ReplaceAllString(text, "\u09C8")
	text = reDupOkar.ReplaceAllString(text, "\u09CB")
	text = reDupOukar.ReplaceAllString(text, "\u09CC")
	text = reDupHasant.ReplaceAllString(text, "\u09CD")
	text = reDupChandra.ReplaceAllString(text, "\u0981")
	text = reDupAnusvara.ReplaceAllString(text, "\u0982")
	text = reDupVisarga.ReplaceAllString(text, "\u0983")

	// 7. Normalize Dari (।) spacing without altering sentence flow
	text = reDariPreSpace.ReplaceAllString(text, "\u0964")
	text = reDariPostSpace.ReplaceAllString(text, "\u0964 $1")

	// 8. Collapse duplicate horizontal spaces
	text = reSpaces.ReplaceAllString(text, " ")

	return strings.TrimSpace(text)
}
