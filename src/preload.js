// Preload script for secure IPC communication
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC communication methods
  send: (channel, data) => {
    // Whitelist channels for security
    const validChannels = [
      'get-config',
      'save-config',
      'get-auth-status',
      'logout',
      'open-external',
      'show-notification',
      'get-usage-stats',
      'save-history',
      'get-history',
      'clear-history',
      'export-history',
      'get-admin-stats',
      'get-users',
      'update-user',
      'delete-user',
      'get-api-requests',
      'manual-oauth-fix',
      'eye-move',
      'eye-unavailable',
      'eye-status',
      'clipboard:copy-prompt'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel, func) => {
    const validChannels = [
      'config',
      'auth-status',
      'auth-updated',
      'usage-updated',
      'history-data',
      'admin-stats',
      'users-data',
      'api-requests-data',
      'notification',
      'eye-move',
      'eye-unavailable',
      'eye-status',
      'audio:stream-frame',
      'audio:memory-telemetry',
      'skills:reloaded',
      'skills:fallback',
      'research:progress',
      'research:status-feed',
      'conversation:state-changed',
      'conversation:turn-indicator',
      'conversation:phase-changed',
      'conversation:rate-limit-warning',
      'conversation:rehydrated',
      'audio:device-changed',
      'audio:pipeline-warning',
      'audio:status-update',
      'audio:stream-data',
      'audio:error',
      'system:terminating',
      'ipc:connection-state'
    ];
    
    if (validChannels.includes(channel) && typeof func === 'function') {
      // Remove all listeners for this channel first to prevent memory leaks
      ipcRenderer.removeAllListeners(channel);
      // Add the new listener
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  
  once: (channel, func) => {
    const validChannels = [
      'config',
      'auth-status',
      'auth-updated',
      'usage-updated',
      'history-data',
      'admin-stats',
      'users-data',
      'api-requests-data',
      'eye-move',
      'eye-unavailable',
      'eye-status',
      'audio:stream-frame',
      'audio:memory-telemetry',
      'conversation:state-changed',
      'conversation:turn-indicator',
      'conversation:phase-changed',
      'conversation:rate-limit-warning',
      'conversation:rehydrated',
      'audio:device-changed',
      'audio:pipeline-warning',
      'audio:status-update',
      'audio:stream-data',
      'audio:error',
      'system:terminating',
      'ipc:connection-state'
    ];
    
    if (validChannels.includes(channel) && typeof func === 'function') {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    }
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Conversational State Management APIs
  requestState: () => ipcRenderer.invoke('state-request'),
  commitState: (state) => ipcRenderer.invoke('state-commit', state),
  onStateUpdate: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('state-updated', subscription);
    return () => {
      ipcRenderer.removeListener('state-updated', subscription);
    };
  },

  // State Reconciliation & Semantic Discontinuity Verification APIs
  verifyIntegrity: (uiState) => ipcRenderer.invoke('conversation:verify-integrity', { uiState }),
  reconcileState: (uiState) => ipcRenderer.invoke('conversation:reconcile', { uiState }),
  getSyncStatus: () => ipcRenderer.invoke('conversation:get-sync-status'),
  ingestCheckpoint: (checkpoint) => ipcRenderer.invoke('conversation:ingest-checkpoint', { checkpoint }),
  onStateSyncStatus: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('stateSyncStatus', subscription);
    return () => {
      ipcRenderer.removeListener('stateSyncStatus', subscription);
    };
  },

  // Multi-Language & Auto-Locale APIs
  locale: {
    detect: (text) => ipcRenderer.invoke('locale:detect', { text }),
    setLocale: (locale, source = 'manual') => ipcRenderer.invoke('locale:change', { locale, source }),
    getCurrent: () => ipcRenderer.invoke('locale:get-current'),
    getPreferences: () => ipcRenderer.invoke('locale:get-preferences'),
    setPreference: (prefs) => ipcRenderer.invoke('locale:set-preference', prefs),
    getTelemetry: () => ipcRenderer.invoke('locale:get-telemetry'),
    onLocaleChanged: (callback) => {
      const subscription = (_event, value) => callback(value);
      ipcRenderer.on('locale:changed', subscription);
      return () => {
        ipcRenderer.removeListener('locale:changed', subscription);
      };
    }
  }
});

