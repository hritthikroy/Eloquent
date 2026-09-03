// Preload script exposing StateManager and secure Electron APIs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  requestState: () => ipcRenderer.invoke('state-request'),
  commitState: (state) => ipcRenderer.invoke('state-commit', state),
  onStateUpdate: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('state-updated', subscription);
    return () => {
      ipcRenderer.removeListener('state-updated', subscription);
    };
  },
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  receive: (channel, func) => {
    ipcRenderer.on(channel, (_event, ...args) => func(...args));
  }
});
