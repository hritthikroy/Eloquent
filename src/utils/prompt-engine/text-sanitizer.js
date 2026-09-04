/**
 * TextSanitizer
 * Cleans speech-to-text artifacts, phonetic mishearings, and normalizes developer terms
 */

class TextSanitizer {
  static sanitize(rawText) {
    if (!rawText || typeof rawText !== "string") return "";

    let text = rawText.trim();

    // 1. Phonetic speech-to-text corrections
    text = text
      .replace(/\band you\b(?=\s+(?:check|modify|write|tell|see|look|help|code|build|refactor|take|run|fix|draft|craft|inspect|smooth))/gi, "Vision")
      .replace(/\b(?:and\s*rew|an\s*drew|andrew)\b/gi, "Vision")
      .replace(/\b(?:vi\s*sion|vishon)\b/gi, "Vision")
      .replace(/\b(?:entry|enter|anti)\s*gravity\b/gi, "Antigravity")
      .replace(/\b(?:took\s*took|tok\s*tok|tuck\s*tuck)\b/gi, "Tuk Tuk")
      .replace(/\b(?:on this course)\b/gi, "on this code")
      .replace(/\b(?:ast\s*tree)\b/gi, "AST")
      .replace(/\b(?:j\s*s)\b/gi, "JavaScript")
      .replace(/\b(?:t\s*s)\b/gi, "TypeScript");

    // 2. Remove speech disfluency and stutters
    text = text
      .replace(/\b(?:um|uh|er|ah)\b/gi, "")
      .replace(/\b(\w+)\s+\1\b/gi, "$1") // De-duplicate repeated words: "I I" -> "I"
      .replace(/\s+/g, " ")
      .trim();

    // 3. Normalize punctuation and casing
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    return text;
  }
}

module.exports = TextSanitizer;
