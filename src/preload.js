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
      'manual-oauth-fix'
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
      'notification'
    ];
    
    if (validChannels.includes(channel)) {
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
      'api-requests-data'
    ];
    
    if (validChannels.includes(channel)) {
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
      'get-api-requests'
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
      'notification'
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
      'api-requests-data'
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
      'export-history'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  }
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