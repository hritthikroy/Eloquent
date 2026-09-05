/**
 * Eloquent Skill Daemon - Automated Hot-Reloading & Metadata Management Service
 * 
 * Manages dynamic agent skill profiles (including Vision's engineering profile),
 * enforces strict JSON schema validation for all metadata array mutations,
 * performs zero-downtime hot-reloading with fallback recovery, and tracks
 * performance telemetry and daemon memory consumption over time.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const ALLOWED_METADATA_TYPES = ['string', 'number', 'boolean', 'object', 'array'];
const KEY_REGEX = /^[a-z0-9_]+$/;
const AGENT_ID_REGEX = /^agent_[a-z0-9_]+$/;

/**
 * Validate a single metadata item against strict schema requirements.
 * @param {Object} item - { key, value, type, description, timestamp }
 * @throws {Error} if validation fails
 */
function validateMetadataItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Metadata item must be a non-null object');
  }

  if (typeof item.key !== 'string' || !KEY_REGEX.test(item.key)) {
    throw new Error(`Invalid metadata key "${item.key}": must be lowercase alphanumeric with underscores`);
  }

  if (!ALLOWED_METADATA_TYPES.includes(item.type)) {
    throw new Error(`Invalid metadata type "${item.type}" for key "${item.key}": must be one of ${ALLOWED_METADATA_TYPES.join(', ')}`);
  }

  if (item.value === null || item.value === undefined) {
    throw new Error(`Metadata value for key "${item.key}" cannot be null or undefined`);
  }

  // Value type enforcement
  switch (item.type) {
    case 'string':
      if (typeof item.value !== 'string') {
        throw new Error(`Metadata value for key "${item.key}" must be a string, got ${typeof item.value}`);
      }
      break;
    case 'number':
      if (typeof item.value !== 'number' || isNaN(item.value)) {
        throw new Error(`Metadata value for key "${item.key}" must be a valid number, got ${item.value}`);
      }
      break;
    case 'boolean':
      if (typeof item.value !== 'boolean') {
        throw new Error(`Metadata value for key "${item.key}" must be a boolean, got ${typeof item.value}`);
      }
      break;
    case 'object':
      if (typeof item.value !== 'object' || Array.isArray(item.value)) {
        throw new Error(`Metadata value for key "${item.key}" must be a standard object, got ${Array.isArray(item.value) ? 'array' : typeof item.value}`);
      }
      break;
    case 'array':
      if (!Array.isArray(item.value)) {
        throw new Error(`Metadata value for key "${item.key}" must be an array, got ${typeof item.value}`);
      }
      break;
  }

  return true;
}

/**
 * Validate an entire skill profile object against the schema.
 * @param {Object} profile
 * @throws {Error} if validation fails
 */
function validateSkillProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Skill profile must be a non-null object');
  }

  if (typeof profile.agentId !== 'string' || !AGENT_ID_REGEX.test(profile.agentId)) {
    throw new Error(`Invalid or missing agentId "${profile.agentId}": must match pattern ^agent_[a-z0-9_]+$`);
  }

  if (typeof profile.name !== 'string' || profile.name.trim().length === 0) {
    throw new Error('Skill profile must have a valid non-empty name');
  }

  if (typeof profile.role !== 'string' || profile.role.trim().length === 0) {
    throw new Error('Skill profile must have a valid non-empty role');
  }

  if (typeof profile.version !== 'string' || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(profile.version)) {
    throw new Error(`Skill profile version "${profile.version}" must adhere to semver pattern X.Y.Z`);
  }

  if (typeof profile.enabled !== 'boolean') {
    throw new Error('Skill profile must specify boolean "enabled"');
  }

  if (!Array.isArray(profile.skills)) {
    throw new Error('Skill profile must contain a "skills" array');
  }

  for (let i = 0; i < profile.skills.length; i++) {
    const s = profile.skills[i];
    if (!s || typeof s !== 'object') {
      throw new Error(`Skill at index ${i} must be a valid object`);
    }
    if (typeof s.id !== 'string' || !KEY_REGEX.test(s.id)) {
      throw new Error(`Skill at index ${i} has invalid id "${s.id}"`);
    }
    if (typeof s.name !== 'string' || s.name.trim().length === 0) {
      throw new Error(`Skill at index ${i} has invalid name`);
    }
    if (typeof s.handler !== 'string' || s.handler.trim().length === 0) {
      throw new Error(`Skill at index ${i} has invalid handler`);
    }
    if (typeof s.enabled !== 'boolean') {
      throw new Error(`Skill at index ${i} must specify boolean "enabled"`);
    }
  }

  if (!Array.isArray(profile.metadata)) {
    throw new Error('Skill profile must contain a "metadata" array');
  }

  const seenKeys = new Set();
  for (let i = 0; i < profile.metadata.length; i++) {
    const item = profile.metadata[i];
    validateMetadataItem(item);
    if (seenKeys.has(item.key)) {
      throw new Error(`Duplicate metadata key "${item.key}" at index ${i}`);
    }
    seenKeys.add(item.key);
  }

  return true;
}

