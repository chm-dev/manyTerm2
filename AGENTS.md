# FlexClaude Terminal - Agent Development Guide

This document provides comprehensive guidelines for AI coding agents working on the FlexClaude Terminal codebase. It includes build commands, code style conventions, and development practices.

## Build, Lint, and Test Commands

### Development
```bash
npm run dev          # Start development mode (React + Electron concurrently)
npm run dev:react    # Start Vite dev server only (port 5173)
npm run dev:electron # Start Electron only (waits for Vite server)
```

### Building
```bash
npm run build        # Production build (outputs to build/)
npm run build:electron # Package Electron app (outputs to dist/)
```

### Testing
No dedicated test framework is currently configured. The project mentions Playwright MCP for UI testing:

```bash
# Use Playwright MCP to connect to the Electron app and verify changes
# Test each significant change by running the app and confirming functionality
```

**Note:** There is no dedicated linting command. Code style is enforced through manual review and the guidelines below.

## Code Style Guidelines

### Language and Framework
- **JavaScript Only**: Use plain JavaScript with ES6+ features (no TypeScript)
- **React Functional Components**: Use functional components with hooks only (no class components)
- **React 18+ Features**: Leverage concurrent rendering and automatic batching

### File Structure and Naming
```
src/
├── components/     # PascalCase with .jsx extension
│   ├── TerminalComponent.jsx
│   ├── EditorComponent.jsx
│   ├── SpreadsheetComponent.jsx  # @fortune-sheet/react based spreadsheet
│   ├── TopBar.jsx                # Collapsible toolbar (Ctrl+T to toggle)
│   ├── ShellButton.jsx           # Draggable shell-selector button
│   └── TestDragButton.jsx        # Drag-and-drop testing helper
├── hooks/         # camelCase with .js extension (useFocusManager.js)
├── scss/          # snake_case with .scss extension
├── shellConfig.js # Platform shell definitions and validation helpers
├── *.js           # Electron main process utilities
└── *.jsx          # React entry points
```

### Import Organization
```javascript
// 1. React/React DOM imports
import React, { useState, useEffect } from 'react';

// 2. Third-party library imports (alphabetical)
import { Layout, Model } from 'flexlayout-react';
import { Terminal } from '@xterm/xterm';

// 3. Local imports (relative paths)
import TerminalComponent from './components/TerminalComponent.jsx';
import './scss/style.scss';
```

### Component Patterns

#### Functional Components with Hooks
```javascript
const MyComponent = ({ prop1, prop2, onEvent }) => {
  const [state, setState] = useState(initialValue);
  const ref = useRef(null);

  useEffect(() => {
    // Side effects with proper cleanup
    const cleanup = () => { /* cleanup logic */ };
    return cleanup;
  }, [dependencies]);

  return (
    <div className="component">
      {/* JSX content */}
    </div>
  );
};
```

#### Props Destructuring
```javascript
// ✅ Preferred
const Component = ({ id, name, onChange, className }) => {

// ❌ Avoid
const Component = (props) => {
  const { id, name, onChange, className } = props;
```

### Naming Conventions

#### Variables and Functions
- **camelCase**: `terminalId`, `handleResize`, `isReady`
- **Descriptive names**: `terminalCounter` not `count`, `handleEditorContentChange` not `onChange`

#### Components and Files
- **PascalCase**: `TerminalComponent.jsx`, `EditorComponent.jsx`
- **Descriptive**: `FileManagerComponent` not `FileComp`

#### Constants
- **UPPER_SNAKE_CASE**: `DEFAULT_LAYOUT`, `TERMINAL_THEME`

### Code Formatting

#### Indentation and Spacing
- **2 spaces** for indentation (no tabs)
- **Consistent spacing** around operators and after commas
- **Single quotes** for strings (except JSX attributes use double quotes)
- **Trailing commas** in multi-line objects/arrays

```javascript
// ✅ Correct
const config = {
  theme: {
    background: '#1e1e1e',
    foreground: '#cccccc',
  },
  fontSize: 14,
};

// ❌ Incorrect
const config={
  theme:{
    background:'#1e1e1e',
    foreground:'#cccccc'
  },
  fontSize:14
};
```

