/**
 * ContextEnricher
 * Serializes multi-turn dialogue, active app telemetry, and workspace state into enriched context
 */

class ContextEnricher {
  static enrich({ rawInput, jarvisManager = null, screenShareManager = null, projectDir = null }) {
    const context = {
      rawInput,
      timestamp: new Date().toISOString(),
      dialogueContext: [],
      activeApp: "Unknown",
      workspaceContext: "Eloquent (Node.js, Electron, Go audio backend)"
    };

    // 1. Serialize multi-turn conversation history
    if (jarvisManager && typeof jarvisManager.getHistory === "function") {
      try {
        const turns = jarvisManager.getHistory(6);
        context.dialogueContext = turns.map(t => `${t.role.toUpperCase()}: ${t.content}`);
      } catch (e) {
        console.warn("⚠️ [ContextEnricher] Failed to serialize history:", e.message);
      }
    }

    // 2. Extract active window vision telemetry if screen share is armed
    if (screenShareManager && typeof screenShareManager.getActiveWindowTitle === "function") {
      try {
        context.activeApp = screenShareManager.getActiveWindowTitle() || "Desktop";
      } catch (e) {}
    }

    // 3. Synthesize into compact prompt context block
    let contextSummary = "";
    if (context.dialogueContext.length > 0) {
      contextSummary += `Recent Conversation Turns:\n${context.dialogueContext.join("\n")}\n\n`;
    }
    if (context.activeApp && context.activeApp !== "Unknown") {
      contextSummary += `Active Focused Window: ${context.activeApp}\n`;
    }
    contextSummary += `Target Workspace: ${context.workspaceContext}\n`;

    return {
      ...context,
      contextSummary: contextSummary.trim()
    };
  }
}

module.exports = ContextEnricher;
