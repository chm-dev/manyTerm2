# FlexClaude Terminal - Architecture Summary

## Overview
FlexClaude Terminal is an Electron-based terminal emulator with a flexible, drag-and-drop layout system built on React and FlexLayout. It supports multiple terminals, editors, and spreadsheets in a customizable tabbed interface.

## Core Architecture

### Technology Stack
- **Electron**: Cross-platform desktop application framework
- **React 18**: UI framework with hooks for functional components
- **FlexLayout React**: Flexible tabbed layout system with drag-and-drop
- **Xterm.js**: Terminal emulation with WebGL rendering support
- **Monaco Editor**: Code editor (via @monaco-editor/react)
- **Fortune Sheet**: Spreadsheet component (via @fortune-sheet/react)
- **Node PTY**: Pseudo-terminal spawning (@lydell/node-pty)
- **electron-store**: Configuration and state persistence
- **Vite**: Build tool and dev server

---

## Terminal Management System

### 1. Terminal Spawning and Creation

#### Main Process Handler
**File**: `src/main.js`

```javascript
ipcMain.handle('create-terminal', (event, terminalId, shellId) => {
  // Check for existing terminal
  if (terminals.has(terminalId)) {
    return { success: true, existed: true };
  }

  // Delegate to ShellManager (resolves shell config, validates executable)
  const spawnResult = shellManager.spawnTerminal(terminalId, shellId);
  if (!spawnResult.success) {
    return spawnResult;
  }

  const terminal = spawnResult.terminal;
  terminals.set(terminalId, terminal);

  // Set up event handlers...
});
```

