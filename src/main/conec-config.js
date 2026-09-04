/**
 * Eloquent Audio Engine - Conec Configuration & Connection Handshake Specification
 * 
 * Defines parameters, socket addresses, and authentication options for communication
 * between the Electron frontend/main process and the Go audio backend.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONEC_CONFIG = {
  host: process.env.GO_BACKEND_HOST || '127.0.0.1',
  port: parseInt(process.env.GO_BACKEND_PORT || '48080', 10),
  ipcSocketPath: process.platform === 'win32'
    ? '\\\\.\\pipe\\eloquent-audio-ipc'
    : '/tmp/eloquent-audio.sock',
  timeoutMs: 5000,
  reconnectIntervalMs: 1500,
  maxRetries: 5,
  authToken: process.env.GO_BACKEND_AUTH_TOKEN || '',
  bufferSize: 1920,
  throttleMs: 16,
  heartbeatIntervalMs: 3000,
  enableSharedMemory: true,
  debugLogging: process.env.NODE_ENV === 'development'
};

/**
 * Validates a Conec configuration object.
 * @param {Object} config - Configuration candidate
 * @returns {{ valid: boolean, errors: string[], config: Object }}
 */
function validateConecConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be a non-null object'], config: { ...DEFAULT_CONEC_CONFIG } };
  }

  const merged = { ...DEFAULT_CONEC_CONFIG, ...config };

  if (typeof merged.host !== 'string' || !merged.host.trim()) {
    errors.push('Host must be a non-empty string');
  }

  if (typeof merged.port !== 'number' || isNaN(merged.port) || merged.port < 1024 || merged.port > 65535) {
    errors.push('Port must be a valid integer between 1024 and 65535');
  }

  if (typeof merged.timeoutMs !== 'number' || merged.timeoutMs < 100 || merged.timeoutMs > 60000) {
    errors.push('timeoutMs must be between 100 and 60000 ms');
  }

  if (typeof merged.reconnectIntervalMs !== 'number' || merged.reconnectIntervalMs < 100) {
    errors.push('reconnectIntervalMs must be at least 100 ms');
  }

  if (typeof merged.maxRetries !== 'number' || merged.maxRetries < 0) {
    errors.push('maxRetries must be a non-negative integer');
  }

  return {
    valid: errors.length === 0,
    errors,
    config: merged
  };
}

/**
 * Loads Conec configuration from local userData or fallback to defaults.
 * @param {string} [userDataPath]
 * @returns {Object}
 */
function loadConecConfig(userDataPath) {
  const dir = userDataPath || path.resolve(__dirname, '../../userData');
  const configFile = path.join(dir, 'conec-config.json');

  try {
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      const validated = validateConecConfig(parsed);
      if (validated.valid) {
        return validated.config;
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [ConecConfig] Failed to read conec-config.json, using defaults:', err.message);
    }
  }

  return { ...DEFAULT_CONEC_CONFIG };
}

/**
 * Persists Conec configuration to disk.
 * @param {string} userDataPath
 * @param {Object} config
 * @returns {boolean}
 */
function saveConecConfig(userDataPath, config) {
  const dir = userDataPath || path.resolve(__dirname, '../../userData');
  const configFile = path.join(dir, 'conec-config.json');

  const validated = validateConecConfig(config);
  if (!validated.valid) {
    throw new Error(`Invalid Conec configuration: ${validated.errors.join(', ')}`);
  }

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(validated.config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ [ConecConfig] Failed to save conec-config.json:', err.message);
    return false;
  }
}

module.exports = {
  DEFAULT_CONEC_CONFIG,
  validateConecConfig,
  loadConecConfig,
  saveConecConfig
};
