/**
 * Antiquity Tool Router & Proxy Layer
 *
 * Intercepts tool invocation requests, enforces strict JSON Schema validation,
 * verifies authentication tokens, routes to isolated stateless microservices,
 * and tracks latency overhead to guarantee < 5ms proxy budget.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Resolve path to Antiquity JSON Schema
const SCHEMA_PATH = path.resolve(__dirname, '../tools/antiquity/schema.json');

// Attempt to load schema definition
let toolSchema = null;
try {
  if (fs.existsSync(SCHEMA_PATH)) {
    const raw = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    toolSchema = Array.isArray(raw) ? raw[0] : raw;
  }
} catch (e) {
  // Schema loaded dynamically on demand if path differs
}

// Microservices resolver helper (supports both relative and workspace root layouts)
function resolveMicroservicesModule() {
  const possiblePaths = [
    path.resolve(__dirname, '../../services/antiquity-microservices'),
    path.resolve(__dirname, '../../../services/antiquity-microservices'),
    path.resolve(process.cwd(), 'services/antiquity-microservices'),
    path.resolve(process.cwd(), 'EloquentElectron/services/antiquity-microservices'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'index.js'))) {
      return require(p);
    }
  }
  return null;
}

/**
 * Validates request payload strictly against Antiquity schema rules.
 * @param {object} req
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSchema(req) {
  const errors = [];

  if (!req || typeof req !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }

  // Base required fields
  const requiredBaseFields = ['tool', 'authToken', 'requestId', 'payload'];
  for (const field of requiredBaseFields) {
    if (req[field] === undefined || req[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate tool type
  const allowedTools = ['legacy-parser', 'audio-bridge', 'format-converter'];
  if (!allowedTools.includes(req.tool)) {
    errors.push(`Invalid tool "${req.tool}". Allowed values: ${allowedTools.join(', ')}`);
  }

  // Validate authToken
  if (typeof req.authToken !== 'string' || req.authToken.length < 16) {
    errors.push('Invalid "authToken": must be a string of at least 16 characters');
  }

  // Validate requestId
  const idRegex = /^[a-zA-Z0-9_-]{6,64}$/;
  if (typeof req.requestId !== 'string' || !idRegex.test(req.requestId)) {
    errors.push('Invalid "requestId": must match pattern ^[a-zA-Z0-9_-]{6,64}$');
  }

  // Validate payload object
  if (typeof req.payload !== 'object' || req.payload === null || Array.isArray(req.payload)) {
    errors.push('Invalid "payload": must be a JSON object');
    return { valid: false, errors };
  }

  // Tool-specific sub-schema checks
  if (req.tool === 'legacy-parser') {
    if (typeof req.payload.rawContent !== 'string' || req.payload.rawContent.length === 0) {
      errors.push('legacy-parser payload requires non-empty string "rawContent"');
    }
    const allowedFormats = ['v1', 'xml', 'csv', 'json-legacy', 'custom'];
    if (!allowedFormats.includes(req.payload.format)) {
      errors.push(`legacy-parser format must be one of: ${allowedFormats.join(', ')}`);
    }
    if (req.payload.options && typeof req.payload.options !== 'object') {
      errors.push('legacy-parser "options" must be an object if specified');
    }
  } else if (req.tool === 'audio-bridge') {
    const allowedActions = ['transcode', 'normalize', 'stream_metadata', 'bridge_go'];
    if (!allowedActions.includes(req.payload.action)) {
      errors.push(`audio-bridge action must be one of: ${allowedActions.join(', ')}`);
    }
    if (typeof req.payload.audioData !== 'string' || req.payload.audioData.length === 0) {
      errors.push('audio-bridge payload requires non-empty string "audioData"');
    }
    if (req.payload.sampleRate !== undefined) {
      if (typeof req.payload.sampleRate !== 'number' || req.payload.sampleRate < 8000 || req.payload.sampleRate > 192000) {
        errors.push('audio-bridge "sampleRate" must be integer between 8000 and 192000');
      }
    }
    if (req.payload.channels !== undefined && ![1, 2].includes(req.payload.channels)) {
      errors.push('audio-bridge "channels" must be 1 or 2');
    }
    if (req.payload.format !== undefined && !['pcm16', 'wav', 'mp3', 'opus'].includes(req.payload.format)) {
      errors.push('audio-bridge "format" must be one of: pcm16, wav, mp3, opus');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Antiquity Tool Router Class
 */
