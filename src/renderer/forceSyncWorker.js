/**
 * Dedicated ForceSync WebWorker Script
 * 
 * Offloads clock synchronization, drift telemetry calculation, and backend RPC
 * calls from the main renderer thread, guaranteeing execution completes without
 * starving the 16 ms (60 FPS) visual frame budget.
 * 
 * Constraints:
 * - Free of top-level await; relies strictly on explicit message handlers.
 * - No global variable pollution; strict scoping.
 * - ES6 module exports with CommonJS interoperability.
 */

import { FORCE_SYNC_REQUEST, FORCE_SYNC_RESPONSE } from '../main/ipcChannels.js';

/**
 * Computes presentation timestamp and clock drift alignment
 * @param {Object} payload - Sync request parameters
 * @returns {Object} Computed drift metrics
 */
export function computeDriftMetrics(payload = {}) {
  const now = Date.now();
  const clientTimeNs = (payload.timestamp || now) * 1e6;
  const audioSampleRate = payload.sampleRate || 48000;
  const totalAudioSamples = payload.totalAudioSamples || 0;
  const totalVisualFrames = payload.totalVisualFrames || 0;
  const targetFps = payload.targetFps || 60.0;

  // Expected elapsed times
  const audioElapsedNs = audioSampleRate > 0
    ? (totalAudioSamples / audioSampleRate) * 1e9
    : 0;
  const visualElapsedNs = targetFps > 0
    ? (totalVisualFrames / targetFps) * 1e9
    : 0;

  const clockDriftUs = Math.round((audioElapsedNs - visualElapsedNs) / 1000);
  const absDrift = Math.abs(clockDriftUs);

  let state = 'in-sync';
  if (absDrift > 50000) {
    state = 'recalibrating';
  } else if (clockDriftUs > 10000) {
    state = 'lead';
  } else if (clockDriftUs < -10000) {
    state = 'lag';
  }

  return {
    clockDriftUs,
    audioPresentationTimeNs: clientTimeNs + Math.round(audioElapsedNs),
    visualTimestampNs: clientTimeNs + Math.round(visualElapsedNs),
    driftCorrections: payload.driftCorrections ? payload.driftCorrections + 1 : 1,
    state,
    sampleOffsetCorrection: Math.round((clockDriftUs / 1e6) * audioSampleRate),
    averageJitterUs: Math.round(absDrift * 0.12),
    synchronizedAt: now,
  };
}

/**
 * Dispatches sync execution to Go backend if available, or returns local computation
 * @param {Object} payload - Sync payload with optional backendUrl
 * @returns {Promise<Object>} Final synchronization result
 */
export async function executeForceSync(payload = {}) {
  const startTime = Date.now();
  const localMetrics = computeDriftMetrics(payload);

  if (payload.backendUrl && typeof fetch === 'function') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), payload.timeoutMs || 2000);

      const response = await fetch(`${payload.backendUrl}/api/sync/force`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientTimestampNs: Date.now() * 1e6,
          sampleRate: payload.sampleRate || 48000,
          metrics: localMetrics,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const remoteData = await response.json();
        return {
          driftMetrics: remoteData.metrics || localMetrics,
          remoteDelivered: true,
          durationMs: Date.now() - startTime,
        };
      }
    } catch (_) {
      // Non-fatal; fallback to local compute
    }
  }

  return {
    driftMetrics: localMetrics,
    remoteDelivered: false,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Message handler processing incoming FORCE_SYNC_REQUEST from main thread
 * @param {MessageEvent|Object} event - Incoming message event
 * @param {Function} [postReply] - Optional override for postMessage (used in tests)
 */
export async function handleWorkerMessage(event, postReply) {
  const data = event && event.data ? event.data : event;
  if (!data) return;

  if (data.type === FORCE_SYNC_REQUEST) {
    const { id, payload } = data;
    const postFn = typeof postReply === 'function'
      ? postReply
      : (typeof postMessage === 'function' ? postMessage : null);

    if (!postFn) return;

    try {
      const result = await executeForceSync(payload);
      postFn({
        type: FORCE_SYNC_RESPONSE,
        id,
        success: true,
        driftMetrics: result.driftMetrics,
        durationMs: result.durationMs,
        remoteDelivered: result.remoteDelivered,
        timestamp: Date.now(),
      });
    } catch (err) {
      postFn({
        type: FORCE_SYNC_RESPONSE,
        id,
        success: false,
        error: err.message || 'Worker sync calculation failure',
        durationMs: 0,
        timestamp: Date.now(),
      });
    }
  }
}

// Bind WebWorker listener if running in standard Worker global scope
if (typeof self !== 'undefined') {
  if (typeof self.addEventListener === 'function') {
    self.addEventListener('message', handleWorkerMessage);
  } else if ('onmessage' in self) {
    self.onmessage = handleWorkerMessage;
  }
}

// CommonJS compatibility for Node.js test runners
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeDriftMetrics,
    executeForceSync,
    handleWorkerMessage,
  };
}
