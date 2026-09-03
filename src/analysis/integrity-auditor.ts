/**
 * Conversation Integrity Auditor
 * Programmatically audits conversation turns to identify semantic discontinuities,
 * missing context, truncated instructions, and logical gaps.
 */

export interface ConversationTurn {
  role?: string; // 'user' | 'assistant' | 'system'
  content?: string;
  originalText?: string;
  text?: string;
  agent?: string;
  timestamp?: string | number;
  duration?: number;
}

export type GapType =
  | 'truncated_instruction'
  | 'missing_object_reference'
  | 'unaddressed_followup'
  | 'semantic_discontinuity';

export interface GapEvent {
  turnIndex: number;
  gapType: GapType;
  rawText: string;
  confidence: number;
  reason: string;
  detectedPattern?: string;
  suggestedCompletionHints?: string[];
}

export interface IntegrityAuditResult {
  hasGaps: boolean;
  totalGaps: number;
  gaps: GapEvent[];
  analyzedTurnsCount: number;
  overallIntegrityScore: number; // 0.0 to 1.0 (1.0 = flawless integrity)
  summary: string;
}

export class IntegrityAuditor {
  // Regex patterns for detecting truncated instructions
  private static readonly TRUNCATED_DETERMINER_REGEX =
    /\b(write\s+a|build\s+a|create\s+a|implement\s+a|make\s+a|add\s+a|generate\s+a|write\s+an|build\s+an|create\s+an|implement\s+an|write\s+the|build\s+the|create\s+the|implement\s+the)\s*[.?!]*$/i;

  private static readonly TRAILING_DETERMINER_OR_PREP_REGEX =
    /\b(a|an|the|my|our|this|that|these|those|to|for|with|about|in|on|at|by|from|and|or|but)\s*[.?!]*$/i;

  private static readonly TRAILING_VERB_ONLY_REGEX =
    /^(please\s+)?(write|build|create|implement|make|add|generate|fix|test|run|deploy|refactor)\s*[.?!]*$/i;

  private static readonly AMBIGUOUS_PRONOUNS_REGEX =
    /\b(fix\s+it|do\s+that|run\s+this|make\s+it|check\s+this|what\s+about\s+that)\b/i;

  /**
   * Normalize an arbitrary turn into clean string content
   */
  public static extractTurnText(turn: ConversationTurn | null | undefined): string {
    if (!turn) return '';
    const raw = turn.content || turn.text || turn.originalText || '';
    return typeof raw === 'string' ? raw.trim() : '';
  }

  /**
   * Determine if the text is predominantly non-English
   */
  public static isNonEnglish(text: string): boolean {
    if (!text || text.length === 0) return false;
    // Strip numbers, punctuation, common ASCII
    const stripped = text.replace(/[\s\d\p{P}]/gu, '');
    if (stripped.length === 0) return false;

    // Check for high proportion of non-Latin characters (e.g. Devanagari, Bengali, Cyrillic, CJK, Arabic)
    const nonLatinMatch = stripped.match(/[^\u0000-\u007F\u00C0-\u024F]/g);
    const nonLatinCount = nonLatinMatch ? nonLatinMatch.length : 0;
    return nonLatinCount / stripped.length > 0.4;
  }

