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
    // Strip any lingering trailing directives and hanging prepositions
    cleanObjective = cleanObjective
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
        cleanObjective = "multi-agent directives, prompt engineering resilience, and AST schema compliance";
      }
    }

    const lower = cleanObjective.toLowerCase();
    let domainFiles = [
      "- `src/main.js`: Update core event orchestration, lifecycle handlers, and pipeline triggers.",
      "- `src/utils/jarvis-manager.js`: Maintain multi-agent state coherence and domain routing.",
      "- `src/utils/action-runner.js`: Wire action dispatch, sovereign directives, and execution handlers."
    ];

    let technicalObjective = "";

    if (lower.includes("kana") || lower.includes("wohndraja") || lower.includes("ondhoraja") || (lower.includes("reading") && lower.includes("fix"))) {
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
    } else if (lower.includes("prompt") || lower.includes("antigravity") || lower.includes("engineer") || lower.includes("intent") || lower.includes("ast")) {
      domainFiles = [
        "- `src/utils/prompt-engine/intent-parser.js`: Expand intent detection patterns and multi-agent directives.",
        "- `src/utils/prompt-engine/prompt-assembler.js`: Assemble natural, senior-developer Antigravity prompts.",
        "- `src/core/prompt-engineer.ts`: Verify 100% AST schema compliance and token boundaries."
      ];
    }

    if (!technicalObjective) {
      if (/^(?:implement|refactor|build|optimize|enhance|fix|architect|harden|create)\b/i.test(cleanObjective)) {
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
}

module.exports = PromptAssembler;
