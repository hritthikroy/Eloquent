/**
 * src/main/api/audioBridge.js
 * 
 * Go Audio Backend Interface API Bridge
 * Provides IPC and direct messaging bridge to the Go audio subsystem with extended
 * response metadata including optional confidenceScore and repetitionPenalty metrics.
 */

const { SharedMemoryAudioBridge } = require('../ipc/audioBridge');

/**
 * Format audio response metadata payload for frontend consumption.
 * Adheres strictly to backward-compatible JSON schema while extending optional fields.
 * 
 * @param {Object} rawMetadata 
 * @returns {Object} Structured audio metadata object
 */
function formatAudioResponseMetadata(rawMetadata = {}) {
  return {
    frameId: rawMetadata.frameId || 0,
    timestamp: rawMetadata.timestamp || Date.now(),
    sampleRate: rawMetadata.sampleRate || 16000,
    channels: rawMetadata.channels || 1,
    durationMs: rawMetadata.durationMs || 0,
    // Optional extended metrics for frontend dynamic temperature & re-prompt adjustment
    confidenceScore: rawMetadata.confidenceScore !== undefined ? Number(rawMetadata.confidenceScore) : 0.98,
    repetitionPenalty: rawMetadata.repetitionPenalty !== undefined ? Number(rawMetadata.repetitionPenalty) : 0.0,
    rawText: rawMetadata.rawText || ''
  };
}

class AudioBridgeAPI {
  constructor(options = {}) {
    this.shmBridge = new SharedMemoryAudioBridge(options);
  }

  init() {
    return this.shmBridge.init();
  }

  /**
   * Process raw audio payload and return formatted metadata.
   * @param {Buffer|Uint8Array} pcmBuffer 
   * @param {Object} [options={}] 
   * @returns {Object}
   */
  processAudioStream(pcmBuffer, options = {}) {
    if (!pcmBuffer) {
      return formatAudioResponseMetadata({
        confidenceScore: 0.0,
        repetitionPenalty: 0.0
      });
    }

    const frameId = options.frameId || Date.now();
    const result = this.shmBridge.writeFrame({
      frameId,
      audioData: pcmBuffer,
      sampleRate: options.sampleRate || 16000,
      channels: options.channels || 1
    });

    return formatAudioResponseMetadata({
      frameId,
      timestamp: Date.now(),
      sampleRate: options.sampleRate || 16000,
      channels: options.channels || 1,
      durationMs: Math.round((pcmBuffer.length / (16000 * 2)) * 1000),
      confidenceScore: options.confidenceScore !== undefined ? options.confidenceScore : (result.success ? 0.98 : 0.50),
      repetitionPenalty: options.repetitionPenalty !== undefined ? options.repetitionPenalty : 0.0,
      rawText: options.rawText || ''
    });
  }

  close() {
    return this.shmBridge.close();
  }
}

module.exports = {
  formatAudioResponseMetadata,
  AudioBridgeAPI
};
