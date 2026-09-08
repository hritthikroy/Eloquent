/**
 * PromptAssembler
 * Formats high-fidelity developer prompts adhering strictly to:
 * - Clear Technical Objective
 * - Key Files / Architecture
 * - Quality Requirements & AST Verification
 */

class PromptAssembler {
  static async assemble({ sanitizedText, enrichedContext, callGroqChatCompletion = null, geminiClient = null }) {
    const systemPrompt = `You are Vision, elite 10x Lead Systems Architect and Master Prompt Engineer for Google Antigravity.
Your job is to transform raw human developer intent, thoughts, and conversational voice context into a deeply thoughtful, natural, human-like, production-grade developer prompt for Antigravity pair programming.

OUTPUT FORMAT REQUIREMENTS (STRICT):
You must output EXACTLY the following 4 sections:

Clear Technical Objective
[A concise, natural, authoritative, single-paragraph technical specification describing the exact problem, architectural intent, and what the code changes accomplish.]

Key Files / Architecture
- [List specific target files with clear, concise bullet points explaining what will be added, refactored, or fixed.]

Quality Requirements & AST Verification
- [Explicit requirements for static analysis, AST syntax verification via node -c, zero regressions, and edge-case handling.]

Next Steps & Continuation Roadmap
- [List 2 to 3 logical next features, optimizations, or test enhancements to continue the build process immediately after execution.]

CRITICAL RULES:
1. NO PREAMBLE. Do NOT start with "Sure", "Here is your prompt", "Okay bro", or conversational fluff.
2. NO MARKDOWN WRAPPERS around the entire prompt (do NOT enclose in \`\`\` or \`\`\`markdown).
3. Authoritative, direct, natural 10x senior developer tone ready to be pasted directly into an AI coding agent.
4. Avoid robotic, generic placeholders. Specify real architecture files, explicit methods, and concrete verification commands.`;

    const userPrompt = `Context:
${enrichedContext?.contextSummary || "Eloquent Desktop Workspace with Electron, Node.js, and Go audio backend"}

User Raw Intent:
"${sanitizedText}"

Assemble the structured Antigravity developer prompt:`;

    // 1. Try Groq chat completion
    if (callGroqChatCompletion && typeof callGroqChatCompletion === "function") {
      try {
        const res = await callGroqChatCompletion([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ], { temperature: 0.25, max_tokens: 750 });

        let promptText = res.content.trim();
        promptText = promptText.replace(/^```(?:markdown)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim();
        promptText = promptText.replace(/^(?:Here\s+is\s+(?:the|your)\s+prompt:?|Sure[,!]\s*|Okay\s+(?:bro|babe)[,!]\s*)/i, "").trim();

        if (promptText.includes("Clear Technical Objective") && promptText.includes("Key Files / Architecture")) {
          return promptText;
        }
      } catch (err) {
        console.warn("⚠️ [PromptAssembler] Groq LLM prompt generation fallback:", err.message);
      }
    }

    // 2. Try Gemini client
    if (geminiClient && typeof geminiClient.callChatCompletion === "function") {
      try {
        const gemRes = await geminiClient.callChatCompletion([
          { role: "user", content: `${systemPrompt}\n\n${userPrompt}` }
        ], { temperature: 0.25, max_tokens: 750 });

        let promptText = (gemRes.content || "").trim();
        promptText = promptText.replace(/^```(?:markdown)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim();
        promptText = promptText.replace(/^(?:Here\s+is\s+(?:the|your)\s+prompt:?|Sure[,!]\s*|Okay\s+(?:bro|babe)[,!]\s*)/i, "").trim();

        if (promptText.includes("Clear Technical Objective") && promptText.includes("Key Files / Architecture")) {
          return promptText;
        }
      } catch (err) {
        console.warn("⚠️ [PromptAssembler] Gemini client prompt generation fallback:", err.message);
      }
    }

    // 3. Domain-Aware Dynamic Deterministic Assembler
    let cleanObjective = (sanitizedText || "").trim().replace(/\.$/, '');
    // Strip leading and trailing prompt generation commands and hanging prepositions
    cleanObjective = cleanObjective
      .replace(/^(?:implement\s+)?(?:please\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble|build)\s+(?:up\s+)?(?:a|the|my|an)?\s*(?:(?:next|high[- ]context|structured|master|developer|first|integrity|human[- ]like|antigravity)\s+)*(?:prompt|প্রম্পট)\s*(?:for|about|on|of|to)?\s*/i, '')
      .replace(/[,;\s]*(?:and\s+)?(?:please\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble)\s+(?:up\s+)?(?:a|the|my|an)?\s*(?:(?:high[- ]context|structured|master|developer|first|integrity|human[- ]like|antigravity)\s+)*prompt\s*(?:for|about|on|of|to)?\s*$/i, '')
      .replace(/[,;\s]*(?:er\s+upor|niye)?\s*prompt\s*(?:banao|dao|likho|ready\s*koro|banie\s*dao)\s*$/i, '')
      .replace(/[,;\s]+(?:for|about|on|to|with|in)\s*$/i, '')
      .trim();

    // Guard against conversational filler phrases being used as technical objectives
    const isFiller = (text) => {
      if (!text || typeof text !== "string") return true;
      const t = text.toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
      if (!t) return true;
      if (/^(?:this|it|that|for\s+this|for\s+it|next|next\s+task|next\s+step|the\s+next\s+task|the\s+next\s+step|the\s+next\s+prompt|the\s+prompt|prompt|task)$/i.test(t)) return true;
      if (/^(?:so|well|okay|ok|now|and|then|yeah)?\s*(?:i|we)?\s*(?:am|m|are|re|will|ll)?\s*(?:going|about|trying|planning|ready|preparing)?\s*(?:to)?$/i.test(t)) return true;
      if (/^(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble)\s+(?:up\s+)?(?:a|the|my|an)?\s*(?:prompt)?$/i.test(t)) return true;
      return false;
    };

    if (isFiller(cleanObjective)) {
      // Intelligently infer objective from dialogue context or integrity report
      const historyStr = Array.isArray(enrichedContext?.dialogueContext)
        ? enrichedContext.dialogueContext.join(" ").toLowerCase()
        : (enrichedContext?.contextSummary || "").toLowerCase();

      if (historyStr.includes("bangla") || historyStr.includes("bengali") || historyStr.includes("voice") || historyStr.includes("robotic")) {
        cleanObjective = "Bangla original thinker tone, 1:1 bilingual persona parity, and neural voice cadence across all squad agents";
      } else if (historyStr.includes("audio") || historyStr.includes("vad") || historyStr.includes("ring buffer") || historyStr.includes("streaming")) {
        cleanObjective = "full-duplex Go audio backend streaming, VAD thresholds, and low-latency IPC ring buffers";
      } else if (historyStr.includes("prompt") || historyStr.includes("intent") || historyStr.includes("antigravity") || historyStr.includes("ast")) {
        cleanObjective = "prompt engineering pipeline resilience, multi-agent intent parsing, and AST schema compliance";
      } else if (historyStr.includes("eye") || historyStr.includes("camera") || historyStr.includes("vision") || historyStr.includes("posture")) {
        cleanObjective = "autonomous squad ocular vision tracking, offscreen camera frame capture, and posture telemetry sync";
      } else {
        cleanObjective = "prompt engineering pipeline resilience, multi-agent intent parsing, and AST schema compliance";
      }
    }

    // Normalize gerund prefixes into imperative form to avoid clumsy formulations
    cleanObjective = cleanObjective
      .replace(/^fixing\s+/i, "Fix ")
      .replace(/^implementing\s+/i, "Implement ")
      .replace(/^refactoring\s+/i, "Refactor ")
      .replace(/^building\s+/i, "Build ")
      .replace(/^optimizing\s+/i, "Optimize ")
      .replace(/^enhancing\s+/i, "Enhance ");

    const lower = cleanObjective.toLowerCase();
    let domainFiles = [
      "- `src/main.js`: Update core event orchestration, lifecycle handlers, and pipeline triggers.",
      "- `src/utils/jarvis-manager.js`: Maintain multi-agent state coherence and domain routing.",
      "- `src/utils/action-runner.js`: Wire action dispatch, sovereign directives, and execution handlers."
    ];

    let technicalObjective = "";

    const isLongContextMeeting =
      (/\b(?:long\s+context|long\s+memory)\b/i.test(cleanObjective) && /\b(?:big\s+proble|big\s+problem|office\s+meting|office\s+meeting|big\s+office|antigravty|antigravity)\b/i.test(cleanObjective)) ||
      (/\b(?:office\s+meting|office\s+meeting|big\s+office)\b/i.test(cleanObjective) && /\b(?:long\s+context|long\s+memory|solve\s+big\s+proble|solve\s+big\s+problem|antigravty|antigravity|fix\s+all\s+issues)\b/i.test(cleanObjective)) ||
      (/\b(?:solve\s+big\s+(?:proble|problem))\b/i.test(cleanObjective) && /\b(?:office\s+meting|office\s+meeting|antigravty|antigravity|long\s+context|long\s+memory)\b/i.test(cleanObjective)) ||
      (/\b(?:long\s+context|long\s+memory)\b/i.test(cleanObjective) && /\b(?:antigravty|antigravity)\b/i.test(cleanObjective) && /\b(?:fix\s+all\s+issues|fix\s+issues)\b/i.test(cleanObjective)) ||
      (/\b(?:i\s+need\s+long\s+context|need\s+long\s+context|need\s+long\s+memory)\b/i.test(cleanObjective));

    const isShortTermMemoryLoss =
      /\b(?:short\s*(?:time|term)|working)\s+memory\s+(?:loss|lost|issues?|drops?|fail|failing|wipe|wiped|leak|leaks|leaking)\b/i.test(cleanObjective) ||
      /\b(?:memory\s+loss|memory\s+lost)\b/i.test(cleanObjective) ||
      /\b(?:reset\s+conversation|conversation\s+reset|every\s+time\s+reset)\b/i.test(cleanObjective);

    const isMetaIssueRemediation =
      /\b(?:fix|resolve|remediate)\s+(?:this\s+kind\s+of\s+)?(?:all\s+)?(?:these\s+|the\s+)?issues?\b/i.test(cleanObjective) ||
      /\b(?:prompt\s+engineering\s+pipeline\s+resilience|multi[- ]agent\s+intent\s+parsing|ast\s+schema\s+compliance)\b/i.test(cleanObjective);

    if (isLongContextMeeting) {
      domainFiles = [
        "- `src/utils/jarvis-manager.js`: Expand active working memory window to 128 turns, prevent context truncation, and maintain deep office meeting episodic retention.",
        "- `src/utils/action-runner.js`: Guard office meeting long-memory directives against standup rollcall hijacking and automate Antigravity prompt dispatch.",
        "- `src/utils/prompt-engine/context-enricher.js`: Deepen multi-turn dialogue serialization up to 128 turns for comprehensive problem-solving context.",
        "- `src/utils/prompt-engine/prompt-assembler.js`: Structure complete multi-section Antigravity AST prompts with extended office meeting memory."
      ];
      technicalObjective = `Implement ultra-long context and office meeting episodic memory expansion with 128 turns, zero-loss multi-turn context retention, and automated Antigravity issue remediation, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.`;
    } else if (isShortTermMemoryLoss) {
      domainFiles = [
        "- `src/utils/jarvis-manager.js`: Expand active working memory window, prevent destructive history truncation, and inject living memory into compact prompts.",
        "- `src/utils/zero-loss-memory.js`: Ensure zero-loss Write-Ahead Logging and instant local fact extraction without cloud latency.",
        "- `src/utils/local-cognitive-brain.js`: Wire multi-turn working memory recall into local cognitive fallbacks to eliminate short-term conversational amnesia."
      ];
      technicalObjective = `Implement short-term working memory persistence, multi-turn episodic retention, and zero-loss context synchronization, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.`;
    } else if (isMetaIssueRemediation) {
      domainFiles = [
        "- `src/utils/prompt-engine/intent-parser.js`: Expand intent detection patterns and multi-agent directives.",
        "- `src/utils/prompt-engine/prompt-assembler.js`: Assemble natural, senior-developer Antigravity prompts.",
        "- `src/core/prompt-engineer.ts`: Verify 100% AST schema compliance and token boundaries."
      ];
      technicalObjective = `Implement prompt engineering pipeline resilience, multi-agent intent parsing, and AST schema compliance, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.`;
    } else if (lower.includes("kana") || lower.includes("wohndraja") || lower.includes("ondhoraja") || (lower.includes("reading") && lower.includes("fix"))) {
      domainFiles = [
        "- `src/utils/prompt-engine/intent-parser.js`: Expand intent detection patterns and multi-agent directives.",
        "- `src/utils/prompt-engine/prompt-assembler.js`: Assemble natural, senior-developer Antigravity prompts.",
        "- `src/core/prompt-engineer.ts`: Verify 100% AST schema compliance and token boundaries."
      ];
      technicalObjective = `Implement Kana Wohndraja, keep reading and fix every issue, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.`;
    } else if (lower.includes("bangla") || lower.includes("bengali") || lower.includes("original thinker") || lower.includes("persona parity")) {
      domainFiles = [
        "- `src/utils/local-cognitive-brain.js`: Enforce original thinker Bengali cognition and 1:1 persona parity across all squad turns.",
        "- `src/utils/bangla-voice-cortex.js`: Calibrate prosodic pitch, rate, and chest warmth for natural Dhaka studio cadence.",
        "- `src/utils/jarvis-manager.js`: Maintain strict persona invariants and zero repetitive clichés in Bengali prompts."
      ];
    } else if (lower.includes("eye") || lower.includes("camera") || lower.includes("vision") || lower.includes("pose")) {
      domainFiles = [
        "- `src/renderer/eyeTracker.js`: Harden optical flow calculations, zero-allocation buffers, and posture classification.",
        "- `src/ui/camera-worker.html`: Maintain low-latency offscreen frame capture and multi-level constraint negotiation.",
        "- `src/utils/camera-manager.js`: Ensure telemetry sync, macOS permission pre-flight, and visual context formatting."
      ];
    } else if (lower.includes("audio") || lower.includes("vad") || lower.includes("mic") || lower.includes("whisper") || lower.includes("buffer")) {
      domainFiles = [
        "- `src/utils/audio-recorder.js`: Ensure 0-buffer instant streaming pass-through and low-latency chunk forwarding.",
        "- `backend/audio/buffer.go`: Maintain ring-buffer thread-safety, zero data-race guarantees, and clean audio teardown.",
        "- `src/core/audio/ringbuffer.js`: Optimize fast-path IPC audio streaming with 16.66ms render budget compliance."
      ];
    } else if (lower.includes("prompt") || lower.includes("antigravity") || lower.includes("engineer") || lower.includes("intent") || lower.includes("ast") || lower.includes("issue")) {
      domainFiles = [
        "- `src/utils/prompt-engine/intent-parser.js`: Expand intent detection patterns and multi-agent directives.",
        "- `src/utils/prompt-engine/prompt-assembler.js`: Assemble natural, senior-developer Antigravity prompts.",
        "- `src/core/prompt-engineer.ts`: Verify 100% AST schema compliance and token boundaries."
      ];
    }

    if (!technicalObjective) {
      if (/^(?:implement|refactor|build|optimize|enhance|fix|architect|harden|create|remediate|resolve)\b/i.test(cleanObjective)) {
        technicalObjective = `${cleanObjective}, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.`;
      } else {
        technicalObjective = `Implement ${cleanObjective}, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.`;
      }
    }

    return `Clear Technical Objective
${technicalObjective}

Key Files / Architecture
${domainFiles.join("\n")}

Quality Requirements & AST Verification
- Validate 100% AST syntax clean execution via node -c across all modified JavaScript files.
- Ensure all automated test suites pass without regression (npm test).
- Verify edge cases, graceful degradation, and zero memory leaks across long-running loops.

Next Steps & Continuation Roadmap
- Monitor real-time telemetry and CPU overhead during active multi-turn interactions.
- Add targeted unit/integration test coverage for newly introduced execution paths.
- Benchmark end-to-end responsiveness and verify zero frame drops in the UI render thread.`;
  }

  static assemblePrompt(text) {
    return this.assemble({ sanitizedText: text });
  }
}

PromptAssembler.PromptAssembler = PromptAssembler;
module.exports = PromptAssembler;