class SkillDaemon extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string} [options.configDir] - Directory holding skill JSON files
   * @param {boolean} [options.autoWatch=false] - Whether to start watching on init
   * @param {number} [options.debounceMs=100] - File change debounce window
   */
  constructor(options = {}) {
    super();
    this.configDir = options.configDir || this._resolveDefaultConfigDir();
    this.autoWatch = !!options.autoWatch;
    this.debounceMs = options.debounceMs || 100;

    this.activeProfiles = new Map();
    this.fallbackProfiles = new Map();
    this.fileWatchers = new Map();
    this.debounceTimers = new Map();
    this.isWatching = false;

    // Telemetry tracking
    this.telemetry = {
      startTime: Date.now(),
      reloadCount: 0,
      fallbackCount: 0,
      mutationCount: 0,
      lastReloadLatencyMs: 0,
      totalReloadLatencyMs: 0,
      history: []
    };

    if (this.autoWatch) {
      this.start();
    }
  }

  /**
   * Resolve default config/skills directory path across runtime locations.
   */
  _resolveDefaultConfigDir() {
    const candidates = [
      path.resolve(__dirname, '../../config/skills'),
      path.resolve(__dirname, '../config/skills'),
      path.resolve(process.cwd(), 'config/skills'),
      path.resolve(process.cwd(), 'EloquentElectron/config/skills')
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    // Default to EloquentElectron config/skills
    return path.resolve(process.cwd(), 'config/skills');
  }

  /**
   * Start watching skills directory for dynamic hot-reloads.
   */
  start() {
    if (this.isWatching) return;

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    // Load initial profiles
    this.loadAllProfiles();

    try {
      const watcher = fs.watch(this.configDir, (eventType, filename) => {
        if (!filename || !filename.endsWith('.json') || filename === 'skill-schema.json') {
          return;
        }

        const agentName = path.basename(filename, '.json');
        const timerKey = `watch_${agentName}`;

        if (this.debounceTimers.has(timerKey)) {
          clearTimeout(this.debounceTimers.get(timerKey));
        }

        const timer = setTimeout(() => {
          this.debounceTimers.delete(timerKey);
          const filePath = path.join(this.configDir, filename);
          if (fs.existsSync(filePath)) {
            this.reload(agentName, filePath);
          }
        }, this.debounceMs);

        this.debounceTimers.set(timerKey, timer);
      });

      this.fileWatchers.set(this.configDir, watcher);
      this.isWatching = true;
      this.emit('daemon:started', { configDir: this.configDir });
    } catch (err) {
      console.warn(`[SkillDaemon] Failed to initialize fs.watch on ${this.configDir}:`, err.message);
    }
  }

  /**
   * Stop watching for changes and clear timers.
   */
  stop() {
    for (const [dir, watcher] of this.fileWatchers.entries()) {
      try {
        watcher.close();
      } catch (_) {}
    }
    this.fileWatchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.isWatching = false;
    this.emit('daemon:stopped');
  }

  /**
   * Load all available skill profiles in configDir.
   */
  loadAllProfiles() {
    if (!fs.existsSync(this.configDir)) return;

    const files = fs.readdirSync(this.configDir);
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'skill-schema.json') {
        const agentName = path.basename(file, '.json');
        const filePath = path.join(this.configDir, file);
        this.reload(agentName, filePath);
      }
    }
  }

  /**
   * Perform a zero-downtime hot-reload of a specific agent profile.
   * If parsing or schema validation fails, safely recovers using the last known good profile.
   * 
   * @param {string} agentName - Identifier, e.g. "vision" or "agent_vision"
   * @param {string} [customFilePath]
   * @returns {Object} result - { success, fallback, latencyMs, profile, error }
   */
  reload(agentName, customFilePath) {
    const t0 = process.hrtime.bigint();
    const fileName = agentName.endsWith('.json') ? agentName : `${agentName}.json`;
    const filePath = customFilePath || path.join(this.configDir, fileName);

    let rawData = null;
    let parsed = null;

    try {
      rawData = fs.readFileSync(filePath, 'utf8');
      parsed = JSON.parse(rawData);
      validateSkillProfile(parsed);
    } catch (err) {
      const t1 = process.hrtime.bigint();
      const latencyMs = Number(t1 - t0) / 1e6;

      this.telemetry.fallbackCount++;
      const fallback = this.fallbackProfiles.get(parsed?.agentId || agentName) || null;

      const record = {
        event: 'fallback',
        agentName,
        filePath,
        error: err.message,
        latencyMs,
        timestamp: Date.now()
      };
      this._appendHistory(record);
      this.emit('skill:fallback', record);

      return {
        success: false,
        fallback: true,
        latencyMs,
        error: err.message,
        profile: fallback
      };
    }

    const t1 = process.hrtime.bigint();
    const latencyMs = Number(t1 - t0) / 1e6;

    // Zero-downtime in-memory activation
    const agentId = parsed.agentId;
    const frozenProfile = Object.freeze(JSON.parse(JSON.stringify(parsed)));

    this.activeProfiles.set(agentId, frozenProfile);
    this.activeProfiles.set(agentName, frozenProfile);
    this.fallbackProfiles.set(agentId, frozenProfile);
    this.fallbackProfiles.set(agentName, frozenProfile);

    this.telemetry.reloadCount++;
    this.telemetry.lastReloadLatencyMs = latencyMs;
    this.telemetry.totalReloadLatencyMs += latencyMs;

    const record = {
      event: 'reload',
      agentId,
      agentName,
      version: frozenProfile.version,
      metadataCount: frozenProfile.metadata.length,
      latencyMs,
      timestamp: Date.now()
    };
    this._appendHistory(record);
    this.emit('skill:reloaded', record);

    return {
      success: true,
      fallback: false,
      latencyMs,
      profile: frozenProfile
    };
  }

  /**
   * Mutate or insert a metadata entry in an agent's skill profile with atomic disk write.
   * 
   * @param {string} agentName - "vision" or "agent_vision"
   * @param {Object} mutation - { key, value, type, description }
   * @returns {Object} result - { success, profile, mutation, latencyMs }
   */
  updateMetadata(agentName, mutation) {
    const t0 = process.hrtime.bigint();
    validateMetadataItem(mutation);

    const profile = this.getProfile(agentName);
    if (!profile) {
      throw new Error(`Profile not found for agent "${agentName}"`);
    }

    // Clone deep to avoid mutating active cache before validation
    const updated = JSON.parse(JSON.stringify(profile));
    if (!Array.isArray(updated.metadata)) {
      updated.metadata = [];
    }

    const existingIdx = updated.metadata.findIndex(m => m.key === mutation.key);
    const now = Date.now();
    const cleanItem = {
      key: mutation.key,
      value: mutation.value,
      type: mutation.type,
      description: mutation.description || '',
      timestamp: now
    };

    if (existingIdx >= 0) {
      updated.metadata[existingIdx] = cleanItem;
    } else {
      updated.metadata.push(cleanItem);
    }

    updated.lastUpdated = now;

    // Validate updated profile before touching filesystem
    validateSkillProfile(updated);

    // Atomic filesystem persistence
    const fileName = agentName.endsWith('.json') ? agentName : `${agentName.replace(/^agent_/, '')}.json`;
    const targetFile = path.join(this.configDir, fileName);
    const tempFile = `${targetFile}.tmp.${Date.now()}`;

    try {
      fs.writeFileSync(tempFile, JSON.stringify(updated, null, 2), 'utf8');
      fs.renameSync(tempFile, targetFile);
    } catch (writeErr) {
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (_) {}
      throw new Error(`Atomic write failed for skill profile: ${writeErr.message}`);
    }

    // Hot-reload the updated file directly
    const reloadResult = this.reload(agentName, targetFile);

    const t1 = process.hrtime.bigint();
    const latencyMs = Number(t1 - t0) / 1e6;

    this.telemetry.mutationCount++;
    const record = {
      event: 'mutation',
      agentName,
      key: mutation.key,
      latencyMs,
      timestamp: now
    };
    this._appendHistory(record);
    this.emit('skill:mutated', record);

    return {
      success: true,
      latencyMs,
      profile: reloadResult.profile,
      mutation: cleanItem
    };
  }

  /**
   * Retrieve active skill profile for an agent, with fallback safety.
   * @param {string} agentName
   * @returns {Object|null}
   */
  getProfile(agentName) {
    if (this.activeProfiles.has(agentName)) {
      return this.activeProfiles.get(agentName);
    }

    // Try loading on demand
    const fileName = agentName.endsWith('.json') ? agentName : `${agentName.replace(/^agent_/, '')}.json`;
    const filePath = path.join(this.configDir, fileName);
    if (fs.existsSync(filePath)) {
      const res = this.reload(agentName, filePath);
      if (res.profile) return res.profile;
    }

    return this.fallbackProfiles.get(agentName) || null;
  }

  /**
   * Retrieve real-time telemetry metrics and daemon memory consumption over time.
   */
  getTelemetry() {
    const mem = process.memoryUsage();
    const avgLatency = this.telemetry.reloadCount > 0
      ? this.telemetry.totalReloadLatencyMs / this.telemetry.reloadCount
      : 0;

    return {
      uptimeSeconds: Math.round((Date.now() - this.telemetry.startTime) / 1000),
      reloadCount: this.telemetry.reloadCount,
      fallbackCount: this.telemetry.fallbackCount,
      mutationCount: this.telemetry.mutationCount,
      lastReloadLatencyMs: Math.round(this.telemetry.lastReloadLatencyMs * 1000) / 1000,
      averageReloadLatencyMs: Math.round(avgLatency * 1000) / 1000,
      activeProfilesCount: new Set(this.activeProfiles.values()).size,
      memory: {
        heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100
      },
      history: [...this.telemetry.history]
    };
  }

  _appendHistory(record) {
    this.telemetry.history.unshift(record);
    if (this.telemetry.history.length > 50) {
      this.telemetry.history.pop();
    }
  }
}

module.exports = {
  SkillDaemon,
  validateMetadataItem,
  validateSkillProfile,
  ALLOWED_METADATA_TYPES
};