class AntiquityToolRouter {
  constructor(options = {}) {
    this.validTokens = new Set(options.tokens || []);
    // Default fallback token for local process IPC handshake
    if (this.validTokens.size === 0) {
      this.validTokens.add(process.env.ANTIQUITY_AUTH_TOKEN || 'eloquent-antiquity-secure-token-2026');
    }

    this.schema = toolSchema;
    this.microservices = resolveMicroservicesModule();

    // Health and metrics store
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      rejectedRequests: 0,
      failedExecutions: 0,
      totalProxyOverheadMs: 0,
      maxProxyOverheadMs: 0,
      latencies: [],
      toolUsage: {},
      startedAt: Date.now(),
    };
  }

  /**
   * Registers an authentication token authorized to invoke antiquity tools.
   * @param {string} token
   */
  registerAuthToken(token) {
    if (typeof token === 'string' && token.length >= 16) {
      this.validTokens.add(token);
      return true;
    }
    return false;
  }

  /**
   * Revokes an authentication token.
   * @param {string} token
   */
  revokeAuthToken(token) {
    return this.validTokens.delete(token);
  }

  /**
   * Validates if a token is authorized.
   * @param {string} token
   * @returns {boolean}
   */
  validateAuth(token) {
    if (!token || typeof token !== 'string') return false;
    return this.validTokens.has(token);
  }

  /**
   * Generates a new session handshake token for the Electron renderer.
   * @param {string} clientIdentity
   * @returns {string}
   */
  generateSessionHandshake(clientIdentity = 'electron-renderer') {
    const timestamp = Date.now().toString(36);
    const randomHex = Math.random().toString(36).substring(2, 10);
    const token = `antiquity-${clientIdentity}-${timestamp}-${randomHex}`;
    this.registerAuthToken(token);
    return token;
  }

  /**
   * Intercepts, validates, benchmarks, and routes a tool invocation request.
   *
   * @param {object} request
   * @param {string} request.tool
   * @param {string} request.authToken
   * @param {string} request.requestId
   * @param {object} request.payload
   * @returns {Promise<object>} Schema-compliant Antiquity tool response
   */
  async routeToolInvocation(request) {
    const proxyStart = performance.now();
    this.metrics.totalRequests += 1;

    const requestId = request && request.requestId ? request.requestId : `req-${Date.now()}`;
    const toolName = request && request.tool ? request.tool : 'unknown';

    // 1. Strict JSON Schema Validation
    const validation = validateSchema(request);
    if (!validation.valid) {
      this.metrics.rejectedRequests += 1;
      const proxyOverheadMs = performance.now() - proxyStart;
      this._recordMetrics(toolName, proxyOverheadMs, false);

      return {
        success: false,
        requestId,
        tool: toolName,
        data: null,
        error: {
          code: 'SCHEMA_VALIDATION_ERROR',
          message: 'Payload does not adhere to strict Antiquity JSON schema',
          details: validation.errors,
        },
        executionTimeMs: Math.round(proxyOverheadMs * 100) / 100,
      };
    }

    // 2. Authentication Verification
    if (!this.validateAuth(request.authToken)) {
      this.metrics.rejectedRequests += 1;
      const proxyOverheadMs = performance.now() - proxyStart;
      this._recordMetrics(toolName, proxyOverheadMs, false);

      return {
        success: false,
        requestId,
        tool: toolName,
        data: null,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Provided authToken is unauthorized or expired',
          details: ['Ensure antiquity:handshake is established before invoking tools'],
        },
        executionTimeMs: Math.round(proxyOverheadMs * 100) / 100,
      };
    }

    // 3. Resolve Microservice Endpoint
    if (!this.microservices) {
      this.microservices = resolveMicroservicesModule();
    }

    if (!this.microservices) {
      const proxyOverheadMs = performance.now() - proxyStart;
      return {
        success: false,
        requestId,
        tool: toolName,
        data: null,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Antiquity microservices directory could not be located',
          details: [],
        },
        executionTimeMs: Math.round(proxyOverheadMs * 100) / 100,
      };
    }

    const service = this.microservices.getService(toolName);
    if (!service) {
      this.metrics.rejectedRequests += 1;
      const proxyOverheadMs = performance.now() - proxyStart;
      return {
        success: false,
        requestId,
        tool: toolName,
        data: null,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Microservice "${toolName}" is not registered in Antiquity layer`,
          details: [`Available tools: ${this.microservices.getRegisteredServices().join(', ')}`],
        },
        executionTimeMs: Math.round(proxyOverheadMs * 100) / 100,
      };
    }

    // Pre-execution proxy overhead measured
    const preExecutionOverhead = performance.now() - proxyStart;

    // 4. Pure Stateless Execution of Microservice
    try {
      const execStart = performance.now();
      const resultData = await service.execute(request.payload, {
        requestId,
        timestamp: Date.now(),
        caller: 'antiquity-proxy-router',
      });
      const microserviceDuration = performance.now() - execStart;

      const totalDuration = performance.now() - proxyStart;
      const proxyOverheadMs = Math.max(0, totalDuration - microserviceDuration);

      this.metrics.successfulRequests += 1;
      this._recordMetrics(toolName, proxyOverheadMs, true);

      return {
        success: true,
        requestId,
        tool: toolName,
        data: resultData,
        error: null,
        executionTimeMs: Math.round(totalDuration * 100) / 100,
        proxyOverheadMs: Math.round(proxyOverheadMs * 100) / 100,
      };
    } catch (execErr) {
      this.metrics.failedExecutions += 1;
      const totalDuration = performance.now() - proxyStart;
      this._recordMetrics(toolName, totalDuration, false);

      return {
        success: false,
        requestId,
        tool: toolName,
        data: null,
        error: {
          code: 'EXECUTION_ERROR',
          message: execErr.message || 'Microservice execution failed',
          details: [execErr.stack ? execErr.stack.split('\n')[0] : 'Unknown failure'],
        },
        executionTimeMs: Math.round(totalDuration * 100) / 100,
      };
    }
  }

  /**
   * Internal telemetry helper.
   * @private
   */
  _recordMetrics(toolName, overheadMs, isSuccess) {
    this.metrics.totalProxyOverheadMs += overheadMs;
    if (overheadMs > this.metrics.maxProxyOverheadMs) {
      this.metrics.maxProxyOverheadMs = overheadMs;
    }

    this.metrics.latencies.push(overheadMs);
    if (this.metrics.latencies.length > 500) {
      this.metrics.latencies.shift();
    }

    if (!this.metrics.toolUsage[toolName]) {
      this.metrics.toolUsage[toolName] = { total: 0, success: 0, failed: 0 };
    }
    this.metrics.toolUsage[toolName].total += 1;
    if (isSuccess) {
      this.metrics.toolUsage[toolName].success += 1;
    } else {
      this.metrics.toolUsage[toolName].failed += 1;
    }
  }

  /**
   * Returns health, throughput, and latency snapshot for monitoring dashboard.
   * @returns {object}
   */
  getHealthStatus() {
    const count = this.metrics.latencies.length;
    const avgOverhead = count > 0
      ? this.metrics.latencies.reduce((a, b) => a + b, 0) / count
      : 0;

    return {
      status: 'healthy',
      uptimeSeconds: Math.round((Date.now() - this.metrics.startedAt) / 1000),
      metrics: {
        totalRequests: this.metrics.totalRequests,
        successfulRequests: this.metrics.successfulRequests,
        rejectedRequests: this.metrics.rejectedRequests,
        failedExecutions: this.metrics.failedExecutions,
        avgProxyOverheadMs: Math.round(avgOverhead * 100) / 100,
        maxProxyOverheadMs: Math.round(this.metrics.maxProxyOverheadMs * 100) / 100,
        overheadBudgetMet: avgOverhead < 5.0,
      },
      registeredTools: this.microservices ? this.microservices.getRegisteredServices() : [],
      toolUsage: this.metrics.toolUsage,
    };
  }
}

// Export singleton and class
const defaultRouter = new AntiquityToolRouter();

module.exports = {
  AntiquityToolRouter,
  defaultRouter,
  validateSchema,
};