#### JSX Formatting
```jsx
// ✅ Correct
return (
  <div className="container">
    <TerminalComponent
      key={id}
      terminalId={id}
      onResize={handleResize}
    />
  </div>
);

// ❌ Incorrect
return (<div className="container"><TerminalComponent key={id} terminalId={id} onResize={handleResize}/></div>);
```

### Error Handling

#### Async Operations
```javascript
useEffect(() => {
  const loadData = async () => {
    try {
      const result = await window.electronAPI.loadLayout();
      if (result.success) {
        // Handle success
      } else {
        console.error('Failed to load:', result.error);
      }
    } catch (err) {
      console.error('Error loading layout:', err);
    }
  };
  loadData();
}, []);
```

#### WebGL Fallback Pattern
```javascript
try {
  const webglAddon = new WebglAddon();
  terminal.loadAddon(webglAddon);
  console.log('WebGL renderer loaded successfully');
} catch (error) {
  console.warn('WebGL not supported, falling back to canvas:', error);
}
```

### Event Handling and Cleanup

#### IPC Communication
```javascript
useEffect(() => {
  let dataListener = null;

  if (window.electronAPI) {
    const dataHandler = (id, data) => {
      if (id === terminalId) {
        // Handle data
      }
    };

    // Store listener reference for cleanup
    dataListener = window.electronAPI.onTerminalData(dataHandler);
  }

  return () => {
    // Proper cleanup
    if (dataListener) {
      window.electronAPI.removeListener('terminal-data', dataListener);
    }
  };
}, [terminalId]);
```

#### ResizeObserver Pattern
```javascript
const resizeObserver = new ResizeObserver(handleResize);
if (elementRef.current) {
  resizeObserver.observe(elementRef.current);
}

return () => {
  resizeObserver.disconnect();
};
```

### State Management

#### Local Component State
```javascript
const [editorStates, setEditorStates] = useState({});
const [isTopBarVisible, setIsTopBarVisible] = useState(false);
```

#### Complex State Updates
```javascript
setEditorStates(prevStates => ({
  ...prevStates,
  [editorId]: {
    ...(prevStates[editorId] || { language: 'javascript' }),
    content: newContent
  }
}));
```

### FlexLayout Integration

#### Model Checking
```javascript
// Always check if model exists before rendering
if (!model) return null;

// Or conditionally render
{model && (
  <Layout
    model={model}
    factory={factory}
    onModelChange={handleModelChange}
  />
)}
```

#### Component Factory Pattern
All heavy components are wrapped in `React.lazy` + `Suspense`. The factory passes the tab config through so components receive shell/editor/spreadsheet state:

```javascript
const factory = node => {
  const component = node.getComponent();
  const id = node.getId();
  const config = node.getConfig();

  switch (component) {
    case 'terminal':
      return (
        <Suspense fallback={<div className="terminal-container" />}>
          <TerminalComponent key={id} terminalId={id} shellId={config?.shellId} ... />
        </Suspense>
      );
    case 'editor':
      return <Suspense ...><EditorComponent key={id} editorId={id} ... /></Suspense>;
    case 'spreadsheet':
      return <Suspense ...><SpreadsheetComponent key={id} spreadsheetId={id} ... /></Suspense>;
    default:
      return <div>Unknown component: {component}</div>;
  }
};
```

### Terminal Component Specifics

#### Async Initialization
```javascript
const [isReady, setIsReady] = useState(false);

// Wait for container sizing before opening terminal
const openTerminal = () => {
  if (containerRef.current && containerRef.current.offsetWidth > 0) {
    terminal.open(containerRef.current);
    fitAddon.fit();
    setIsReady(true);
  } else {
    setTimeout(openTerminal, 10);
  }
};
```

#### Terminal Lifecycle
```javascript
// 1. Create terminal in main process (shellId is optional; falls back to system default)
await window.electronAPI.createTerminal(terminalId, shellId);

// 2. Set up input handling
const inputDisposable = terminal.onData((data) => {
  window.electronAPI.writeTerminal(terminalId, data);
});

// 3. Handle cleanup
return () => {
  inputDisposable.dispose();
  window.electronAPI.closeTerminal(terminalId);
  terminal.dispose();
};
```

### Shell Management

Shell selection is handled by the `ShellManager` class in `main.js` and configured via `src/shellConfig.js`. The config file defines default shells per platform (Windows: cmd, powershell, wps, wsl; Unix: bash, zsh, fish, sh) and detects the user's system shell via `$SHELL`.

