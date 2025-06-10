const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const pty = require('@lydell/node-pty');
const registerGlobalShortcuts = require('./globalShortcuts');
const {getBounds} = require('./windowUtils');

let mainWindow;
const terminals = new Map();
let store;

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

  // Force development mode for now
  const startUrl = 'http://localhost:5173';
  mainWindow.loadURL(startUrl);

  // Always open dev tools in development
  mainWindow.webContents.openDevTools();

  // In development, wait for the dev server to be ready
  if (isDev) {
    mainWindow.webContents.once('did-fail-load', () => {
      setTimeout(() => {
        mainWindow.loadURL(startUrl);
      }, 1000);
    });
  }
}

app.whenReady().then(async () => {
  // Import electron-store dynamically
  const Store = (await import ('electron-store')).default;
  store = new Store();

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
ipcMain.handle('create-terminal', (event, terminalId) => {
  console.log('Creating terminal:', terminalId);

  // If terminal already exists, don't create a new one
  if (terminals.has(terminalId)) {
    console.log('Terminal already exists:', terminalId);
    return {success: true, existed: true};
  }

  const shell = process.platform === 'win32'
    ? 'cmd.exe'
    : 'bash';

  const terminal = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd : process.env.HOMEPATH,
    env : process.env
  });

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