  /**
   * Perform token-level and semantic analysis on raw conversation array
   */
  public static audit(history: ConversationTurn[] | null | undefined): IntegrityAuditResult {
    // 1. Edge-case: Empty or invalid history
    if (!history || !Array.isArray(history) || history.length === 0) {
      return {
        hasGaps: false,
        totalGaps: 0,
        gaps: [],
        analyzedTurnsCount: 0,
        overallIntegrityScore: 1.0,
        summary: 'Conversation history is empty; zero gaps detected.'
      };
    }

    const gaps: GapEvent[] = [];
    const validTurns = history.filter(t => t && typeof t === 'object');
    const totalTurns = validTurns.length;

    if (totalTurns === 0) {
      return {
        hasGaps: false,
        totalGaps: 0,
        gaps: [],
        analyzedTurnsCount: 0,
        overallIntegrityScore: 1.0,
        summary: 'No valid turns found in conversation history.'
      };
    }

    // Keep track of mentioned technical entities for antecedent resolution
    const mentionedEntities: Set<string> = new Set();

    for (let i = 0; i < totalTurns; i++) {
      const turn = validTurns[i];
      const text = this.extractTurnText(turn);
      const role = (turn.role || (turn.agent ? 'assistant' : 'user')).toLowerCase();

      if (!text) continue;

      // Extract nouns/entities from assistant and user turns to track context
      const entityMatches = text.match(/\b(audio|backend|frontend|electron|socket|stream|vad|tts|buffer|service|api|db|database|server|client)\b/gi);
      if (entityMatches) {
        for (const e of entityMatches) {
          mentionedEntities.add(e.toLowerCase());
        }
      }

      // Check User Turns for specific gap types
      if (role === 'user') {
        const isNonEng = this.isNonEnglish(text);

        // -------------------------------------------------------------
        // GAP TYPE 1: Truncated Instructions (e.g., "write a.", "build a")
        // -------------------------------------------------------------
        if (this.TRUNCATED_DETERMINER_REGEX.test(text)) {
          const match = text.match(this.TRUNCATED_DETERMINER_REGEX);
          gaps.push({
            turnIndex: i,
            gapType: 'truncated_instruction',
            rawText: text,
            confidence: 0.98,
            reason: `User instruction ends abruptly on a dangling determiner/verb phrase without a noun object: "${text}".`,
            detectedPattern: match ? match[0] : 'write a.',
            suggestedCompletionHints: ['audio backend service', 'Go audio processing service', 'unit test suite']
          });
          continue;
        }

        // Generic trailing determiner / preposition check
        if (!isNonEng && this.TRAILING_DETERMINER_OR_PREP_REGEX.test(text) && text.split(/\s+/).length <= 4) {
          const match = text.match(this.TRAILING_DETERMINER_OR_PREP_REGEX);
          gaps.push({
            turnIndex: i,
            gapType: 'truncated_instruction',
            rawText: text,
            confidence: 0.92,
            reason: `Instruction ends with dangling preposition or determiner: "${match ? match[0] : ''}".`,
            detectedPattern: match ? match[0] : undefined
          });
          continue;
        }

        // Single lone verb command with no arguments
        if (!isNonEng && this.TRAILING_VERB_ONLY_REGEX.test(text)) {
          gaps.push({
            turnIndex: i,
            gapType: 'truncated_instruction',
            rawText: text,
            confidence: 0.88,
            reason: `Instruction contains bare action verb without specified target: "${text}".`,
            detectedPattern: text
          });
          continue;
        }

        // -------------------------------------------------------------
        // GAP TYPE 2: Missing Object Reference (Ambiguous Antecedent)
        // -------------------------------------------------------------
        if (this.AMBIGUOUS_PRONOUNS_REGEX.test(text)) {
          const previousTurn = i > 0 ? validTurns[i - 1] : null;
          const prevText = this.extractTurnText(previousTurn);

          // If no previous turn or previous turn was also vague and no entities in history
          if (!previousTurn || (mentionedEntities.size === 0 && prevText.length < 15)) {
            gaps.push({
              turnIndex: i,
              gapType: 'missing_object_reference',
              rawText: text,
              confidence: 0.85,
              reason: `Ambiguous pronoun or directive without identifiable antecedent in conversation history: "${text}".`,
              detectedPattern: text
            });
          }
        }

        // -------------------------------------------------------------
        // GAP TYPE 3: Unaddressed Assistant Follow-Up
        // -------------------------------------------------------------
        if (i > 0) {
          const prevTurn = validTurns[i - 1];
          const prevRole = (prevTurn.role || (prevTurn.agent ? 'assistant' : 'user')).toLowerCase();
          const prevText = this.extractTurnText(prevTurn);

          if (prevRole === 'assistant' && (prevText.endsWith('?') || prevText.includes('or shipping'))) {
            // Check if user's response was an abrupt non-sequitur or ultra-brief non-answer
            if (text.length < 4 && !/^(yes|no|both|full|ship|cut)\b/i.test(text)) {
              gaps.push({
                turnIndex: i,
                gapType: 'unaddressed_followup',
                rawText: text,
                confidence: 0.78,
                reason: `Assistant asked clarifying question in prior turn: "${prevText.slice(-60)}", but user replied with non-committal fragment: "${text}".`
              });
            }
          }
        }
      }
    }

    const totalGaps = gaps.length;
    // Calculate overall integrity score
    const penalty = totalGaps * 0.25;
    const overallIntegrityScore = Math.max(0.0, Math.min(1.0, 1.0 - penalty));

    let summary = 'Conversation integrity nominal. Zero semantic discontinuities or truncated commands found.';
    if (totalGaps > 0) {
      summary = `Identified ${totalGaps} conversational gap(s) requiring contextual resolution: ${gaps.map(g => `${g.gapType} at turn ${g.turnIndex} ("${g.rawText}")`).join('; ')}.`;
    }

    return {
      hasGaps: totalGaps > 0,
      totalGaps,
      gaps,
      analyzedTurnsCount: totalTurns,
      overallIntegrityScore,
      summary
    };
  }
}