// Expose direct localeBridge in window for renderer components
contextBridge.exposeInMainWorld('localeBridge', {
  detect: (text) => ipcRenderer.invoke('locale:detect', { text }),
  setLocale: (locale, source = 'manual') => ipcRenderer.invoke('locale:change', { locale, source }),
  getCurrent: () => ipcRenderer.invoke('locale:get-current'),
  getPreferences: () => ipcRenderer.invoke('locale:get-preferences'),
  setPreference: (prefs) => ipcRenderer.invoke('locale:set-preference', prefs),
  getTelemetry: () => ipcRenderer.invoke('locale:get-telemetry'),
  onLocaleChanged: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('locale:changed', subscription);
    return () => {
      ipcRenderer.removeListener('locale:changed', subscription);
    };
  }
});

// Also expose a legacy ipcRenderer for backward compatibility during transition
// This maintains existing functionality while we migrate to the secure API
contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => {
    const validChannels = [
      'get-config',
      'save-config',
      'get-auth-status',
      'logout',
      'open-external',
      'show-notification',
      'get-usage-stats',
      'save-history',
      'get-history',
      'clear-history',
      'export-history',
      'get-admin-stats',
      'get-users',
      'update-user',
      'delete-user',
      'get-api-requests',
      'eye-move',
      'eye-unavailable',
      'eye-status',
      'clipboard:copy-prompt'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  on: (channel, func) => {
    const validChannels = [
      'config',
      'auth-status',
      'auth-updated',
      'usage-updated',
      'history-data',
      'admin-stats',
      'users-data',
      'api-requests-data',
      'notification',
      'eye-move',
      'eye-unavailable',
      'eye-status'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
    }
  },
  
  once: (channel, func) => {
    const validChannels = [
      'config',
      'auth-status',
      'auth-updated',
      'usage-updated',
      'history-data',
      'admin-stats',
      'users-data',
      'api-requests-data',
      'eye-move',
      'eye-unavailable',
      'eye-status'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (event, ...args) => func(event, ...args));
    }
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Add invoke method to electronAPI for manual OAuth fix
contextBridge.exposeInMainWorld('electronInvoke', {
  invoke: (channel, ...args) => {
    const validChannels = [
      'auth-google',
      'get-auth-status',
      'manual-oauth-fix',
      'get-config',
      'save-config',
      'get-usage-stats',
      'get-history',
      'save-history',
      'clear-history',
      'export-history',
      'conversation:verify-integrity',
      'conversation:reconcile',
      'conversation:get-sync-status',
      'conversation:ingest-checkpoint',
      'audio-ring:init',
      'audio-ring:read-frame',
      'audio-ring:write-frame',
      'audio-ring:get-metrics',
      'audio-ring:reset',
      'audio-ring:close',
      'audio:fast-path-stream',
      'audio:fast-path-metrics',
      'audio:start-stream',
      'audio:stop-stream',
      'audio:update-parameters',
      'audio:get-status',
      'audio:get-health',
      'audio:reconnect',
      'agent:sync-pipeline',
      'locale:detect',
      'locale:change',
      'locale:get-current',
      'locale:get-preferences',
      'locale:set-preference',
      'locale:get-telemetry',
      'clear-app-cache',
      'clear-go-cache'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  }
});

// Expose safe cache API via window.api
contextBridge.exposeInMainWorld('api', {
  clearCache: (options = {}) => ipcRenderer.invoke('clear-app-cache', options),
  clearGoCache: (options = {}) => ipcRenderer.invoke('clear-go-cache', options)
});

// Expose secure clipboard API bridge
contextBridge.exposeInMainWorld('clipboard', {
  copy: (payload) => {
    const safePayload = typeof payload === 'string' ? { text: payload } : (payload || {});
    return ipcRenderer.invoke('clipboard:copy', safePayload);
  },
  paste: () => ipcRenderer.invoke('clipboard:paste'),
  readText: () => ipcRenderer.invoke('clipboard:read-text'),
  writeText: (text) => ipcRenderer.invoke('clipboard:write-text', text === null || text === undefined ? '' : String(text)),
  writeHTML: (html, text = '') => ipcRenderer.invoke('clipboard:write-html', { html, text }),
  clear: () => ipcRenderer.invoke('clipboard:clear')
});

// Expose simple clipboardAPI bridge for prompt copying
contextBridge.exposeInMainWorld('clipboardAPI', {
  copyPrompt: (text) => {
    if (typeof text === 'string' && text.trim()) {
      ipcRenderer.send('clipboard:copy-prompt', text);
    }
  }
});

// Expose Shared Memory API for zero-copy agent state synchronization
contextBridge.exposeInMainWorld('sharedMemory', {
  // Get SharedArrayBuffer from main process
  getBuffer: () => ipcRenderer.invoke('shared-memory:get-buffer'),
  
  // Agent state operations
  readAgentState: (agentId) => ipcRenderer.invoke('shared-memory:read-agent', agentId),
  writeAgentState: (agentId, state) => ipcRenderer.invoke('shared-memory:write-agent', agentId, state),
  listAgents: () => ipcRenderer.invoke('shared-memory:list-agents'),
  getAgentMetadata: (agentId) => ipcRenderer.invoke('shared-memory:get-metadata', agentId),
  clearAgentState: (agentId) => ipcRenderer.invoke('shared-memory:clear-agent', agentId),
  
  // Agent lifecycle
  initializeAgent: (agentId) => ipcRenderer.invoke('shared-memory:init-agent', agentId),
  addConversationTurn: (agentId, role, content) => 
    ipcRenderer.invoke('shared-memory:add-turn', agentId, role, content),
  updateEmotionalState: (agentId, mood, intensity) =>
    ipcRenderer.invoke('shared-memory:update-emotion', agentId, mood, intensity),
  
  // Memory statistics
  getStats: () => ipcRenderer.invoke('shared-memory:get-stats'),
  
  // Event subscriptions
  onStateUpdate: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('shared-memory:state-updated', subscription);
    return () => {
      ipcRenderer.removeListener('shared-memory:state-updated', subscription);
    };
  },
  
  onAgentRegistered: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('shared-memory:agent-registered', subscription);
    return () => {
      ipcRenderer.removeListener('shared-memory:agent-registered', subscription);
    };
  }
});

// Expose dedicated, type-safe Audio Ring Buffer & Fast-Path IPC Bridge
contextBridge.exposeInMainWorld('audioBridge', {
  init: () => ipcRenderer.invoke('audio-ring:init'),
  readFrame: () => ipcRenderer.invoke('audio-ring:read-frame'),
  writeFrame: (frameData) => {
    if (!frameData || typeof frameData !== 'object') {
      return Promise.reject(new Error('Invalid audio frame: payload must be an object'));
    }
    return ipcRenderer.invoke('audio-ring:write-frame', frameData);
  },
  getMetrics: () => ipcRenderer.invoke('audio-ring:get-metrics'),
  reset: () => ipcRenderer.invoke('audio-ring:reset'),
  close: () => ipcRenderer.invoke('audio-ring:close'),
  fastPathStream: (frame) => {
    if (!frame || typeof frame !== 'object') {
      return Promise.reject(new Error('Invalid fast-path frame: payload must be an object'));
    }
    return ipcRenderer.invoke('audio:fast-path-stream', frame);
  },
  fastPathMetrics: () => ipcRenderer.invoke('audio:fast-path-metrics'),
  syncPipeline: (payload) => ipcRenderer.invoke('agent:sync-pipeline', payload || {}),
  onStreamFrame: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, frame) => callback(frame);
    ipcRenderer.on('audio:stream-frame', subscription);
    return () => ipcRenderer.removeListener('audio:stream-frame', subscription);
  },
  onMemoryTelemetry: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, telemetry) => callback(telemetry);
    ipcRenderer.on('audio:memory-telemetry', subscription);
    return () => ipcRenderer.removeListener('audio:memory-telemetry', subscription);
  }
});

