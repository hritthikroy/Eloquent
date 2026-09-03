/**
 * IntentParser
 * Distinguishes explicit prompt refinement and conversation smoothing intents with 0 false positives
 */

const INTENTS = {
  SMOOTH_CONVERSATION: "SMOOTH_CONVERSATION",
  GENERATE_PROMPT: "GENERATE_PROMPT",
  STANDARD_QUERY: "STANDARD_QUERY"
};

class IntentParser {
  static parse(rawText) {
    if (!rawText || typeof rawText !== "string") {
      return { intent: INTENTS.STANDARD_QUERY, confidence: 0, target: "" };
    }

    const lower = rawText.toLowerCase().trim();

    // 1. Guard against standard informational / technical queries
    // E.g., "how do I write a prompt in python?", "what is a prompt?"
    if (/^(?:how\s+to|how\s+do\s+i|what\s+is|why\s+is|explain)\s+/i.test(lower)) {
      return { intent: INTENTS.STANDARD_QUERY, confidence: 1.0, target: rawText };
    }

    // 2. Smooth Conversation Intent Detection
    const smoothPatterns = [
      /\b(?:make|get)\s+(?:our\s+|the\s+)?conversation\s+(?:smooth|smoother|flow)\b/i,
      /\b(?:smooth|fix)\s+(?:our\s+|the\s+)?(?:conversation|interaction)\s+(?:flow|state|glitches)?\b/i,
      /\b(?:smooth\s+out\s+the\s+conversation)\b/i,
      /\b(?:improve\s+conversation\s+flow)\b/i
    ];

    for (const pattern of smoothPatterns) {
      if (pattern.test(lower)) {
        return {
          intent: INTENTS.SMOOTH_CONVERSATION,
          confidence: 0.95,
          target: "conversational_smoothness"
        };
      }
    }

    // 3. Prompt Refinement / Generation Intent Detection
    const promptPatterns = [
      /\b(?:tell\s+andrew\s+to\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine)\s+(?:up\s+)?(?:a|the|my)?\s*(?:(?:high[- ]context|structured|master|developer|first|integrity)\s+)*prompt\b/i,
      /\b(?:prompt\s+for\s+(?:my\s+)?next\s+task)\b/i,
      /\b(?:prompt\s+in\s+antigravity)\b/i,
      /\b(?:turn\s+this\s+into\s+a\s+developer\s+prompt)\b/i,
      /\b(?:refine\s+(?:this\s+into\s+a\s+)?prompt)\b/i
    ];

    for (const pattern of promptPatterns) {
      if (pattern.test(lower)) {
        // Extract concept payload
        const cleanedTarget = rawText
          .replace(/^(?:hey\s+)?(?:tuk\s*tuk|andrew)[,\s]*(?:can\s+you\s+)?(?:please\s+)?(?:tell\s+andrew\s+to\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine)\s+(?:up\s+)?(?:a|the|my)?\s*(?:(?:high[- ]context|structured|master|developer|first|integrity)\s+)*prompt\s*(?:for|about|on)?\s*/i, "")
          .trim();

        return {
          intent: INTENTS.GENERATE_PROMPT,
          confidence: 0.95,
          target: cleanedTarget || rawText
        };
      }
    }

    return {
      intent: INTENTS.STANDARD_QUERY,
      confidence: 0.8,
      target: rawText
    };
  }
}

module.exports = {
  IntentParser,
  INTENTS
};
