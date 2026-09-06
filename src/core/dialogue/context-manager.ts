/**
 * src/core/dialogue/context-manager.ts
 * 
 * Context Manager & Deduplication Utility
 * Provides deduplicateRecentHistory utility that filters out redundant user-assistant
 * pairs from the recent 5 turns to prevent model anchoring on repetitive patterns.
 */

export interface DialogueTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export class DialogueContextManager {
  /**
   * Computes term frequency vector for a text string.
   */
  private static getTermFrequency(text: string): Record<string, number> {
    if (!text || typeof text !== 'string') return {};
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u0980-\u09FF]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    const freq: Record<string, number> = {};
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
    return freq;
  }

  /**
   * Calculates cosine similarity between two term frequency vectors.
   */
  private static calculateCosineSimilarity(
    vecA: Record<string, number>,
    vecB: Record<string, number>
  ): number {
    const keysA = Object.keys(vecA);
    const keysB = Object.keys(vecB);
    if (keysA.length === 0 || keysB.length === 0) return 0;

    const uniqueTerms = new Set([...keysA, ...keysB]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const term of uniqueTerms) {
      const valA = vecA[term] || 0;
      const valB = vecB[term] || 0;
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Deduplicates recent history by filtering out redundant user-assistant turn pairs
   * from the last N turns (default windowSize = 5).
   * 
   * @param history - Array of dialogue turns
   * @param windowSize - Recent window size to inspect for duplicates (default: 5)
   * @param similarityThreshold - Cosine similarity threshold for filtering (default: 0.80)
   * @returns Deduplicated history array
   */
  public static deduplicateRecentHistory(
    history: DialogueTurn[],
    windowSize: number = 5,
    similarityThreshold: number = 0.80
  ): DialogueTurn[] {
    if (!Array.isArray(history) || history.length === 0) return [];

    // Separate history into older history and recent window
    const splitIndex = Math.max(0, history.length - windowSize * 2);
    const olderHistory = history.slice(0, splitIndex);
    const recentWindow = history.slice(splitIndex);

    const filteredRecent: DialogueTurn[] = [];
    const seenUserVectors: Record<string, number>[] = [];
    const seenAssistantVectors: Record<string, number>[] = [];

    for (const turn of recentWindow) {
      if (!turn || typeof turn.content !== 'string') continue;

      const vec = this.getTermFrequency(turn.content);
      let isDuplicate = false;

      const targetVectors = turn.role === 'user' ? seenUserVectors : seenAssistantVectors;

      for (const pastVec of targetVectors) {
        const sim = this.calculateCosineSimilarity(vec, pastVec);
        if (sim >= similarityThreshold) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        targetVectors.push(vec);
        filteredRecent.push(turn);
      } else {
        console.warn(
          `[DialogueContextManager] Suppressed redundant ${turn.role} turn in recent window: "${turn.content.slice(0, 40)}..."`
        );
      }
    }

    return [...olderHistory, ...filteredRecent];
  }
}
