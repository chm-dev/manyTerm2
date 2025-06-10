const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal operations
  createTerminal: (terminalId) => ipcRenderer.invoke('create-terminal', terminalId),
  writeTerminal: (terminalId, data) => ipcRenderer.invoke('write-terminal', terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
  closeTerminal: (terminalId) => ipcRenderer.invoke('close-terminal', terminalId),
  
  // Terminal event listeners
  onTerminalData: (callback) => {
    ipcRenderer.on('terminal-data', (event, terminalId, data) => {
      callback(terminalId, data);
    });
  },
  
  onTerminalExit: (callback) => {
    ipcRenderer.on('terminal-exit', (event, terminalId) => {
      callback(terminalId);
    });
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
