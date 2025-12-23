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