**Key Features**:
- Shell selection delegated to `ShellManager` (see Shell Management section)
- `shellId` parameter is optional; falls back to system-detected default
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
  // Terminal lifecycle
  createTerminal: (terminalId, shellId) => ipcRenderer.invoke('create-terminal', terminalId, shellId),
  writeTerminal: (terminalId, data) => ipcRenderer.invoke('write-terminal', terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
  closeTerminal: (terminalId) => ipcRenderer.invoke('close-terminal', terminalId),

  // Shell configuration
  getAvailableShells: () => ipcRenderer.invoke('get-available-shells'),

  // Events (return wrapped listener for targeted removal)
  onTerminalData: (callback) => { /* wraps terminal-data; returns listener ref */ },
  onTerminalExit: (callback) => { /* wraps terminal-exit; returns listener ref */ },

  // Cleanup
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),

  // Window & persistence
  windowControl: (action) => ipcRenderer.invoke('window-control', action),
  saveLayout: (layoutJson) => ipcRenderer.invoke('save-layout', layoutJson),
  loadLayout: () => ipcRenderer.invoke('load-layout'),
});
```

**IPC Handlers in Main Process**:

| Handler | File | Purpose |
|---------|------|---------|
| `create-terminal` | src/main.js | Spawn PTY via ShellManager, set up event handlers |
| `get-available-shells` | src/main.js | List validated shells for UI display |
| `write-terminal` | src/main.js | Write user input to PTY |
| `resize-terminal` | src/main.js | Resize PTY when terminal window changes |
| `close-terminal` | src/main.js | Kill PTY process and clean up |
| `save-layout` | src/main.js | Persist FlexLayout JSON to electron-store |
| `load-layout` | src/main.js | Retrieve FlexLayout JSON from electron-store |
| `window-control` | src/main.js | Minimize / maximize / close window |

---

## Frontend Terminal Component

### TerminalComponent.jsx
**File**: `src/components/TerminalComponent.jsx` (221 lines)

#### Component Props
- `terminalId`: Unique identifier (e.g., "terminal-1")
- `shellId`: Optional shell identifier passed through from tab config (e.g., `"bash"`, `"zsh"`)
- `onResize`: Callback invoked with `(cols, rows)` after each resize
- `onProcessExit`: Callback invoked when the underlying PTY exits; App.jsx uses this to auto-close the tab
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
- `getBounds(store)`: Retrieve saved bounds or fall back to defaults

---

## Shell Management System

### ShellManager (main process)
**File**: `src/main.js` — `ShellManager` class

Instantiated once after electron-store is ready. Responsibilities:
- Load and validate shells from `shellConfig.js`
- Detect the system default shell (`$SHELL` on Unix)
- Spawn PTY processes with the correct executable and arguments
- Persist user-customised shell configs to `electron-store` under the `shells` key

```javascript
class ShellManager {
  constructor(electronStore) { ... }
  initializeAvailableShells() { /* validates executables on disk */ }
  getShell(shellId)           { /* returns shell config by ID or default */ }
  listAvailable()             { /* returns validated shell array for UI */ }
  spawnTerminal(termId, shellId) { /* pty.spawn with resolved config */ }
  updateConfig(newConfig)     { /* save user overrides to store */ }
}
```

### Shell Configuration
**File**: `src/shellConfig.js`

Key exports:
- `DEFAULT_SHELLS_WINDOWS` — cmd, powershell (pwsh), wps (Windows PowerShell), wsl
- `DEFAULT_SHELLS_UNIX` — bash, zsh, fish, sh
- `detectSystemShell()` — reads `$SHELL` env var on Unix
- `listAvailableShells(userConfig)` — merges defaults with user overrides, validates executable paths
- `getShellConfig(shellId, userConfig)` — resolves a single shell, falling back to detected system default
- `resolveEnvVariables(str)` — expands `${VAR}` placeholders in config strings
- `getSpawnOptions(shellConfig)` — builds the `pty.spawn` options object

### ShellButton Component
**File**: `src/components/ShellButton.jsx`

A draggable `<button>` that appears in the TopBar for each available shell. Dragging a ShellButton onto the layout creates a new split terminal with that shell. Uses the custom MIME type `application/shellid` to transfer the shell ID during drag. The App.jsx `onExternalDrag` handler reads `currentShellDragIdRef` (populated on `dragstart`) to avoid the browser's security restriction that blocks `getData()` during `dragover`.

---

## SpreadsheetComponent

**File**: `src/components/SpreadsheetComponent.jsx`

Embeds a full spreadsheet via `@fortune-sheet/react` (`<Workbook>`). Key behaviours:

- **Initialisation**: Data loaded from `initialData` prop (array of sheet objects with `name`, `data`, `celldata` fields). Normalized by `normalizeSpreadsheetData()` in App.jsx.
- **Persistence**: `onOp` callback schedules `persistWorkbookData()` via a 50 ms `setTimeout` (macrotask, after React commits). Calls `onDataChange(spreadsheetId, data)` which triggers layout save in App.jsx.
- **Resize**: Dispatches a synthetic `window resize` event so fortune-sheet recalculates its own dimensions when the FlexLayout panel resizes.
- **Layout revision**: Accepts a `layoutRevision` prop (incremented by `handleModelChange` in App.jsx) to force re-renders after drag-and-drop.

### Props
- `spreadsheetId`: Unique identifier
- `layoutRevision`: Integer bumped on every model change to trigger size recalculation
- `initialData`: Array of sheet objects (fortune-sheet format)
- `onDataChange(id, data)`: Called when sheet data changes (triggers layout save)
- `registerFocusable` / `unregisterFocusable`: Focus manager integration

---

## TopBar Component

**File**: `src/components/TopBar.jsx`

A collapsible toolbar hidden by default, toggled with `Ctrl+T`. Contains:
- **Component buttons**: click or drag `terminal`, `editor`, `spreadsheet` tiles to add/drop them into the layout
- **ShellButton list**: dynamically populated from `getAvailableShells()` IPC call on mount; each button is draggable
- **Window controls**: minimize / maximize / close via `windowControl` IPC

### Drag-and-Drop from TopBar
Component tiles set `text/plain` to `"FlexLayoutTab:" + JSON.stringify(tabJson)` and call `onStartDrag(tabJson)` to store the data in `currentDragData` state (needed because `getData()` is blocked during `dragover`). The FlexLayout `onExternalDrag` prop in App.jsx reads `currentDragData` to return the correct tab descriptor.

---

## App.jsx State Summary

| State | Type | Purpose |
|-------|------|---------|
| `model` | FlexLayout Model \| null | Layout model; null until async load completes |
| `terminalCounter` | number | Tracks highest terminal index for unique IDs |
| `editorCounter` | number | Tracks highest editor index |
| `spreadsheetCounter` | number | Tracks highest spreadsheet index |
| `editorStates` | object | `{ [editorId]: { content, language } }` |
| `spreadsheetStates` | object | `{ [spreadsheetId]: { data } }` (also mirrored in `spreadsheetStatesRef`) |
| `layoutRevision` | number | Incremented on every model change; passed to SpreadsheetComponent |
| `isTopBarVisible` | boolean | TopBar shown/hidden (toggle with Ctrl+T) |
| `currentDragData` | object \| null | Drag payload for FlexLayout external drag |

### Component Lazy Loading
All four heavy components are loaded with `React.lazy` + `Suspense` to reduce initial bundle size:
```javascript
const TerminalComponent   = lazy(() => import('./components/TerminalComponent.jsx'));
const EditorComponent     = lazy(() => import('./components/EditorComponent.jsx'));
const SpreadsheetComponent = lazy(() => import('./components/SpreadsheetComponent.jsx'));
const TopBar              = lazy(() => import('./components/TopBar.jsx'));
```
