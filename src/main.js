const {app, BrowserWindow, ipcMain, shell} = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const isDev = !app.isPackaged;
const pty = require('@lydell/node-pty');
const registerGlobalShortcuts = require('./globalShortcuts');
const {getBounds} = require('./windowUtils');
const shellConfigModule = require('./shellConfig');

let mainWindow;
const terminals = new Map();
let store;
let shellManager;

/**
 * ShellManager - Handles shell configuration, validation, and terminal spawning
 */
class ShellManager {
  constructor(electronStore) {
    this.store = electronStore;
    this.userShellConfig = this.store.get('shells') || {};
    this.initializeAvailableShells();
  }

  /**
   * Initialize and validate available shells on startup
   */
  initializeAvailableShells() {
    const available = shellConfigModule.listAvailableShells(this.userShellConfig);
    console.log('Available shells:', available.map(s => `${s.name} (${s.executable})`).join(', '));
    
    if (available.length === 0) {
      console.warn('Warning: No valid shells found on system!');
    }
  }

  /**
   * Get a shell configuration by ID or use default
   * @param {string} shellId - The shell ID to retrieve
   * @returns {object} Shell configuration
   */
  getShell(shellId) {
    return shellConfigModule.getShellConfig(shellId, this.userShellConfig);
  }

  /**
   * Get all available shells for UI display
   * @returns {array} Array of available shell configurations
   */
  listAvailable() {
    return shellConfigModule.listAvailableShells(this.userShellConfig);
  }

  /**
   * Spawn a terminal with the specified shell
   * @param {string} terminalId - The terminal ID
   * @param {string} shellId - The shell ID to use
   * @returns {object} PTY process or error
   */
  spawnTerminal(terminalId, shellId) {
    try {
      const shellConfig = this.getShell(shellId);
      
      if (!shellConfig) {
        console.error('No valid shell configuration found');
        return {success: false, error: 'No valid shell configuration found'};
      }

      const executable = shellConfigModule.resolveEnvVariables(shellConfig.executable);
      const spawnOptions = shellConfigModule.getSpawnOptions(shellConfig);

      console.log(`Spawning terminal ${terminalId} with ${shellConfig.name} (${executable})`);

      const terminal = pty.spawn(executable, shellConfig.args, spawnOptions);
      return {success: true, terminal};
    } catch (error) {
      console.error(`Failed to spawn terminal ${terminalId}:`, error.message);
      return {success: false, error: error.message};
    }
  }

  /**
   * Update user shell configuration
   * @param {object} newConfig - New shell configuration
   */
  updateConfig(newConfig) {
    this.userShellConfig = newConfig;
    if (this.store) {
      this.store.set('shells', newConfig);
    }
    this.initializeAvailableShells();
  }
}

function createWindow() {
  const bounds = getBounds(store);

  mainWindow = new BrowserWindow({
    width         : bounds.width,
    height        : bounds.height,
    x             : bounds.x,
    y             : bounds.y,
    frame         : false,
    transparent   : true,
    acrylic       : true,
    alwaysOnTop   : false,
    skipTaskbar   : true,
    resizable     : true,
    webPreferences: {
      nodeIntegration   : false,
      contextIsolation  : true,
      enableRemoteModule: false,
      preload           : path.join(__dirname, 'preload.js')
    }
  });
  // mainWindow.setBackgroundMaterial('acrylic'); Register global shortcuts for quake
  // console mode
  registerGlobalShortcuts(mainWindow, store);

  // Save window bounds when window is resized or moved
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized() && store) {
      store.set('bounds', mainWindow.getBounds());
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized() && store) {
      store.set('bounds', mainWindow.getBounds());
    }
  });

  // Load the appropriate URL based on environment
  if (isDev) {
    const startUrl = 'http://localhost:5173';
    mainWindow.loadURL(startUrl);

    // Always open dev tools in development
    mainWindow.webContents.openDevTools();

    // In development, wait for the dev server to be ready
    mainWindow.webContents.once('did-fail-load', () => {
      setTimeout(() => {
        mainWindow.loadURL(startUrl);
      }, 1000);
    });
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

app.whenReady().then(async () => {
  // Import electron-store dynamically
  const Store = (await import ('electron-store')).default;
  store = new Store();

  // Initialize shell manager
  shellManager = new ShellManager(store);

  createWindow();
});

app.on('window-all-closed', () => {
  // Clean up all terminals
  terminals.forEach(terminal => terminal.kill());
  terminals.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Terminal management
ipcMain.handle('create-terminal', (event, terminalId, shellId) => {
  console.log('Creating terminal:', terminalId, 'with shell:', shellId);

  // If terminal already exists, don't create a new one
  if (terminals.has(terminalId)) {
    console.log('Terminal already exists:', terminalId);
    return {success: true, existed: true};
  }

  // Use shellId parameter, or fall back to default
  const effectiveShellId = shellId || undefined;
  const spawnResult = shellManager.spawnTerminal(terminalId, effectiveShellId);

  if (!spawnResult.success) {
    return spawnResult;
  }

  const terminal = spawnResult.terminal;
  terminals.set(terminalId, terminal);
  console.log('Terminal created and stored:', terminalId);

  terminal.onData(data => {
    console.log('Terminal data:', terminalId, data);
    mainWindow.webContents.send('terminal-data', terminalId, data);
  });

  terminal.onExit(() => {
    console.log('Terminal exited:', terminalId);
    terminals.delete(terminalId);
    mainWindow.webContents.send('terminal-exit', terminalId);
  });

  return {success: true, existed: false};
});

ipcMain.handle('get-available-shells', () => {
  try {
    const shells = shellManager.listAvailable();
    return {success: true, shells};
  } catch (error) {
    console.error('Failed to get available shells:', error);
    return {success: false, error: error.message};
  }
});

ipcMain.handle('write-terminal', (event, terminalId, data) => {
  console.log('Writing to terminal:', terminalId, data);
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.write(data);
    return {success: true};
  }
  console.log('Terminal not found:', terminalId);
  return {success: false, error: 'Terminal not found'};
});

ipcMain.handle('resize-terminal', (event, terminalId, cols, rows) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.resize(cols, rows);
    return {success: true};
  }
  return {success: false, error: 'Terminal not found'};
});

