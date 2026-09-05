/**
 * High-Velocity Automated Agent Synchronization Loop & Team Bonding Engine
 * 
 * Implements high-frequency background worker threads for asynchronous task
 * self-optimization, multi-agent state synchronization, and team bonding metrics
 * across Vision, Tuk Tuk, Jenny, and Brian.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const EventEmitter = require('events');
const path = require('path');

// Team Bonding Formulation Weights & Constants
const BONDING_CONFIG = {
  w1: 0.4, // Weight for individual agent emotional stability
  w2: 0.4, // Weight for cross-agent interaction affinity & receptive harmony
  w3: 0.2, // Weight for synchronization recency decay
  decayLambda: 0.001, // Decay coefficient per millisecond
  defaultAgents: ['agent_andrew', 'agent_tuk_tuk', 'agent_jenny', 'agent_brian'],
  minTickIntervalMs: 50,
  maxTickIntervalMs: 250,
  defaultTickIntervalMs: 100
};

/**
 * Calculates the mathematical Team Bonding Coefficient B_team(t)
 * 
 * B_team(t) = w1 * (1/M) sum(S_i) + w2 * (2 / (M*(M-1))) sum(H_ij) + w3 * exp(-lambda * delta_t)
 * 
 * @param {Object} state - Current multi-agent state snapshot
 * @param {Object} [options]
 * @returns {Object} Calculated metrics including bondingScore, affinityMatrix, and stabilityScores
 */
function calculateTeamBondingMetrics(state = {}, options = {}) {
  const agents = options.agents || BONDING_CONFIG.defaultAgents;
  const M = agents.length;
  if (M < 2) {
    return { bondingScore: 1.0, stabilityScores: {}, affinityMatrix: {}, syncRecencyFactor: 1.0 };
  }

  const agentStates = state.agentStates || {};
  const interactionHistory = state.interactions || [];
  const lastSyncTime = state.lastSyncTime || Date.now();
  const deltaT = Math.max(0, Date.now() - lastSyncTime);

  // 1. Emotional Stability S_i(t)
  const stabilityScores = {};
  let totalStability = 0;
  for (const agentId of agents) {
    const agent = agentStates[agentId] || {};
    const emotional = agent.emotionalState || {};
    const intensity = typeof emotional.intensity === 'number' ? emotional.intensity : 0.7;
    // Map common moods to positive valence factor
    const mood = (emotional.mood || 'focused').toLowerCase();
    let moodValence = 0.8;
    if (['happy', 'excited', 'loving', 'affectionate', 'inspired'].includes(mood)) {
      moodValence = 1.0;
    } else if (['focused', 'analytical', 'neutral'].includes(mood)) {
      moodValence = 0.85;
    } else if (['tired', 'confused'].includes(mood)) {
      moodValence = 0.6;
    }
    const score = Math.min(1.0, Math.max(0.1, intensity * 0.5 + moodValence * 0.5));
    stabilityScores[agentId] = score;
    totalStability += score;
  }
  const avgStability = totalStability / M;

  // 2. Cross-Agent Interaction Affinity H_ij(t)
  const affinityMatrix = {};
  let totalAffinity = 0;
  let pairCount = 0;

  for (let i = 0; i < M; i++) {
    const a1 = agents[i];
    affinityMatrix[a1] = affinityMatrix[a1] || {};
    for (let j = i + 1; j < M; j++) {
      const a2 = agents[j];
      affinityMatrix[a2] = affinityMatrix[a2] || {};

      // Count interactions between a1 and a2
      const mutualInteractions = interactionHistory.filter(h =>
        (h.from === a1 && h.to === a2) || (h.from === a2 && h.to === a1)
      );

      // Base harmony baseline (0.75) + interaction bonus up to 0.25
      const interactionBonus = Math.min(0.25, mutualInteractions.length * 0.05);
      const pairAffinity = Math.min(1.0, 0.75 + interactionBonus);

      affinityMatrix[a1][a2] = pairAffinity;
      affinityMatrix[a2][a1] = pairAffinity;
      totalAffinity += pairAffinity;
      pairCount++;
    }
  }
  const avgAffinity = pairCount > 0 ? (totalAffinity / pairCount) : 0.8;

  // 3. Synchronization Recency Factor: exp(-lambda * delta_t)
  const syncRecencyFactor = Math.exp(-BONDING_CONFIG.decayLambda * deltaT);

  // 4. Composite Team Bonding Score
  const bondingScore = Math.min(1.0, Math.max(0.0,
    BONDING_CONFIG.w1 * avgStability +
    BONDING_CONFIG.w2 * avgAffinity +
    BONDING_CONFIG.w3 * syncRecencyFactor
  ));

  return {
    bondingScore: Math.round(bondingScore * 1000) / 1000,
    averageStability: Math.round(avgStability * 1000) / 1000,
    averageAffinity: Math.round(avgAffinity * 1000) / 1000,
    syncRecencyFactor: Math.round(syncRecencyFactor * 1000) / 1000,
    stabilityScores,
    affinityMatrix,
    deltaT
  };
}