When adding new shell-related features:
- Add shell definitions to `shellConfig.js` (follow the existing structure with `id`, `name`, `executable`, `args`, `cwd`, `env`, `icon`)
- Use `shell.id` as the stable identifier throughout (stored in tab config as `shellId`)
- Retrieve available shells via `window.electronAPI.getAvailableShells()` in the frontend

### Styling with SCSS

#### CSS Variables for Theming
```scss
:root {
  --bg-primary: #{$color_background};
  --text-primary: #cccccc;
  --accent-color: #007acc;
  --border-color: #3e3e42;
}
```

#### Component-Specific Styles
```scss
.terminal-container {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}
```

#### BEM-like Naming (Optional)
```scss
.app {
  &-container {
    display: flex;
    flex-direction: column;
  }

  &-header {
    background: var(--bg-secondary);
  }
}
```

### Focus Management

#### Register/Unregister Pattern
```javascript
useEffect(() => {
  if (registerFocusable && componentRef.current) {
    const focusFunction = () => componentRef.current.focus();
    registerFocusable(componentId, focusFunction, 'component-type');

    return () => {
      unregisterFocusable(componentId);
    };
  }
}, [componentId, registerFocusable, unregisterFocusable]);
```

### Security and Best Practices

#### IPC Security
- Use `ipcRenderer.invoke()` for request/response patterns
- Use `ipcRenderer.on()` for event subscriptions
- Always validate IPC message parameters
- Clean up event listeners properly

#### Secrets and Keys
- Never commit secrets or API keys to the repository
- Use environment variables for sensitive configuration
- Store user data securely via `electron-store`

### Comments and Documentation

#### When to Comment
- Complex business logic that isn't self-explanatory
- Workarounds for browser/Electron limitations
- Integration points with external APIs

#### Comment Style
```javascript
// Single line comments for brief explanations
/*
  Multi-line comments for complex logic
  explaining why something is done this way
*/

// TODO: Future enhancement
// FIXME: Known issue to address
```

#### Avoid Redundant Comments
```javascript
// ❌ Don't comment obvious code
const count = 0; // Set count to zero

// ✅ Comment non-obvious intent
const count = 0; // Reset counter for new terminal session
```

## GitHub Copilot Instructions

The project includes comprehensive AI development guidelines in `.github/copilot-instructions.md`. Key points:

- **Architecture**: Electron main process + React frontend with FlexLayout
- **Technology Stack**: Xterm.js, Monaco Editor, FlexLayout React
- **Component Patterns**: Register/unregister focusable elements, ID-based identification
- **IPC Patterns**: Proper event cleanup and state synchronization
- **Terminal Integration**: Async initialization with WebGL fallback

## Development Workflow

1. **Start Development**: `npm run dev`
2. **Make Changes**: Follow code style guidelines above
3. **Test Changes**: Use Playwright MCP to verify functionality
4. **Build for Production**: `npm run build && npm run build:electron`
5. **Code Review**: Ensure changes align with architectural patterns

## Common Patterns and Gotchas

- **Model Loading**: Layout model loads asynchronously from electron-store
- **Terminal Sizing**: Use ResizeObserver and FitAddon for proper terminal dimensions
- **Drag & Drop**: Implement `onExternalDrag` for external drag operations; use a ref to cache drag data because `getData()` is blocked during `dragover`
- **Shell Drag**: ShellButton uses `application/shellid` MIME type; shell ID is cached in `currentShellDragIdRef` during `dragstart`
- **State Persistence**: Save layout JSON with embedded component state (editor content, spreadsheet data, shell IDs preserved in tab config)
- **WebGL Fallback**: Always include try/catch for WebGL addon loading
- **Event Cleanup**: Return cleanup functions from useEffect hooks
- **IPC Listeners**: Store listener references for proper removal
- **Spreadsheet Resize**: Dispatch synthetic `window resize` event to notify fortune-sheet of panel size changes
- **Lazy Loading**: All heavy components use `React.lazy` + `Suspense`; provide a matching fallback `<div className="...-container" />`
- **Terminal Auto-close**: `onProcessExit` prop on TerminalComponent triggers `Actions.deleteTab` in App.jsx when the PTY exits</content>
<parameter name="filePath">C:\dev\AI\FlexClaude2\AGENTS.md