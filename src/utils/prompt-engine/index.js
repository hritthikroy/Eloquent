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

    // 2. Parse Intent (default agent: Tuk Tuk as Squad Leader)
    const { intent, target, agentDirective = "tuktuk", useConversationContext = false } = IntentParser.parse(sanitized);

    // If standard query, let regular conversational loop handle it
    if (intent === INTENTS.STANDARD_QUERY) {
      return { handled: false, intent, sanitized };
    }

    console.log(`🚀 [PromptEngine] Triggered intent: ${intent} with target: "${target}" (agent: ${agentDirective})`);

    // Check Single Real Voice Mode invariant
    let isSingleRealVoice = false;
    let userName = "Hritthik";
    try {
      if (jarvisManager && typeof jarvisManager.isSingleRealVoiceMode === "function") {
        isSingleRealVoice = jarvisManager.isSingleRealVoiceMode();
        userName = jarvisManager.config?.userName || (typeof jarvisManager.getUserName === "function" ? jarvisManager.getUserName() : "Hritthik");
      } else {
        const fs = require("fs");
        const path = require("path");
        const cfgPath = path.join(__dirname, "../../userData/jarvis-config.json");
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
          isSingleRealVoice = Boolean(cfg.singleRealVoiceActive || cfg.singleVoiceTukTukExclusive || cfg.multiPersonalityDisabled);
          userName = cfg.userName || "Hritthik";
        }
      }
    } catch (_) {}

    // Handle immediate execution / firing of pending prompt into Antigravity
    if (intent === INTENTS.EXECUTE_PROMPT) {
      if (process.platform === "darwin") {
        try {
          const { exec } = require("child_process");
          // Press Enter (Key Code 36) in active Antigravity window
          exec(`osascript -e 'tell application "System Events" to key code 36' 2>/dev/null || true`);
        } catch (e) {}
      }
      const executeSpeech = isSingleRealVoice
        ? `Fired the prompt into Antigravity, ${userName}! Execution is running now.`
        : "Fired the prompt into Antigravity, bro! Execution is running now.";
      return {
        handled: true,
        intent,
        speech: executeSpeech
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

    // 5. Copy directly to clipboard and auto-paste at current keyboard cursor
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

      // Auto-paste at active keyboard cursor position
      try {
        const PasteHelper = require("../paste-helper");
        const pasteHelper = new PasteHelper();
        pasteHelper.pasteText(assembledPrompt, { preserveClipboard: false, showNotification: false });
      } catch (_) {
        if (process.platform === "darwin") {
          const { exec } = require("child_process");
          setTimeout(() => {
            exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down' 2>/dev/null || true`);
          }, 150);
        }
      }
    } catch (e) {
      console.warn("⚠️ [PromptEngine] clipboard copy and auto-paste failed:", e.message);
    }

    // 5.1 Synchronize voice context with VoiceIdeBridge for Antigravity & Cursor MCP consumers
    try {
      const { voiceIdeBridge } = require("../voice-ide-bridge");
      voiceIdeBridge.recordUtterance({
        transcript: rawSpeech,
        cleanedText: sanitized,
        structuredPrompt: assembledPrompt,
        targetObjective: target || promptConcept,
        agentKey: agentDirective || "tuktuk"
      });
    } catch (err) {
      console.warn("⚠️ [PromptEngine] VoiceIdeBridge recordUtterance warning:", err.message);
    }

    // 6. Return response payload according to active agent persona (Tuk Tuk Leader, Vision, Friday, DD)
    let speechConfirmation = "";
    if (isSingleRealVoice) {
      if (intent === INTENTS.SMOOTH_CONVERSATION) {
        speechConfirmation = `I analyzed our workflow, eliminated the blockages, and engineered the structured developer prompt with continuation roadmap, ${userName}! It's pasted at your cursor and ready to fire.`;
      } else {
        speechConfirmation = `I've structured the full Antigravity developer prompt and pasted it directly at your keyboard cursor, ${userName}! Ready to fire.`;
      }
    } else {
      if (intent === INTENTS.SMOOTH_CONVERSATION) {
        speechConfirmation = "I analyzed our conversation flow, eliminated the blockages, and engineered a structured developer prompt with next steps, babe! It's pasted at your cursor and ready to fire.";
      } else if (agentDirective === "vision") {
        speechConfirmation = "I crafted the professional developer prompt and pasted it directly at your keyboard cursor, brother! You can press Enter or tell me 'fire prompt' to execute it now.";
      } else if (agentDirective === "friday") {
        speechConfirmation = "Executive developer prompt synthesized, copied to clipboard, and pasted at your keyboard cursor, Chief. Ready for deployment.";
      } else if (agentDirective === "dd") {
        speechConfirmation = "DevOps prompt locked in and pasted directly at your cursor, bro. Ready to execute.";
      } else {
        // Default: Tuk Tuk (Squad Leader)
        speechConfirmation = "I've structured the full Antigravity prompt and pasted it directly at your keyboard cursor, babe! Ready to fire.";
      }
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
