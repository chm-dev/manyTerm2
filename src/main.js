const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const pty = require('@lydell/node-pty');

let mainWindow;
const terminals = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });  // Force development mode for now
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

app.whenReady().then(createWindow);

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
    return { success: true, existed: true };
  }
  
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
  
  const terminal = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env
  });

  terminals.set(terminalId, terminal);
  console.log('Terminal created and stored:', terminalId);

  terminal.onData((data) => {
    console.log('Terminal data:', terminalId, data);
    mainWindow.webContents.send('terminal-data', terminalId, data);
  });

  terminal.onExit(() => {
    console.log('Terminal exited:', terminalId);
    terminals.delete(terminalId);
    mainWindow.webContents.send('terminal-exit', terminalId);
  });

  return { success: true, existed: false };
});

ipcMain.handle('write-terminal', (event, terminalId, data) => {
  console.log('Writing to terminal:', terminalId, data);
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.write(data);
    return { success: true };
  }
  console.log('Terminal not found:', terminalId);
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('resize-terminal', (event, terminalId, cols, rows) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('close-terminal', (event, terminalId) => {
  console.log('Attempting to close terminal:', terminalId);
  const terminal = terminals.get(terminalId);
  if (terminal) {
    console.log('Closing terminal:', terminalId);
    terminal.kill();
    terminals.delete(terminalId);
    return { success: true };
  }
  console.log('Terminal not found for closing:', terminalId);
  return { success: false, error: 'Terminal not found' };
});