ipcMain.handle('close-terminal', (event, terminalId) => {
  console.log('Attempting to close terminal:', terminalId);
  const terminal = terminals.get(terminalId);
  if (terminal) {
    console.log('Closing terminal:', terminalId);
    terminal.kill();
    terminals.delete(terminalId);
    return {success: true};
  }
  console.log('Terminal not found for closing:', terminalId);
  return {success: false, error: 'Terminal not found'};
});

// Layout persistence handlers
ipcMain.handle('save-layout', async (event, layoutJson) => {
  if (store) {
    try {
      store.set('layout', layoutJson);
      return {success: true};
    } catch (error) {
      console.error('Failed to save layout:', error);
      return {success: false, error: error.message};
    }
  }
  return {success: false, error: 'Store not initialized'};
});

ipcMain.handle('load-layout', async () => {
  if (store) {
    try {
      const layoutJson = store.get('layout');
      return {success: true, layoutJson};
    } catch (error) {
      console.error('Failed to load layout:', error);
      return {success: false, error: error.message};
    }
  }
  return {success: false, error: 'Store not initialized'};
});

// Window control handlers
ipcMain.handle('window-control', (event, action) => {
  if (!mainWindow) {
    return {success: false, error: 'Main window not available'};
  }

  try {
    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.restore();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'close':
        mainWindow.close();
        break;
      default:
        console.log('Unknown window control action:', action);
        return {success: false, error: 'Unknown action'};
    }
    return {success: true};
  } catch (error) {
    console.error('Window control error:', error);
    return {success: false, error: error.message};
  }
});

// File system operations for file manager
ipcMain.handle('get-directory-contents', async (event, dirPath) => {
  try {
    // Default to user's home directory if no path provided
    const targetPath = dirPath || require('os').homedir();
    
    console.log('Reading directory:', targetPath);
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    
    const files = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(targetPath, entry.name);
      const stats = await fs.stat(fullPath).catch(() => null);
      
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: fullPath.replace(/\\/g, '/'), // Normalize path separators
        updatedAt: stats ? stats.mtime.toISOString() : new Date().toISOString(),
        size: entry.isFile() && stats ? stats.size : undefined
      };
    }));
    
    return { success: true, files };
  } catch (error) {
    console.error('Error reading directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-folder', async (event, folderPath) => {
  try {
    await fs.mkdir(folderPath, { recursive: true });
    console.log('Created folder:', folderPath);
    return { success: true };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-files', async (event, filePaths) => {
  try {
    for (const filePath of filePaths) {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rmdir(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }
      console.log('Deleted:', filePath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath);
    console.log('Renamed:', oldPath, 'to', newPath);
    return { success: true };
  } catch (error) {
    console.error('Error renaming file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    console.log('Opened file:', filePath);
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-files', async (event, filePaths) => {
  try {
    // For now, we'll just copy files to the Downloads folder
    const os = require('os');
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const targetPath = path.join(downloadsPath, fileName);
      
      // Check if it's a file or directory
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        await fs.copyFile(filePath, targetPath);
        console.log('Downloaded file to:', targetPath);
      }
      // For directories, we'd need to implement recursive copying
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error downloading files:', error);
    return { success: false, error: error.message };
  }
});
