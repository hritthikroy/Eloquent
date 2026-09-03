/**
 * PromptAssembler
 * Formats high-fidelity developer prompts adhering strictly to:
 * - Clear Technical Objective
 * - Key Files / Architecture
 * - Quality Requirements & AST Verification
 */

class PromptAssembler {
  static async assemble({ sanitizedText, enrichedContext, callGroqChatCompletion = null }) {
    const systemPrompt = `You are Andrew, elite Lead Software Engineer and master Prompt Engineer for Google Antigravity.
Your job is to transform raw developer intent, conversational context, and instructions into a pristine, production-ready, structured developer prompt.

OUTPUT FORMAT REQUIREMENTS (STRICT):
You must output EXACTLY the following 4 sections:

Clear Technical Objective
[A concise, authoritative, single-paragraph statement of the task and what the code change accomplishes.]

Key Files / Architecture
- [List specific files, modules, classes, or endpoints to be created or modified with brief bullet points explaining changes.]

Quality Requirements & AST Verification
- [Explicit requirements for static analysis, AST syntax verification via node -c, zero regressions, and edge-case handling.]

Next Steps & Continuation Roadmap
- [List 2 to 3 logical next features, optimizations, or test enhancements to continue the build process immediately after execution.]

CRITICAL RULES:
1. NO PREAMBLE. Do NOT start with "Sure", "Here is your prompt", "Okay bro", or any conversational filler.
2. NO MARKDOWN WRAPPERS around the entire prompt (do NOT enclose in \`\`\` or \`\`\`markdown).
3. Authoritative, direct, 10x senior developer tone ready to be pasted directly into an AI coding agent.`;

    const userPrompt = `Context:
${enrichedContext.contextSummary}

User Raw Intent:
"${sanitizedText}"

Assemble the structured Antigravity developer prompt:`;

    if (callGroqChatCompletion && typeof callGroqChatCompletion === "function") {
      try {
        const res = await callGroqChatCompletion([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ], { temperature: 0.2, max_tokens: 600 });

        let promptText = res.content.trim();

        // Strip any accidental markdown fences wrapping the entire output
        promptText = promptText.replace(/^```(?:markdown)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim();

        // Strip any accidental conversational intro
        promptText = promptText.replace(/^(?:Here\s+is\s+(?:the|your)\s+prompt:?|Sure[,!]\s*|Okay\s+bro[,!]\s*)/i, "").trim();

        return promptText;
      } catch (err) {
        console.warn("⚠️ [PromptAssembler] LLM generation failed, falling back to deterministic assembler:", err.message);
      }
    }

    // Deterministic fallback assembler
    return `Clear Technical Objective
${sanitizedText}

Key Files / Architecture
- src/main.js: Update core event orchestration and pipeline triggers.
- src/utils/jarvis-manager.js: Maintain state coherence and agent domain routing.
- src/utils/action-runner.js: Wire action dispatch and execution handlers.

Quality Requirements & AST Verification
- Validate 100% AST syntax clean execution via node -c across all modified modules.
- Ensure zero conversational regressions or rate limit bottlenecks.
- Verify all edge cases handle ambiguous input gracefully.

Next Steps & Continuation Roadmap
- Monitor buffer telemetry and CPU impact during real-world streaming.
- Wire auto-retry mechanisms for transient network fluctuations.
- Run integration test suite across multi-agent turns.`;
  }
}

module.exports = PromptAssembler;
