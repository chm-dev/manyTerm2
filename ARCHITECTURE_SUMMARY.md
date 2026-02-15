# FlexClaude Terminal - Architecture Summary

## Overview
FlexClaude Terminal is an Electron-based terminal emulator with a flexible, drag-and-drop layout system built on React and FlexLayout. It supports multiple terminals, editors, and file managers in a customizable tabbed interface.

## Core Architecture

### Technology Stack
- **Electron**: Cross-platform desktop application framework
- **React 18**: UI framework with hooks for functional components
- **FlexLayout React**: Flexible tabbed layout system with drag-and-drop
- **Xterm.js**: Terminal emulation with WebGL rendering support
- **Monaco Editor**: Code editor (via @monaco-editor/react)
- **Node PTY**: Pseudo-terminal spawning (@lydell/node-pty)
- **electron-store**: Configuration and state persistence
- **Vite**: Build tool and dev server

---

## Terminal Management System

### 1. Terminal Spawning and Creation

#### Main Process Handler
**File**: `src/main.js` (Lines 93-130)

```javascript
ipcMain.handle('create-terminal', (event, terminalId) => {
  // Check for existing terminal
  if (terminals.has(terminalId)) {
    return {success: true, existed: true};
  }
  
  // Determine shell based on platform
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
  
  // Spawn PTY process
  const terminal = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOMEPATH,
    env: process.env
  });
  
  // Store terminal in map
  terminals.set(terminalId, terminal);
  
  // Set up event handlers...
});
```

**Key Features**:
- Platform-aware shell selection (cmd.exe on Windows, bash on Unix)
- PTY spawned with xterm-color compatibility
- Initial dimensions: 80 columns × 30 rows
- Terminals stored in `Map` keyed by `terminalId`

#### Terminal Data Flow
1. **Data from Shell to Frontend**:
   - PTY emits `onData` events
   - Main process sends via IPC: `mainWindow.webContents.send('terminal-data', terminalId, data)`
   - Frontend receives and writes to xterm instance

2. **Data from Frontend to Shell**:
   - Frontend captures user input on xterm
   - Sends via IPC: `window.electronAPI.writeTerminal(terminalId, data)`
   - Main process writes to PTY: `terminal.write(data)`

3. **Terminal Exit**:
   - PTY emits `onExit` event
   - Main process notifies frontend: `mainWindow.webContents.send('terminal-exit', terminalId)`
   - Frontend displays "[Process completed]" message

### 2. Terminal Identification and Tracking

**Identification Scheme**: String-based IDs like `terminal-1`, `terminal-2`, etc.

**Storage**:
- Main Process: `const terminals = new Map()` (Line 11)
- Frontend: Counter-based generation (`terminalCounter` in App.jsx)
- Persistence: Layout JSON includes terminal IDs in tab definitions

**Lifecycle**:
1. App renders with default or saved layout
2. TerminalComponent mounts with `terminalId` prop
3. Component calls `window.electronAPI.createTerminal(terminalId)`
4. Main process creates PTY and stores in Map
5. Component receives data events and renders output
6. On unmount/close, component calls `window.electronAPI.closeTerminal(terminalId)`

### 3. IPC Interface for Terminal Operations

