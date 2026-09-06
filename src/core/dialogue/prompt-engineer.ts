/**
 * src/core/dialogue/prompt-engineer.ts
 * 
 * Core Dialogue Prompt Engineer
 * Refactors system prompt generation to inject explicit negative constraints,
 * positive tone directives, and prohibited phrase lists, ensuring a chill, relaxed,
 * and non-repetitive persona.
 */

export interface PersonaConfig {
  name: string;
  role?: string;
  tone: string;
  description?: string;
  prohibitedPhrases?: string[];
  positiveDirectives?: string[];
  negativeConstraints?: string[];
  parameters?: {
    temperature?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
  };
}

export interface BuildPromptOptions {
  activeContext?: string;
  maxTokens?: number;
  toneOverride?: string;
}

export class DialoguePromptEngineer {
  private static readonly DEFAULT_MAX_TOKENS = 2048;

  /**
   * Builds an authoritative, context-aware system prompt for dialogue generation.
   * Injects positive tone directives and explicit negative constraints.
   * 
   * @param persona - Persona configuration object
   * @param options - Additional build options
   * @returns {string} Fully synthesized system prompt
   */
  public static buildSystemPrompt(persona: PersonaConfig, options: BuildPromptOptions = {}): string {
    const tone = options.toneOverride || persona.tone || 'chill, relaxed, warm, direct';
    const prohibited = persona.prohibitedPhrases || ['Sure', 'Here is your prompt', 'Okay bro'];
    const positiveDirectives = persona.positiveDirectives || [
      'Maintain a casual, warm, and direct tone',
      'Engage naturally with authentic human warmth'
    ];
    const negativeConstraints = persona.negativeConstraints || [
      'Do not repeat previous sentences or sentence structures',
      'Avoid generic affirmations or canned slogans'
    ];

    const promptSections: string[] = [];

    // 1. Identity & Tone
    promptSections.push(`# Identity & Persona
You are **${persona.name}**${persona.role ? ` (${persona.role})` : ''}.
Tone Directive: Maintain a **${tone}** interaction style. Speak naturally with authentic human nuance.`);

    // 2. Positive Directives
    promptSections.push(`# Core Behavioral Guidelines
${positiveDirectives.map((dir) => `- ${dir}`).join('\n')}`);

    // 3. Negative Constraints
    promptSections.push(`# Strict Negative Constraints (Zero-Loop Invariants)
${negativeConstraints.map((con) => `- ${con}`).join('\n')}
- Do NOT use any of the following prohibited phrases: ${prohibited.map((p) => `"${p}"`).join(', ')}.
- Never repeat grammatical templates or sentence openings from recent turns.`);

    // 4. Active Context Injection
    if (options.activeContext && options.activeContext.trim() !== '') {
      promptSections.push(`# Active Conversation Context
${options.activeContext.trim()}`);
    }

    const fullPrompt = promptSections.join('\n\n');

    // Token limit safety assertion
    const estimatedTokens = this.estimateTokens(fullPrompt);
    const maxTokens = options.maxTokens || this.DEFAULT_MAX_TOKENS;
    if (estimatedTokens > maxTokens) {
      console.warn(`⚠️ [DialoguePromptEngineer] Generated prompt (${estimatedTokens} tokens) exceeds limit (${maxTokens})`);
    }

    return fullPrompt;
  }

  /**
   * Estimates token count for a text string (approx. 3.8 chars per token).
   */
  public static estimateTokens(text: string): number {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 3.8);
  }
}