// Expose dedicated, type-safe Audio API for control signals & real-time streaming
contextBridge.exposeInMainWorld('audioAPI', {
  startStream: (config) => ipcRenderer.invoke('audio:start-stream', config),
  stopStream: () => ipcRenderer.invoke('audio:stop-stream'),
  updateParameters: (params) => {
    if (!params || typeof params !== 'object') {
      return Promise.reject(new Error('Audio parameters payload must be an object'));
    }
    return ipcRenderer.invoke('audio:update-parameters', params);
  },
  getStatus: () => ipcRenderer.invoke('audio:get-status'),
  getHealth: () => ipcRenderer.invoke('audio:get-health'),
  reconnect: () => ipcRenderer.invoke('audio:reconnect'),
  onStatusUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, status) => callback(status);
    ipcRenderer.on('audio:status-update', subscription);
    return () => ipcRenderer.removeListener('audio:status-update', subscription);
  },
  onStreamData: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('audio:stream-data', subscription);
    return () => ipcRenderer.removeListener('audio:stream-data', subscription);
  },
  onError: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, err) => callback(err);
    ipcRenderer.on('audio:error', subscription);
    return () => ipcRenderer.removeListener('audio:error', subscription);
  },
  onDeviceChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, dev) => callback(dev);
    ipcRenderer.on('audio:device-changed', subscription);
    return () => ipcRenderer.removeListener('audio:device-changed', subscription);
  }
});

