const { contextBridge, ipcRenderer } = require('electron');

// Expose any APIs to the renderer process (frontend) here
contextBridge.exposeInMainWorld('electron', {
  // Example: send a message to the main process
  sendMessage: (channel, data) => ipcRenderer.send(channel, data),
  // Example: receive a message from the main process
  onMessage: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
