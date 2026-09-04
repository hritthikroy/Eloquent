/**
 * Eloquent Neural-Mesh Memory Bank Architecture
 * 
 * Provides cross-agent associative knowledge retention, deep research archiving,
 * multi-turn episodic continuity, and salience-weighted memory synchronization
 * across Andrew, Jenny, Tuk Tuk, and Brian.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const SALIENCE_WEIGHTS = {
  relevance: 0.5,
  recency: 0.3,
  depth: 0.2,
  decayLambda: 0.00005 // Half-life decay factor per second
};

/**
 * Calculate dynamic salience score for a knowledge or research node.
 * S = w_r * relevance + w_t * e^(-lambda * dt) + w_d * depthWeight
 */
function calculateSalience(node, now = Date.now()) {
  const ageSeconds = Math.max(0, (now - (node.timestamp || now)) / 1000);
  const recencyFactor = Math.exp(-SALIENCE_WEIGHTS.decayLambda * ageSeconds);
  const depthFactor = Math.min(1.0, (node.depth || 1) / 3.0);
  const relevance = typeof node.relevance === 'number' ? Math.max(0, Math.min(1, node.relevance)) : 0.8;

  const score = (
    SALIENCE_WEIGHTS.relevance * relevance +
    SALIENCE_WEIGHTS.recency * recencyFactor +
    SALIENCE_WEIGHTS.depth * depthFactor
  );

  return Math.round(score * 1000) / 1000;
}