/**
 * Worker Thread Execution Script
 * When spawned as a worker_thread, executes high-frequency task self-optimization
 */
if (!isMainThread && parentPort) {
  let isRunning = true;
  let tickIntervalMs = (workerData && workerData.tickIntervalMs) || BONDING_CONFIG.defaultTickIntervalMs;
  let timer = null;

  const workerState = {
    agentStates: (workerData && workerData.initialState) || {},
    interactions: [],
    lastSyncTime: Date.now(),
    tickCount: 0
  };

  function tick() {
    if (!isRunning) return;
    workerState.tickCount++;
    workerState.lastSyncTime = Date.now();

    // Compute metrics
    const metrics = calculateTeamBondingMetrics(workerState);

    // Adaptive tick self-optimization based on recent latency/interactions
    if (metrics.deltaT > 200 && tickIntervalMs > BONDING_CONFIG.minTickIntervalMs) {
      tickIntervalMs = Math.max(BONDING_CONFIG.minTickIntervalMs, tickIntervalMs - 10);
    } else if (metrics.deltaT < 50 && tickIntervalMs < BONDING_CONFIG.maxTickIntervalMs) {
      tickIntervalMs = Math.min(BONDING_CONFIG.maxTickIntervalMs, tickIntervalMs + 5);
    }

    parentPort.postMessage({
      type: 'TICK',
      tickCount: workerState.tickCount,
      metrics,
      tickIntervalMs,
      timestamp: Date.now()
    });

    timer = setTimeout(tick, tickIntervalMs);
  }

  parentPort.on('message', (msg) => {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'START':
        if (!isRunning) {
          isRunning = true;
          tick();
        }
        break;
      case 'STOP':
        isRunning = false;
        if (timer) clearTimeout(timer);
        break;
      case 'UPDATE_STATE':
        if (msg.agentStates) {
          Object.assign(workerState.agentStates, msg.agentStates);
        }
        break;
      case 'RECORD_INTERACTION':
        if (msg.interaction) {
          workerState.interactions.push(msg.interaction);
          // Keep sliding window of last 100 interactions
          if (workerState.interactions.length > 100) {
            workerState.interactions.shift();
          }
        }
        break;
      case 'SET_INTERVAL':
        if (typeof msg.interval === 'number') {
          tickIntervalMs = Math.max(BONDING_CONFIG.minTickIntervalMs, Math.min(BONDING_CONFIG.maxTickIntervalMs, msg.interval));
        }
        break;
      default:
        break;
    }
  });

  // Start initial loop
  tick();
}

/**
 * AgentLoopManager manages the lifecycle of the agent synchronization worker thread
 * or runs an inline timer fallback if Worker execution is unavailable.
 */