// Expose dedicated, type-safe Skill Daemon & Metadata Hot-Reload Bridge
contextBridge.exposeInMainWorld('skillDaemon', {
  getProfile: (agentId) => ipcRenderer.invoke('skills:get-profile', agentId),
  updateMetadata: (agentId, mutation) => {
    if (!mutation || typeof mutation !== 'object') {
      return Promise.reject(new Error('Invalid metadata mutation: payload must be an object'));
    }
    return ipcRenderer.invoke('skills:update-metadata', agentId, mutation);
  },
  getTelemetry: () => ipcRenderer.invoke('skills:get-telemetry'),
  reload: (agentId) => ipcRenderer.invoke('skills:reload', agentId),
  onSkillReloaded: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('skills:reloaded', subscription);
    return () => ipcRenderer.removeListener('skills:reloaded', subscription);
  },
  onSkillFallback: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('skills:fallback', subscription);
    return () => ipcRenderer.removeListener('skills:fallback', subscription);
  }
});

// Expose dedicated, type-safe Deep Research & Neural-Mesh Memory Bridge
contextBridge.exposeInMainWorld('antigravityResearch', {
  dispatch: (promptOrUrl, options) => ipcRenderer.invoke('research:dispatch', promptOrUrl, options || {}),
  getStatus: () => ipcRenderer.invoke('research:status'),
  getMemoryBanks: (agentId) => ipcRenderer.invoke('memory:get-banks', agentId),
  queryMemory: (query, options) => ipcRenderer.invoke('memory:query', query, options || {}),
  syncMemory: () => ipcRenderer.invoke('memory:sync-banks'),
  onProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, data) => callback(data);
    ipcRenderer.on('research:progress', sub);
    return () => ipcRenderer.removeListener('research:progress', sub);
  },
  onStatusFeed: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, data) => callback(data);
    ipcRenderer.on('research:status-feed', sub);
    return () => ipcRenderer.removeListener('research:status-feed', sub);
  }
});

