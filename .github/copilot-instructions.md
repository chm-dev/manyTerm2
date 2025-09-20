# FlexClaude Terminal - AI Development Guide

## Architecture Overview
This is an **Electron + React** desktop terminal emulator with a drag-and-drop layout system. Key components:
- **Electron main process** (`src/main.js`) manages terminals via `@lydell/node-pty` and window controls
- **React frontend** (`src/App.jsx`) orchestrates the FlexLayout-based UI with persistent state
- **IPC bridge** (`src/preload.js`) exposes secure APIs between Electron and React via `window.electronAPI`

## Core Technology Stack
- **FlexLayout React v0.7.15**: Drag-and-drop layout manager (docs: https://rawgit.com/caplin/FlexLayout/demos/demos/v0.8/typedoc/index.html)
- **Xterm.js v5.5+**: Terminal emulator with WebGL acceleration and fit addon
- **Monaco Editor**: VS Code editor component for embedded code editing
- **Electron Store**: Persistent layout and window state management

## Development Conventions

### JavaScript (Not TypeScript)
- Use **plain JavaScript** with modern ES6+ features
- **Functional components with hooks** only - no class components
- Use React 18+ features (concurrent rendering, automatic batching)

### Component Patterns
- **Register/unregister pattern**: Components must register focusable elements via `useFocusManager` hook
- **ID-based identification**: All terminals/editors use unique IDs (`terminal-1`, `editor-1`, etc.)
- **State synchronization**: Editor content/language state persisted through `editorStates` in App.jsx

### FlexLayout Integration
- **Model initialization**: Always check if `model` exists before rendering - it loads asynchronously from Electron store
- **Factory function**: Components are created via the `factory` function in App.jsx based on `node.getComponent()`
- **Drag/drop data**: Use `currentDragData` state for external drag operations
- **Config persistence**: Store component-specific data in tab node configs (e.g., `editorContent`, `editorLanguage`)

### Electron-React Communication
- **IPC patterns**: Use `ipcRenderer.invoke()` for request/response, `ipcRenderer.on()` for events
- **Terminal lifecycle**: Create → Write → Resize → Close via dedicated IPC handlers
- **Event cleanup**: Always return listener functions from preload.js for proper cleanup
- **State persistence**: Layout JSON automatically saved/loaded via `electron-store`

### Terminal Component Specifics
- **Async initialization**: Wait for container sizing before opening xterm terminal
- **WebGL fallback**: Always include try/catch for WebGL addon loading
- **Fit addon**: Essential for proper terminal sizing in flexible layouts
- **Data flow**: User input → onData → IPC → main process → pty → IPC → terminal.write()

## Key Development Commands
```bash
npm run dev          # Concurrent React dev server + Electron
npm run dev:react    # Vite dev server only (port 5173)
npm run dev:electron # Electron only (waits for Vite)
npm run build        # Production build to /build
```

## Global Shortcuts (Quake Mode)
- `Alt + `` `: Toggle window visibility (quake console mode)
- `Alt + Shift + `` `: Reset window to default size/position

## Common Patterns
- **Terminal creation**: Increment counter → Create FlexLayout tab → Register IPC handlers → Initialize xterm
- **Editor state management**: Content/language changes trigger both local state and parent callbacks for persistence
- **Layout changes**: Model updates automatically trigger re-renders and state persistence
- **Focus management**: Use `useFocusManager` for keyboard navigation between components

## File Structure Conventions
- `src/components/`: React components (Terminal, Editor, TopBar)
- `src/hooks/`: Custom React hooks (focus management)
- `src/*.js`: Electron main process utilities (global shortcuts, window utils, animations)

## Testing outcomes

Each significant change should be tested to ensure it was implemented correctly.
Use Playwright MCP to connect to the Electron app and verify that the change works as expected.