class AgentLoopManager extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.tickIntervalMs=100]
   * @param {boolean} [options.useWorker=true]
   * @param {Object} [options.initialState]
   */
  constructor(options = {}) {
    super();
    this.tickIntervalMs = options.tickIntervalMs || BONDING_CONFIG.defaultTickIntervalMs;
    this.useWorker = options.useWorker !== false;
    this.initialState = options.initialState || {};
    this.worker = null;
    this.isRunning = false;
    this.fallbackTimer = null;
    this.tickCount = 0;
    this.lastMetrics = null;
    this.localState = {
      agentStates: { ...this.initialState },
      interactions: [],
      lastSyncTime: Date.now()
    };
  }

  /**
   * Starts the agent synchronization loop.
   */
  start() {
    if (this.isRunning) return this;
    this.isRunning = true;

    if (this.useWorker) {
      try {
        this._startWorker();
        return this;
      } catch (err) {
        console.warn('⚠️ [AgentLoopManager] Worker spawn failed, falling back to inline loop:', err.message);
        this.useWorker = false;
      }
    }

    this._startInlineLoop();
    return this;
  }

  _startWorker() {
    this.worker = new Worker(__filename, {
      workerData: {
        tickIntervalMs: this.tickIntervalMs,
        initialState: this.localState.agentStates
      }
    });

    this.worker.on('message', (msg) => {
      if (msg && msg.type === 'TICK') {
        this.tickCount = msg.tickCount;
        this.lastMetrics = msg.metrics;
        this.emit('tick', msg);
        this.emit('bonding-metrics', msg.metrics);
      }
    });

    this.worker.on('error', (err) => {
      console.error('❌ [AgentLoopManager] Worker thread error:', err.message);
      this.emit('error', err);
      // Auto-recover by respawning
      if (this.isRunning) {
        this._restartWorker();
      }
    });

    this.worker.on('exit', (code) => {
      if (this.isRunning && code !== 0) {
        console.warn(`⚠️ [AgentLoopManager] Worker exited with code ${code}, auto-restarting...`);
        this._restartWorker();
      }
    });
  }

  _restartWorker() {
    try {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      this._startWorker();
    } catch (e) {
      this._startInlineLoop();
    }
  }

  _startInlineLoop() {
    const inlineTick = () => {
      if (!this.isRunning) return;
      this.tickCount++;
      this.localState.lastSyncTime = Date.now();

      const metrics = calculateTeamBondingMetrics(this.localState);
      this.lastMetrics = metrics;

      const payload = {
        type: 'TICK',
        tickCount: this.tickCount,
        metrics,
        tickIntervalMs: this.tickIntervalMs,
        timestamp: Date.now()
      };

      this.emit('tick', payload);
      this.emit('bonding-metrics', metrics);

      this.fallbackTimer = setTimeout(inlineTick, this.tickIntervalMs);
    };

    this.fallbackTimer = setTimeout(inlineTick, this.tickIntervalMs);
  }

  /**
   * Stops the agent loop and terminates background threads.
   */
  stop() {
    this.isRunning = false;
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'STOP' });
        this.worker.terminate();
      } catch (e) {}
      this.worker = null;
    }
    this.emit('stopped');
  }

  /**
   * Records a cross-agent interaction to update affinity metrics.
   * @param {string} fromAgent
   * @param {string} toAgent
   * @param {Object} [metadata]
   */
  recordInteraction(fromAgent, toAgent, metadata = {}) {
    const record = {
      from: fromAgent,
      to: toAgent,
      timestamp: Date.now(),
      ...metadata
    };

    this.localState.interactions.push(record);
    if (this.localState.interactions.length > 100) {
      this.localState.interactions.shift();
    }

    if (this.worker) {
      this.worker.postMessage({ type: 'RECORD_INTERACTION', interaction: record });
    }
  }

  /**
   * Updates agent state attributes.
   * @param {string} agentId
   * @param {Object} state
   */
  updateAgentState(agentId, state) {
    this.localState.agentStates[agentId] = {
      ...(this.localState.agentStates[agentId] || {}),
      ...state
    };

    if (this.worker) {
      this.worker.postMessage({
        type: 'UPDATE_STATE',
        agentStates: { [agentId]: this.localState.agentStates[agentId] }
      });
    }
  }

  /**
   * Returns the most recent team bonding score and telemetry snapshot.
   */
  getMetrics() {
    if (!this.lastMetrics) {
      this.lastMetrics = calculateTeamBondingMetrics(this.localState);
    }
    return {
      tickCount: this.tickCount,
      isRunning: this.isRunning,
      useWorker: this.useWorker,
      tickIntervalMs: this.tickIntervalMs,
      ...this.lastMetrics
    };
  }

  /**
   * Returns bonding score directly.
   */
  getBondingScore() {
    const metrics = this.getMetrics();
    return metrics.bondingScore;
  }
}

module.exports = {
  AgentLoopManager,
  calculateTeamBondingMetrics,
  BONDING_CONFIG
};