// Expose dedicated, type-safe Conversation State & Rate-Limit Bridge
contextBridge.exposeInMainWorld('conversationBridge', {
  getState: () => ipcRenderer.invoke('conversation:get-state'),
  appendTurn: (turn) => {
    if (!turn || typeof turn !== 'object') {
      return Promise.reject(new Error('Invalid turn: payload must be an object'));
    }
    return ipcRenderer.invoke('conversation:append-turn', turn);
  },
  transitionPhase: (phase) => {
    if (typeof phase !== 'string') {
      return Promise.reject(new Error('Invalid phase: must be a string'));
    }
    return ipcRenderer.invoke('conversation:transition-phase', phase);
  },
  reportRateLimit: (backoffMs) => ipcRenderer.invoke('conversation:report-rate-limit', backoffMs),
  resetRateLimit: () => ipcRenderer.invoke('conversation:reset-rate-limit'),
  rehydrate: () => ipcRenderer.invoke('conversation:rehydrate'),
  setAudioState: (audioState) => {
    if (typeof audioState !== 'string') {
      return Promise.reject(new Error('Invalid audioState: must be a string'));
    }
    return ipcRenderer.invoke('conversation:set-audio-state', audioState);
  },
  onStateChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, state) => callback(state);
    ipcRenderer.on('conversation:state-changed', sub);
    return () => ipcRenderer.removeListener('conversation:state-changed', sub);
  },
  onTurnIndicator: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, event) => callback(event);
    ipcRenderer.on('conversation:turn-indicator', sub);
    return () => ipcRenderer.removeListener('conversation:turn-indicator', sub);
  },
  onPhaseChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, event) => callback(event);
    ipcRenderer.on('conversation:phase-changed', sub);
    return () => ipcRenderer.removeListener('conversation:phase-changed', sub);
  },
  onRateLimitWarning: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, warning) => callback(warning);
    ipcRenderer.on('conversation:rate-limit-warning', sub);
    return () => ipcRenderer.removeListener('conversation:rate-limit-warning', sub);
  }
});

// Expose dedicated, type-safe System Diagnostics & Resilient IPC Bridge
contextBridge.exposeInMainWorld('systemDiagnostics', {
  heartbeat: (payload) => ipcRenderer.invoke('ipc:heartbeat', payload || {}),
  getDeviceStatus: () => ipcRenderer.invoke('audio:device-status'),
  reportDeviceDisconnect: (details) => ipcRenderer.invoke('audio:report-device-disconnect', details || {}),
  reportDeviceReconnect: (details) => ipcRenderer.invoke('audio:report-device-reconnect', details || {}),
  getPipelineHealth: () => ipcRenderer.invoke('audio:pipeline-health'),
  getSubsystemStatus: () => ipcRenderer.invoke('system:subsystem-status'),
  onDeviceChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, data) => callback(data);
    ipcRenderer.on('audio:device-changed', sub);
    return () => ipcRenderer.removeListener('audio:device-changed', sub);
  },
  onPipelineWarning: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const sub = (_event, data) => callback(data);
    ipcRenderer.on('audio:pipeline-warning', sub);
    return () => ipcRenderer.removeListener('audio:pipeline-warning', sub);
  }
});

// Expose dedicated, type-safe Bengali Text-to-Speech (TTS) pipeline API
contextBridge.exposeInMainWorld('banglaTTS', {
  synthesize: (text, options) => {
    if (!text || typeof text !== 'string') {
      return Promise.reject(new Error('Bengali TTS: text must be a non-empty string'));
    }
    return ipcRenderer.invoke('tts:bangla:synthesize', text, options || {});
  },
  cancel: (sessionId) => ipcRenderer.invoke('tts:bangla:cancel', sessionId)
});

// Expose dedicated, type-safe Clipboard Service API
contextBridge.exposeInMainWorld('clipboardAPI', {
  copyBengaliFix: (customText) => ipcRenderer.invoke('clipboard:copy-bengali-fix', customText),
  writeText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  readText: () => ipcRenderer.invoke('clipboard:read-text')
});

// Expose window.electron with ipcRenderer for renderer utility bridges
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener)
  }
});