class NeuralMeshMemoryBank extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string} [options.storagePath]
   * @param {number} [options.maxVaultItems=500]
   */
  constructor(options = {}) {
    super();
    this.storagePath = options.storagePath || this._resolveDefaultStoragePath();
    this.maxVaultItems = options.maxVaultItems || 500;

    // Four core banks
    this.workingMemory = new Map(); // In-flight topics & active dialogue scratchpads
    this.episodicBank = [];        // Multi-turn interaction history with user
    this.researchVault = new Map(); // Deep research outputs & web scrape archives
    this.meshIndex = new Map();     // Cross-agent associative knowledge graph

    this.squadAgents = ['agent_andrew', 'agent_jenny', 'agent_tuk_tuk', 'agent_brian'];
    this.telemetry = {
      totalIngestions: 0,
      totalQueries: 0,
      crossAgentBroadcasts: 0,
      lastSyncTimestamp: 0
    };

    // Initialize squad mesh anchors
    for (const agent of this.squadAgents) {
      this.meshIndex.set(agent, new Set());
    }

    this.loadFromDisk();
  }

  _resolveDefaultStoragePath() {
    return path.resolve(process.cwd(), 'userData/agent-brain-memory.json');
  }

  /**
   * Ingest a structured deep research report into the research vault and neural mesh.
   * 
   * @param {Object} report - Deep research report from Go scraper or agent synthesis
   * @param {string} [originAgent='agent_andrew']
   * @returns {Object} node - Ingested research node
   */
  ingestResearch(report, originAgent = 'agent_andrew') {
    if (!report || typeof report !== 'object') {
      throw new Error('Research report must be a non-null object');
    }

    const nodeId = report.jobId || `res_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = Date.now();

    const node = {
      id: nodeId,
      query: report.query || 'Deep Research Task',
      rootUrl: report.rootUrl || '',
      pagesCrawled: report.pagesCrawled || (report.results ? report.results.length : 0),
      totalBytes: report.totalBytes || 0,
      durationMs: report.durationMs || 0,
      results: Array.isArray(report.results) ? report.results.slice(0, 50) : [],
      keyInsights: Array.isArray(report.keyInsights) ? report.keyInsights : [],
      originAgent,
      timestamp: now,
      relevance: 0.95,
      depth: 2,
      salience: 0.95,
      sharedWith: [...this.squadAgents]
    };

    node.salience = calculateSalience(node, now);

    // Store in Vault
    this.researchVault.set(nodeId, node);
    this.telemetry.totalIngestions++;

    // Associate in neural mesh for each squad member
    for (const agent of this.squadAgents) {
      if (!this.meshIndex.has(agent)) {
        this.meshIndex.set(agent, new Set());
      }
      this.meshIndex.get(agent).add(nodeId);
    }
    this.telemetry.crossAgentBroadcasts++;

    // Prune low salience items if limit exceeded
    this._pruneVaultIfNeeded();

    this.emit('memory:research-ingested', { nodeId, query: node.query, originAgent, salience: node.salience });
    return node;
  }

  /**
   * Append an episodic conversational event.
   */
  addEpisode(speaker, text, metadata = {}) {
    const episode = {
      id: `ep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      speaker,
      text,
      metadata,
      timestamp: Date.now()
    };
    this.episodicBank.push(episode);
    if (this.episodicBank.length > 200) {
      this.episodicBank.shift();
    }
    return episode;
  }

  /**
   * Query the neural mesh and research vault across squad members.
   * 
   * @param {string} searchPrompt
   * @param {Object} [options]
   * @param {string} [options.agentId]
   * @param {number} [options.limit=5]
   * @returns {Array<Object>} rankedResults
   */
  query(searchPrompt, options = {}) {
    this.telemetry.totalQueries++;
    if (!searchPrompt || typeof searchPrompt !== 'string') return [];

    const terms = searchPrompt.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const limit = options.limit || 5;
    const now = Date.now();
    const matches = [];

    for (const [id, node] of this.researchVault.entries()) {
      let score = 0;
      const haystack = (
        (node.query || '') + ' ' +
        (node.keyInsights || []).join(' ') + ' ' +
        (node.results || []).map(r => (r.title || '') + ' ' + (r.snippet || '')).join(' ')
      ).toLowerCase();

      for (const term of terms) {
        if (haystack.includes(term)) {
          score += 1.0;
        }
      }

      if (score > 0 || terms.length === 0) {
        const salience = calculateSalience(node, now);
        matches.push({
          node,
          matchScore: score,
          compositeScore: score * 0.6 + salience * 0.4
        });
      }
    }

    matches.sort((a, b) => b.compositeScore - a.compositeScore);
    return matches.slice(0, limit).map(m => m.node);
  }

  /**
   * Retrieve memory snapshot associated with a specific agent.
   */
  getAgentMemory(agentId) {
    const normalizedAgent = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
    const linkedNodeIds = this.meshIndex.get(normalizedAgent) || new Set();
    const vaultEntries = [];

    for (const id of linkedNodeIds) {
      if (this.researchVault.has(id)) {
        vaultEntries.push(this.researchVault.get(id));
      }
    }

    return {
      agentId: normalizedAgent,
      linkedResearchCount: vaultEntries.length,
      recentResearch: vaultEntries.slice(-5),
      recentEpisodes: this.episodicBank.slice(-5),
      activeWorkingTopic: this.workingMemory.get(normalizedAgent) || null
    };
  }

  /**
   * Synchronize active memory state to persistent disk storage.
   */
  sync() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const serialized = {
        version: '2.1.0',
        lastUpdated: Date.now(),
        vaultCount: this.researchVault.size,
        vault: Array.from(this.researchVault.values()).slice(-100),
        episodicCount: this.episodicBank.length,
        episodes: this.episodicBank.slice(-50),
        telemetry: this.telemetry
      };

      const tmp = `${this.storagePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(serialized, null, 2), 'utf8');
      fs.renameSync(tmp, this.storagePath);

      this.telemetry.lastSyncTimestamp = Date.now();
      return { success: true, timestamp: this.telemetry.lastSyncTimestamp };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Load existing persistent state from disk if present.
   */
  loadFromDisk() {
    if (!fs.existsSync(this.storagePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      if (Array.isArray(data.vault)) {
        for (const item of data.vault) {
          if (item && item.id) {
            this.researchVault.set(item.id, item);
            for (const agent of this.squadAgents) {
              if (this.meshIndex.has(agent)) {
                this.meshIndex.get(agent).add(item.id);
              }
            }
          }
        }
      }
      if (Array.isArray(data.episodes)) {
        this.episodicBank = data.episodes;
      }
    } catch (_) {}
  }

  _pruneVaultIfNeeded() {
    if (this.researchVault.size <= this.maxVaultItems) return;

    const entries = Array.from(this.researchVault.values());
    const now = Date.now();
    entries.sort((a, b) => calculateSalience(a, now) - calculateSalience(b, now));

    const removeCount = this.researchVault.size - this.maxVaultItems;
    for (let i = 0; i < removeCount; i++) {
      const deadNode = entries[i];
      this.researchVault.delete(deadNode.id);
      for (const set of this.meshIndex.values()) {
        set.delete(deadNode.id);
      }
    }
  }
}

module.exports = {
  NeuralMeshMemoryBank,
  calculateSalience,
  SALIENCE_WEIGHTS
};
