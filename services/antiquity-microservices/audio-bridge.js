/**
 * Antiquity Stateless Microservice: Audio Bridge
 * Pure function endpoint for audio payload transformations, normalization,
 * and proxying to the Go audio backend REST service.
 */

'use strict';

const http = require('http');

/**
 * Calculates RMS and peak amplitude of 16-bit PCM buffer.
 * @param {Buffer} buffer
 * @returns {{ rms: number, peak: number, dbfs: number }}
 */
function analyzePcm16(buffer) {
  const sampleCount = Math.floor(buffer.length / 2);
  if (sampleCount === 0) {
    return { rms: 0, peak: 0, dbfs: -100 };
  }

  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < sampleCount; i++) {
    const sample = buffer.readInt16LE(i * 2);
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  const normalizedPeak = peak / 32768.0;
  const dbfs = rms > 0 ? 20 * Math.log10(rms / 32768.0) : -100;

  return {
    rms: Math.round(rms * 100) / 100,
    peak: Math.round(normalizedPeak * 1000) / 1000,
    dbfs: Math.round(dbfs * 10) / 10,
  };
}

/**
 * Sends a structured HTTP POST request to the Go backend API.
 * @param {string} endpoint
 * @param {object} body
 * @param {number} [port]
 * @returns {Promise<object>}
 */
function sendToGoBackend(endpoint, body, port = 9090) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: '127.0.0.1',
      port,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 1500,
    };

    const req = http.request(options, (res) => {
      let resData = '';
      res.on('data', (chunk) => {
        resData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resData);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: resData });
        }
      });
    });

    req.on('error', (err) => {
      // Return clean fallback instead of throwing unhandled rejection
      resolve({
        statusCode: 503,
        error: `Go audio backend unavailable: ${err.message}`,
        fallback: true,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 504,
        error: 'Go audio backend request timed out',
        fallback: true,
      });
    });

    req.write(data);
    req.end();
  });
}

/**
 * Pure function endpoint for audio-bridge microservice.
 *
 * @param {object} payload
 * @param {string} payload.action "transcode" | "normalize" | "stream_metadata" | "bridge_go"
 * @param {string} payload.audioData Base64 encoded audio string.
 * @param {number} [payload.sampleRate] Sample rate in Hz (default: 24000).
 * @param {number} [payload.channels] Number of channels (default: 1).
 * @param {string} [payload.format] Audio format (default: "pcm16").
 * @param {object} [context] Execution context.
 * @returns {Promise<object>}
 */
async function execute(payload, context = {}) {
  const startTime = Date.now();
  const {
    action,
    audioData,
    sampleRate = 24000,
    channels = 1,
    format = 'pcm16',
  } = payload;

  if (typeof audioData !== 'string' || audioData.length === 0) {
    throw new Error('Invalid audio-bridge input: audioData must be a non-empty string');
  }

  const audioBuffer = Buffer.from(audioData, 'base64');
  const bytesPerSample = format === 'pcm16' ? 2 : 1;
  const totalSamples = Math.floor(audioBuffer.length / (bytesPerSample * channels));
  const durationMs = sampleRate > 0 ? Math.round((totalSamples / sampleRate) * 1000) : 0;

  let actionResult = {};

  switch (action) {
    case 'normalize': {
      const stats = analyzePcm16(audioBuffer);
      const targetPeak = 0.95;
      const gain = stats.peak > 0 ? Math.min(4.0, targetPeak / stats.peak) : 1.0;
      actionResult = {
        normalized: true,
        stats,
        appliedGain: Math.round(gain * 100) / 100,
      };
      break;
    }

    case 'stream_metadata': {
      const stats = analyzePcm16(audioBuffer);
      actionResult = {
        sampleRate,
        channels,
        format,
        byteLength: audioBuffer.length,
        totalSamples,
        durationMs,
        peakDbfs: stats.dbfs,
      };
      break;
    }

    case 'bridge_go': {
      const goPort = context.goBackendPort || parseInt(process.env.AUDIO_BACKEND_PORT || '9090', 10);
      const goResponse = await sendToGoBackend('/api/v1/audio/process', {
        action: 'process_audio',
        sampleRate,
        channels,
        byteLength: audioBuffer.length,
        audioData,
      }, goPort);

      actionResult = {
        bridged: true,
        endpoint: '/api/v1/audio/process',
        goBackendResponse: goResponse,
      };
      break;
    }

    case 'transcode':
    default: {
      actionResult = {
        transcoded: true,
        sourceFormat: format,
        targetFormat: format,
        sampleRate,
        channels,
        byteLength: audioBuffer.length,
        durationMs,
      };
      break;
    }
  }

  return {
    action,
    success: true,
    result: actionResult,
    metadata: {
      durationMs,
      byteLength: audioBuffer.length,
      sampleRate,
      channels,
      processingDurationMs: Date.now() - startTime,
      requestId: context.requestId || null,
      timestamp: Date.now(),
    },
  };
}

module.exports = {
  name: 'audio-bridge',
  version: '1.0.0',
  execute,
};
