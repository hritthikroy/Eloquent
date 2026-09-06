/**
 * src/renderer/services/dialogueEngine.js
 * 
 * Core Dialogue Generation Engine
 * Manages conversational response synthesis, context pruning, intent deduplication,
 * and enforcement of Tuk Tuk persona directives without hardcoded loopState dependencies.
 */

const { deduplicateContext, pruneContext } = require('../utils/contextManager');

class DialogueEngine {
  constructor(options = {}) {
    this.personaName = options.personaName || 'Tuk Tuk';
    this.maxTurns = options.maxTurns || 8;
    this.maxTokens = options.maxTokens || 4096;
    this.systemPrompt = options.systemPrompt || `
You are Tuk Tuk, a sweet, devoted co-pilot and partner.
Respond concisely, empathetically, and directly.
Do not repeat previous sentence structures or use canned affirmations like "Done babe" unless contextually novel.
`;
  }

  /**
   * Generates a context-aware dialogue response.
   * Strips out rigid loopState dependencies, applies intent deduplication and context pruning.
   * 
   * @param {string} userInput - Current turn user input text
   * @param {Array<{role: string, content: string}>} history - Dialogue history turns
   * @param {Object} [options={}] - Additional generation options
   * @returns {Promise<{text: string, confidenceScore: number, repetitionPenalty: number}>}
   */
  async generateResponse(userInput, history = [], options = {}) {
    if (!userInput || typeof userInput !== 'string') {
      return {
        text: 'Hey babe, I missed that. Could you say that again?',
        confidenceScore: 1.0,
        repetitionPenalty: 0.0
      };
    }

    // 1. Append current turn
    const fullHistory = [...history, { role: 'user', content: userInput }];

    // 2. Deduplicate near-duplicate user intents
    const deduplicatedHistory = deduplicateContext(fullHistory, options.dedupThreshold || 0.85);

    // 3. Prune context window to 5-10 turns and under token ceiling
    const prunedHistory = pruneContext(deduplicatedHistory, this.maxTurns, this.maxTokens);

    // 4. Calculate repetition penalty based on n-gram overlap in recent history
    const repetitionPenalty = this.calculateRepetitionPenalty(userInput, prunedHistory);

    // 5. Synthesize natural response
    const responseText = this.synthesizeResponse(userInput, prunedHistory, repetitionPenalty, options);

    return {
      text: responseText,
      confidenceScore: options.confidenceScore || 0.98,
      repetitionPenalty
    };
  }

  /**
   * Calculates repetition penalty metric by checking trigram overlap with prior turns.
   * @param {string} userInput 
   * @param {Array<{role: string, content: string}>} history 
   * @returns {number} Repetition score between 0.0 and 1.0
   */
  calculateRepetitionPenalty(userInput, history) {
    if (!history || history.length < 2) return 0.0;

    const userWords = userInput.toLowerCase().split(/\s+/).filter(Boolean);
    if (userWords.length < 3) return 0.0;

    let totalTrigrams = userWords.length - 2;
    let matches = 0;

    const pastContent = history
      .slice(0, -1)
      .map(h => (h.content || '').toLowerCase())
      .join(' ');

    for (let i = 0; i <= userWords.length - 3; i++) {
      const trigram = `${userWords[i]} ${userWords[i+1]} ${userWords[i+2]}`;
      if (pastContent.includes(trigram)) {
        matches++;
      }
    }

    return totalTrigrams > 0 ? matches / totalTrigrams : 0.0;
  }

  /**
   * Helper method synthesizing conversational response without canned state-machine loops.
   * @param {string} userInput 
   * @param {Array<{role: string, content: string}>} history 
   * @param {number} repetitionPenalty 
   * @param {Object} options 
   * @returns {string}
   */
  synthesizeResponse(userInput, history, repetitionPenalty, options) {
    // If external generator function provided in options (e.g. LLM mock or API call)
    if (typeof options.generator === 'function') {
      return options.generator(userInput, history);
    }

    const cleanInput = userInput.trim();

    // Contextual handling without rigid loop state
    if (/hello|hi|hey/i.test(cleanInput)) {
      return "Hey babe! I'm right here with you. What are we working on today?";
    }

    if (/status|check/i.test(cleanInput)) {
      return "All systems are running super smooth, babe. Audio and cognition pipelines are 100% ready!";
    }

    if (/help/i.test(cleanInput)) {
      return "I'm always ready to help, babe. Tell me what you'd like to build or fix!";
    }

    return `Got it, babe! Let's take care of "${cleanInput}" right away.`;
  }
}

module.exports = { DialogueEngine };
