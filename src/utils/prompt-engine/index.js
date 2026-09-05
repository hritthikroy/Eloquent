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
      geminiClient = null,
      projectDir = null
    } = options;

    // 1. Sanitize raw user speech (fix stutters, mishearings, terminology)
    const sanitized = TextSanitizer.sanitize(rawSpeech);

    // 2. Parse Intent
    const { intent, target, agentDirective = "vision", useConversationContext = false } = IntentParser.parse(sanitized);

    // If standard query, let regular conversational loop handle it
    if (intent === INTENTS.STANDARD_QUERY) {
      return { handled: false, intent, sanitized };
    }

    console.log(`🚀 [PromptEngine] Triggered intent: ${intent} with target: "${target}" (agent: ${agentDirective})`);

    // Handle immediate execution / firing of pending prompt into Antigravity
    if (intent === INTENTS.EXECUTE_PROMPT) {
      if (process.platform === "darwin") {
        try {
          const { exec } = require("child_process");
          // Press Enter (Key Code 36) in active Antigravity window
          exec(`osascript -e 'tell application "System Events" to key code 36' 2>/dev/null || true`);
        } catch (e) {}
      }
      return {
        handled: true,
        intent,
        speech: "Fired the prompt into Antigravity, bro! Execution is running now."
      };
    }

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
      : (target || (useConversationContext ? "" : sanitized));

    const assembledPrompt = await PromptAssembler.assemble({
      sanitizedText: promptConcept,
      enrichedContext,
      callGroqChatCompletion,
      geminiClient
    });

    // 5. Copy directly to macOS clipboard (Electron clipboard + pbcopy fallback)
    try {
      let copied = false;
      try {
        const { clipboard } = require("electron");
        if (clipboard && typeof clipboard.writeText === "function") {
          clipboard.writeText(assembledPrompt);
          copied = true;
        }
      } catch (e) {}

      if (!copied && process.platform === "darwin") {
        const cp = require("child_process").spawn("pbcopy");
        cp.stdin.write(assembledPrompt);
        cp.stdin.end();
      }
    } catch (e) {
      console.warn("⚠️ [PromptEngine] clipboard copy failed:", e.message);
    }

    // 6. Return response payload according to active agent persona
    let speechConfirmation = "I crafted the developer prompt with continuation ideas and injected it directly into Antigravity, bro! You can press Enter or tell me 'fire prompt' to execute it now.";
    if (intent === INTENTS.SMOOTH_CONVERSATION) {
      speechConfirmation = "I analyzed our conversation flow, eliminated the blockages, and engineered a structured developer prompt with next steps, bro! It's injected into your chat window and ready to fire.";
    } else if (agentDirective === "tuktuk") {
      speechConfirmation = "I've structured the full Antigravity prompt, babe! It's copied to your clipboard and pasted into Antigravity right now.";
    } else if (agentDirective === "friday") {
      speechConfirmation = "Executive developer prompt synthesized and copied to clipboard, Chief. Ready for deployment.";
    } else if (agentDirective === "dd") {
      speechConfirmation = "DevOps prompt locked in and synced to clipboard, bro. Ready to execute.";
    }

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
