/**
 * src/renderer/utils/contextManager.js
 * 
 * Context Manager & Deduplication Utility
 * Provides intent deduplication via cosine similarity and context-window pruning
 * to prevent repetitive loop patterns and ensure prompt token limits are respected.
 */

/**
 * Tokenizes text into normalized term frequencies.
 * @param {string} text 
 * @returns {Record<string, number>}
 */
function getTermFrequency(text) {
  if (!text || typeof text !== 'string') return {};
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u0980-\u09FF]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  return freq;
}

/**
 * Computes Cosine Similarity between two term frequency vector objects.
 * @param {Record<string, number>} vecA 
 * @param {Record<string, number>} vecB 
 * @returns {number} Similarity score between 0.0 and 1.0
 */
function calculateCosineSimilarity(vecA, vecB) {
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
 * Deduplicates dialogue history by identifying and suppressing near-duplicate user intents
 * using cosine similarity matching.
 * 
 * @param {Array<{role: string, content: string}>} history 
 * @param {number} [threshold=0.85] 
 * @returns {Array<{role: string, content: string}>} Deduplicated history array
 */
function deduplicateContext(history, threshold = 0.85) {
  if (!Array.isArray(history) || history.length === 0) return [];

  const deduplicated = [];
  const seenUserVectors = [];

  for (const turn of history) {
    if (!turn || typeof turn.content !== 'string') continue;

    if (turn.role === 'user') {
      const vec = getTermFrequency(turn.content);
      let isDuplicate = false;

      for (const pastVec of seenUserVectors) {
        const similarity = calculateCosineSimilarity(vec, pastVec);
        if (similarity >= threshold) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seenUserVectors.push(vec);
        deduplicated.push(turn);
      } else {
        console.warn(`[ContextManager] Suppressed near-duplicate user intent (similarity >= ${threshold}): "${turn.content.slice(0, 40)}..."`);
      }
    } else {
      deduplicated.push(turn);
    }
  }

  return deduplicated;
}

/**
 * Estimates token count of a string (approx. 4 characters per token).
 * @param {string} text 
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Prunes conversation history to keep only high-relevance recent turns (5-10 turns)
 * and guarantees total token size remains below maxTokens.
 * 
 * @param {Array<{role: string, content: string}>} history 
 * @param {number} [maxTurns=10] Maximum recent turns to retain
 * @param {number} [maxTokens=4096] Maximum allowable token ceiling
 * @returns {Array<{role: string, content: string}>} Pruned history
 */
function pruneContext(history, maxTurns = 10, maxTokens = 4096) {
  if (!Array.isArray(history) || history.length === 0) return [];

  // 1. Slice to recent maxTurns
  let recentTurns = history.slice(-maxTurns);

  // 2. Compute token budget and prune from oldest turn if exceeding maxTokens
  let currentTokens = recentTurns.reduce((acc, turn) => acc + estimateTokens(turn.content || ''), 0);

  while (recentTurns.length > 2 && currentTokens > maxTokens) {
    const dropped = recentTurns.shift();
    currentTokens -= estimateTokens(dropped.content || '');
  }

  return recentTurns;
}

module.exports = {
  getTermFrequency,
  calculateCosineSimilarity,
  deduplicateContext,
  estimateTokens,
  pruneContext
};
