const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal operations
  createTerminal: (terminalId, shellId) => ipcRenderer.invoke('create-terminal', terminalId, shellId),
  writeTerminal: (terminalId, data) => ipcRenderer.invoke('write-terminal', terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
  closeTerminal: (terminalId) => ipcRenderer.invoke('close-terminal', terminalId),
  
  // Shell configuration
  getAvailableShells: () => ipcRenderer.invoke('get-available-shells'),
  
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
  windowControl: (action) => ipcRenderer.invoke('window-control', action),

  // Layout persistence
  saveLayout: (layoutJson) => ipcRenderer.invoke('save-layout', layoutJson),
  loadLayout: () => ipcRenderer.invoke('load-layout'),

  // File system operations for file manager
  getDirectoryContents: (path) => ipcRenderer.invoke('get-directory-contents', path),
  createFolder: (path) => ipcRenderer.invoke('create-folder', path),
  deleteFiles: (paths) => ipcRenderer.invoke('delete-files', paths),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  downloadFiles: (paths) => ipcRenderer.invoke('download-files', paths)
});
