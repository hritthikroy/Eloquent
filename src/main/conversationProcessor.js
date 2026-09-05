/**
 * Conversation Processor Module
 * Ingests user-Tuk conversation transcripts, extracts speaker turns,
 * identifies actionable technical intents, and constructs structured Libboard/Antigravity prompts.
 */

const fs = require('fs');

class ConversationProcessor {
  /**
   * Generates a Libboard execution prompt from raw conversation input.
   * @param {Array|string} conversationInput - Array of turns, JSON string, or transcript text.
   * @param {Object} options - Optional configuration.
   * @returns {Object} Result containing success status, generated prompt, and metadata.
   */
  static generatePrompt(conversationInput, options = {}) {
    try {
      const turns = this.parseConversation(conversationInput);

      if (!turns || turns.length === 0) {
        const errorMsg = 'Unable to generate Libboard prompt: conversation data invalid';
        console.warn(`⚠️ [ConversationProcessor] ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          prompt: null,
          turnsCount: 0
        };
      }

      // Extract actionable intents from user-Tuk discourse
      const actions = this.extractActionableIntents(turns);
      const targetDomain = this.inferDomain(turns);

      // Build structured Libboard execution prompt
      const prompt = this.buildLibboardPrompt({
        turns,
        actions,
        targetDomain,
        appName: options.appName || 'Eloquent'
      });

      return {
        success: true,
        error: null,
        prompt,
        turnsCount: turns.length,
        actionsCount: actions.length,
        domain: targetDomain
      };
    } catch (err) {
      const errorMsg = `Unable to generate Libboard prompt: conversation data invalid`;
      console.error(`❌ [ConversationProcessor] Parsing error: ${err.message}`);
      return {
        success: false,
        error: errorMsg,
        prompt: null,
        turnsCount: 0
      };
    }
  }

  /**
   * Safely parses raw conversation input into normalized turn objects.
   */
  static parseConversation(input) {
    if (!input) return null;

    let data = input;

    // Handle string input: JSON string, file path, or plain text
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.length === 0) return null;

      // Check if input is a valid file path
      if (fs.existsSync(trimmed)) {
        try {
          const fileContent = fs.readFileSync(trimmed, 'utf8');
          return this.parseConversation(fileContent);
        } catch (e) {
          return null;
        }
      }

      // Check if input is JSON string
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          data = JSON.parse(trimmed);
        } catch (e) {
          // Fallback to plain text transcript parsing
          return this.parsePlainTextTranscript(trimmed);
        }
      } else {
        return this.parsePlainTextTranscript(trimmed);
      }
    }

    if (Array.isArray(data)) {
      const normalized = [];
      for (const turn of data) {
        if (!turn || typeof turn !== 'object') continue;
        const speaker = turn.speaker || turn.agent || turn.role || 'user';
        const text = turn.text || turn.content || turn.originalText || '';
        if (typeof text === 'string' && text.trim().length > 0) {
          normalized.push({
            speaker: speaker.toLowerCase(),
            text: text.trim(),
            timestamp: turn.timestamp || new Date().toISOString()
          });
        }
      }
      return normalized.length > 0 ? normalized : null;
    }

    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data.turns)) return this.parseConversation(data.turns);
      if (Array.isArray(data.history)) return this.parseConversation(data.history);
    }

    return null;
  }

  /**
   * Parse plain text line-by-line transcript
   */
  static parsePlainTextTranscript(text) {
    const lines = text.split('\n');
    const turns = [];
    const turnRegex = /^(?:\[?(user|tuk|tuk\s*tuk|ava|vision|andrew|brian|friday|fry\s*day|assistant)\]?[:\s-]+)(.*)$/i;

    for (const line of lines) {
      const match = line.trim().match(turnRegex);
      if (match) {
        let rawSpeaker = match[1].toLowerCase().replace(/\s+/g, '');
        if (rawSpeaker === 'andrew') rawSpeaker = 'vision';
        if (rawSpeaker === 'fryday') rawSpeaker = 'friday';
        turns.push({
          speaker: rawSpeaker,
          text: match[2].trim(),
          timestamp: new Date().toISOString()
        });
      }
    }

    return turns.length > 0 ? turns : null;
  }

  /**
   * Extracts concrete engineering intents from conversational turns.
   */
  static extractActionableIntents(turns) {
    const actions = [];
    const combined = turns.map(t => t.text).join(' ');

    if (/\b(audio|go|sound|mic|pcm|buffer|dsp|stream)\b/i.test(combined)) {
      actions.push('Optimize low-latency 16kHz PCM audio streaming pipeline in backend-go');
      actions.push('Enforce lock-free ring buffer synchronization and double-talk thresholding');
    }

    if (/\b(prompt|antigravity|clipboard|libboard|ast|validate)\b/i.test(combined)) {
      actions.push('Deploy recursive AST validation loop to eliminate conversational filler');
      actions.push('Route plain-text 3-section meta-prompts directly to system clipboard');
    }

    if (/\b(ipc|visualizer|canvas|overlay|electron|ui)\b/i.test(combined)) {
      actions.push('Decouple high-frequency audio visualizer telemetry from renderer reflows');
      actions.push('Ensure complete listener coverage across all Electron IPC channels');
    }

    if (actions.length === 0) {
      actions.push('Execute full static analysis pass across Node.js, Electron, and Go modules');
      actions.push('Maintain zero-error AST integrity and strict type safety across workspaces');
    }

    return actions;
  }

  /**
   * Infers active technical domain
   */
  static inferDomain(turns) {
    const combined = turns.map(t => t.text).join(' ').toLowerCase();
    if (combined.includes('audio') || combined.includes('backend') || combined.includes('go')) {
      return 'Go Audio Backend & DSP';
    }
    if (combined.includes('visualizer') || combined.includes('overlay') || combined.includes('electron')) {
      return 'Electron UI & IPC Bridge';
    }
    return 'Full-Duplex Multi-Agent Core';
  }

  /**
   * Constructs the authoritative Libboard execution prompt conforming to schema.
   */
  static buildLibboardPrompt(params) {
    const { turns, actions, targetDomain, appName } = params;
    const lastUserTurn = [...turns].reverse().find(t => t.speaker === 'user');
    const userIntent = lastUserTurn ? lastUserTurn.text : 'Execute discussed workspace enhancements';

    return `Clear Technical Objective
Implement actionable technical directives synthesized from the latest ${appName} user-Tuk conversation transcript. Address core intent: "${userIntent}". Enforce architectural alignment with ${targetDomain}.

Key Files / Architecture
- \`src/main/conversationProcessor.js\`: Ingests conversation turns and synthesizes structured execution prompts
- \`src/main/ipcHandlers.js\`: Exposes generate-libboard-prompt IPC channel for Electron renderer
- \`src/renderer/components/LibboardPromptViewer.jsx\`: React viewer with clipboard injection and error handling
- \`test/unit/conversationProcessor.test.js\`: Comprehensive unit test coverage for transcript parsing

Quality Requirements & AST Verification
${actions.map(a => `- ${a}`).join('\n')}
- Enforce clean AST validation: output must be strictly plain text without enclosing markdown code fences.
- Verify zero-regression testing on IPC channels and confirm clean execution with npm test.`;
  }
}

module.exports = {
  ConversationProcessor,
  generatePrompt: ConversationProcessor.generatePrompt.bind(ConversationProcessor)
};
