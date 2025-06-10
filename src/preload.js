const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal operations
  createTerminal: (terminalId) => ipcRenderer.invoke('create-terminal', terminalId),
  writeTerminal: (terminalId, data) => ipcRenderer.invoke('write-terminal', terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
  closeTerminal: (terminalId) => ipcRenderer.invoke('close-terminal', terminalId),
  
  // Terminal event listeners with proper cleanup support
  onTerminalData: (callback) => {
    const wrappedCallback = (event, terminalId, data) => {
      callback(terminalId, data);
    };
    ipcRenderer.on('terminal-data', wrappedCallback);
    return wrappedCallback; // Return the actual listener function for removal
  },
  
  onTerminalExit: (callback) => {
    const wrappedCallback = (event, terminalId) => {
      callback(terminalId);
    };
    ipcRenderer.on('terminal-exit', wrappedCallback);
    return wrappedCallback; // Return the actual listener function for removal
  },
  
  // Remove specific listeners
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
    // Remove all listeners (kept for backward compatibility)
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Window controls for frameless window
  windowControl: (action) => ipcRenderer.invoke('window-control', action)
});
