/**
 * src/core/dialogue/response-validator.ts
 * 
 * Response Validator & Loop Detection Engine
 * Evaluates candidate AI responses using Levenshtein distance ratios and cosine similarity
 * against past assistant turns. Triggers forced context resets or tone shifts when loops are detected.
 */

import { DialogueTurn } from './context-manager';

export interface LoopDetectionResult {
  isLooping: boolean;
  similarityScore: number;
  recommendedAction: 'none' | 'shift_tone' | 'force_reset';
  triggerTurnIndex?: number;
  matchedContent?: string;
}

export class ResponseValidator {
  /**
   * Calculates Levenshtein Distance between two strings.
   */
  public static calculateLevenshteinDistance(a: string, b: string): number {
    if (!a) return b ? b.length : 0;
    if (!b) return a.length;

    const strA = a.toLowerCase();
    const strB = b.toLowerCase();

    const matrix: number[][] = [];

    for (let i = 0; i <= strB.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= strA.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= strB.length; i++) {
      for (let j = 1; j <= strA.length; j++) {
        if (strB.charAt(i - 1) === strA.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1,   // insertion
              matrix[i - 1][j] + 1    // deletion
            )
          );
        }
      }
    }

    return matrix[strB.length][strA.length];
  }

  /**
   * Calculates Normalized Levenshtein Similarity Ratio (0.0 to 1.0).
   */
  public static calculateLevenshteinSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const distance = this.calculateLevenshteinDistance(a, b);
    return 1.0 - distance / maxLen;
  }

  /**
   * Evaluates candidate response against recent assistant history turns to detect high-similarity loops.
   * 
   * @param candidate - New candidate AI response string
   * @param history - Conversation history turns
   * @param threshold - Similarity threshold for loop detection (default: 0.70)
   * @returns LoopDetectionResult
   */
  public static checkForLooping(
    candidate: string,
    history: DialogueTurn[],
    threshold: number = 0.70
  ): LoopDetectionResult {
    if (!candidate || typeof candidate !== 'string' || !Array.isArray(history) || history.length === 0) {
      return { isLooping: false, similarityScore: 0, recommendedAction: 'none' };
    }

    const assistantTurns = history.filter((turn) => turn.role === 'assistant' && turn.content);
    if (assistantTurns.length === 0) {
      return { isLooping: false, similarityScore: 0, recommendedAction: 'none' };
    }

    // Inspect recent assistant responses (last 5 turns)
    const recentAssistantTurns = assistantTurns.slice(-5);
    let maxSimilarity = 0;
    let matchedTurnIndex = -1;
    let matchedTurnContent = '';

    for (let i = 0; i < recentAssistantTurns.length; i++) {
      const turn = recentAssistantTurns[i];
      const similarity = this.calculateLevenshteinSimilarity(candidate, turn.content);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedTurnIndex = i;
        matchedTurnContent = turn.content;
      }
    }

    const isLooping = maxSimilarity >= threshold;

    let recommendedAction: 'none' | 'shift_tone' | 'force_reset' = 'none';
    if (isLooping) {
      // If similarity is extremely high (> 0.88), force immediate context reset; otherwise shift tone
      recommendedAction = maxSimilarity >= 0.88 ? 'force_reset' : 'shift_tone';
      console.warn(
        `🚨 [ResponseValidator] Loop detected! Similarity=${(maxSimilarity * 100).toFixed(1)}%, Action=${recommendedAction}`
      );
    }

    return {
      isLooping,
      similarityScore: maxSimilarity,
      recommendedAction,
      triggerTurnIndex: matchedTurnIndex,
      matchedContent: matchedTurnContent
    };
  }
}