**File**: `src/preload.js` (Lines 5-8, 11-23)

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  createTerminal: (terminalId) => ipcRenderer.invoke('create-terminal', terminalId),
  writeTerminal: (terminalId, data) => ipcRenderer.invoke('write-terminal', terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
  closeTerminal: (terminalId) => ipcRenderer.invoke('close-terminal', terminalId),
  
  onTerminalData: (callback) => { /* wraps terminal-data event */ },
  onTerminalExit: (callback) => { /* wraps terminal-exit event */ },
  
  removeListener: (channel, listener) => { /* cleanup */ }
});
```

**IPC Handlers in Main Process**:

| Handler | File | Lines | Purpose |
|---------|------|-------|---------|
| `create-terminal` | src/main.js | 94-130 | Spawn PTY process, set up event handlers |
| `write-terminal` | src/main.js | 132-141 | Write user input to PTY |
| `resize-terminal` | src/main.js | 143-150 | Resize PTY when terminal window changes |
| `close-terminal` | src/main.js | 152-163 | Kill PTY process and clean up |

---

## Frontend Terminal Component

### TerminalComponent.jsx
**File**: `src/components/TerminalComponent.jsx` (221 lines)

#### Component Props
- `terminalId`: Unique identifier (e.g., "terminal-1")
- `onResize`: Callback for terminal resize
- `registerFocusable`: Register with focus manager
- `unregisterFocusable`: Unregister from focus manager

#### Lifecycle Hooks

1. **Initialization** (Lines 13-162):
   - Create xterm instance with theme and settings
   - Load FitAddon for responsive sizing
   - Load WebglAddon (with canvas fallback)
   - Set up event handlers for data and exit
   - Create terminal in main process via IPC
   - Set up input handler (terminal.onData)
   - Cleanup on unmount

2. **Focus Management** (Lines 164-180):
   - Register focus function with parent component
   - Unregister on unmount

3. **Layout Resize Handling** (Lines 183-208):
   - Listen to window resize events
   - Trigger FitAddon to recalculate dimensions
   - Send resize event to main process

#### Key Implementation Details

**Async Initialization**:
```javascript
const openTerminal = () => {
  if (terminalRef.current && terminalRef.current.offsetWidth > 0) {
    terminal.open(terminalRef.current);
    fitAddon.fit();
  } else {
    setTimeout(openTerminal, 10); // Retry if container not sized
  }
};
```

**Event Listener Cleanup** (Lines 138-146):
```javascript
// Remove only specific listeners for this terminal
if (dataListener) {
  window.electronAPI.removeListener('terminal-data', dataListener);
}
if (exitListener) {
  window.electronAPI.removeListener('terminal-exit', exitListener);
}
```

---

## Configuration and State Management

### 1. electron-store Integration

**File**: `src/main.js` (Lines 69-72)

```javascript
app.whenReady().then(async () => {
  const Store = (await import('electron-store')).default;
  store = new Store();
  createWindow();
});
```

**Stored Data**:
- `bounds`: Window size and position (auto-saved on resize/move, Lines 40-50)
- `layout`: Complete layout JSON with component state (Lines 166-177)

**Storage Location**: Platform-dependent (typically `~/.config/[app-name]/config.json`)

### 2. Layout Persistence

#### Saving Layout
**File**: `src/App.jsx` (Lines 281-312)

IPC Handler: `ipcMain.handle('save-layout', ...)`
- Triggered by: `onModelChange` callback from FlexLayout
- Process:
  1. Convert FlexLayout model to JSON
  2. Recursively embed editor states in tab config
  3. Send to main process via IPC
  4. Store in electron-store

**Layout JSON Structure**:
```json
{
  "global": { /* FlexLayout settings */ },
  "borders": [],
  "layout": {
    "type": "row|column|tabset",
    "children": [
      {
        "type": "tab",
        "id": "terminal-1",
        "name": "Terminal 1",
        "component": "terminal",
        "config": {} // For editors: {editorContent, editorLanguage}
      }
    ]
  }
}
```

#### Loading Layout
**File**: `src/App.jsx` (Lines 68-143)

IPC Handler: `ipcMain.handle('load-layout', ...)`
- Triggered on: Component mount
- Process:
  1. Request layout from electron-store via IPC
  2. Parse layout JSON and extract editor states
  3. Update component counters based on highest tab numbers
  4. Create FlexLayout Model from JSON
  5. Set component state

---

## Window Management

### Window Configuration
**File**: `src/main.js` (Lines 14-34)

```javascript
mainWindow = new BrowserWindow({
  width: bounds.width,
  height: bounds.height,
  x: bounds.x,
  y: bounds.y,
  frame: false,              // Frameless window
  transparent: true,
  acrylic: true,            // Windows-specific transparency
  preload: path.join(__dirname, 'preload.js')
});
```

### Window Bounds Persistence
**File**: `src/windowUtils.js`

Functions:
- `getDefaultBounds()`: Calculate 50% screen height, full width
- `getBounds(store)`: Retrieve saved bounds 
