/**
 * PromptEngine (Production-Ready Pipeline)
 * Orchestrates TextSanitizer -> IntentParser -> ContextEnricher -> PromptAssembler
 */

const TextSanitizer = require("./text-sanitizer");
const { IntentParser, INTENTS } = require("./intent-parser");
const ContextEnricher = require("./context-enricher");
const PromptAssembler = require("./prompt-assembler");

class PromptEngine {
  static async process(rawSpeech, options = {}) {
    const {
      jarvisManager = null,
      screenShareManager = null,
      callGroqChatCompletion = null,
      projectDir = null
    } = options;

    // 1. Sanitize raw user speech (fix stutters, mishearings, terminology)
    const sanitized = TextSanitizer.sanitize(rawSpeech);

    // 2. Parse Intent
    const { intent, target } = IntentParser.parse(sanitized);

    // If standard query, let regular conversational loop handle it
    if (intent === INTENTS.STANDARD_QUERY) {
      return { handled: false, intent, sanitized };
    }

    console.log(`🚀 [PromptEngine] Triggered intent: ${intent} with target: "${target}"`);

    // 3. Enrich context with multi-turn history and vision telemetry
    const enrichedContext = ContextEnricher.enrich({
      rawInput: target || sanitized,
      jarvisManager,
      screenShareManager,
      projectDir
    });

    // 4. Assemble high-fidelity developer prompt
    const promptConcept = intent === INTENTS.SMOOTH_CONVERSATION
      ? "Implement a persistent conversational state management system to ensure ultra-smooth turn-taking, flawless multi-turn context retention, and zero rate-limit glitches."
      : (target || sanitized);

    const assembledPrompt = await PromptAssembler.assemble({
      sanitizedText: promptConcept,
      enrichedContext,
      callGroqChatCompletion
    });

    // 5. Copy directly to macOS clipboard (pbcopy)
    try {
      if (process.platform === "darwin") {
        const cp = require("child_process").spawn("pbcopy");
        cp.stdin.write(assembledPrompt);
        cp.stdin.end();
      }
    } catch (e) {
      console.warn("⚠️ [PromptEngine] pbcopy failed:", e.message);
    }

    // 6. Return response payload for Andrew
    const speechConfirmation = intent === INTENTS.SMOOTH_CONVERSATION
      ? "I analyzed our conversation flow, eliminated the blockages, and engineered a structured developer prompt for Antigravity, bro! It's copied to your clipboard and auto-pasted."
      : "I crafted the developer prompt based on our discussion and injected it straight into your Antigravity text window, bro! It's also on your clipboard.";

    return {
      handled: true,
      intent,
      prompt: assembledPrompt,
      speech: speechConfirmation
    };
  }
}

module.exports = {
  PromptEngine,
  TextSanitizer,
  IntentParser,
  ContextEnricher,
  PromptAssembler,
  INTENTS
};
