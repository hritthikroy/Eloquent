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
    const lower = (sanitizedText || "").toLowerCase();
    let domainFiles = [
      "- `src/main.js`: Update core event orchestration, lifecycle handlers, and pipeline triggers.",
      "- `src/utils/jarvis-manager.js`: Maintain multi-agent state coherence and domain routing.",
      "- `src/utils/action-runner.js`: Wire action dispatch, sovereign directives, and execution handlers."
    ];

    if (lower.includes("eye") || lower.includes("camera") || lower.includes("vision") || lower.includes("pose")) {
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
    } else if (lower.includes("prompt") || lower.includes("antigravity") || lower.includes("engineer")) {
      domainFiles = [
        "- `src/utils/prompt-engine/intent-parser.js`: Expand intent detection patterns and multi-agent directives.",
        "- `src/utils/prompt-engine/prompt-assembler.js`: Assemble natural, senior-developer Antigravity prompts.",
        "- `src/core/prompt-engineer.ts`: Verify 100% AST schema compliance and token boundaries."
      ];
    }

    return `Clear Technical Objective
Implement ${sanitizedText.trim().replace(/\.$/, '')}, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.

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
