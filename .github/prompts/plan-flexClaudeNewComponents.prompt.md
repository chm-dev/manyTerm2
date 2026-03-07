# FlexClaude Terminal - New Components Plan

## Overview
A curated set of lightweight, single-purpose components to enhance FlexClaude Terminal for mixed audience (developers, DevOps engineers, sysadmins). Prioritizes development efficiency, system monitoring, and UI/UX improvements.

---

## Development Efficiency Components

### 1. Search Component (`SearchComponent.jsx`)
**Purpose**: Find-in-terminal and cross-file search capability

**Features**:
- Find-in-terminal (Ctrl+F for active terminal)
- File search across directory with regex support
- Syncs with FileManager and active terminal
- Minimal footprint, no external terminals needed

**Integration Points**:
- useRef to track active terminal from focus manager
- IPC call to search filesystem via main process
- Results highlight in active component

**State Management**:
- `searchQuery`: Current search string
- `searchResults`: Array of matches
- `activeResultIndex`: Currently highlighted result

---

### 2. QuickNotes Component (`QuickNotesComponent.jsx`)
**Purpose**: Lightweight markdown notepad for quick thoughts and snippets

**Features**:
- Markdown notepad for jotting down command reminders, TODOs, API endpoints
- Persists with layout state (embedded in tab node config)
- Can be kept compact as side panel
- Simple formatting (bold, code blocks, lists)

**Integration Points**:
- Saves content to `editorStates` pattern (via App.jsx callback)
- New layout node type `component: 'notes'`

**State Management**:
- `noteContent`: Markdown text
- `isSaved`: Dirty tracking for persistence

---

### 3. Git Status Component (`GitStatusComponent.jsx`)
**Purpose**: Show git repository status without leaving UI

**Features**:
- Current branch, staged/unstaged changes, unpushed commits
- Refreshes on file changes via FileManager
- Quick visual indicators (colors for conflicts, etc.)
- Uses git CLI in background (lightweight, no new dependencies)

**Integration Points**:
- IPC handler: `getGitStatus(repoPath)` - spawns `git status --porcelain`
- Syncs with FileManager path changes
- Watches working directory for git changes

**State Management**:
- `currentBranch`: String
- `stagedChanges`: Number
- `unstagedChanges`: Number
- `unpushedCommits`: Number
- `lastRefresh`: Timestamp to debounce updates

---

### 4. Command History/Palette Component (`CommandPaletteComponent.jsx`)
**Purpose**: Quick access to command history and favorites across sessions

**Features**:
- Persists command history from all terminals across sessions
- Favorites/pinned commands for quick retrieval (Ctrl+P style)
- Search and execute with one click
- Tag-based organization (bash, powershell, system, custom)

**Integration Points**:
- Listens to terminal data (all terminals feed into history)
- IPC: `executeCommand(commandText, terminalId)` to run selected command
- Stored in electron-store with timestamp metadata
- Tab node config stores favorites list

**State Management**:
- `commandHistory`: Array of {text, timestamp, shell, tags}
- `favorites`: Array of pinned commands
- `filterTag`: Current filter (all, bash, powershell, etc.)
- `searchQuery`: Palette search filter

---

## System Monitoring Components

### 5. System Metrics Widget (`SystemMetricsComponent.jsx`)
**Purpose**: Real-time CPU, RAM, disk usage display

**Features**:
- CPU, RAM, disk usage display (update every 2s)
- Platform-aware (Windows, macOS, Linux via `os` module)
- Compact sidebar-friendly format
- Historical trend sparklines (optional)
- No external tools needed (uses Node.js `os` module)

**Integration Points**:
- IPC handler: `getSystemMetrics()` - calls `os.cpus()`, `os.freemem()`, etc.
- Timer loop for periodic updates
- No file system calls needed

**State Management**:
- `cpuUsage`: Percentage or array of per-core usage
- `memoryUsage`: {used, total, percent}
- `diskUsage`: {used, total, percent}
- `updateInterval`: 2000ms (configurable)
- `history`: Optional array for sparklines

---

### 6. Process Monitor Component (`ProcessMonitorComponent.jsx`)
**Purpose**: View and manage running processes

**Features**:
- List running processes with CPU/memory consumption
- Kill processes from UI with confirmation
- Search/filter by name or PID
- Useful for DevOps/sysadmins monitoring background services
- Platform-aware process listing

**Integration Points**:
- IPC handler: `getProcessList()` - uses `child_process.execSync('tasklist')` or `ps aux`
- IPC handler: `killProcess(pid)` - terminates process
- Refresh on interval or manual trigger

**State Management**:
- `processes`: Array of {pid, name, cpu, memory, command}
- `filterText`: Search/filter input
- `sortBy`: Column to sort (pid, name, cpu, memory)
- `selectedProcess`: Highlighted process for action

---

### 7. Log Viewer Component (`LogViewerComponent.jsx`)
**Purpose**: Tail and view log files with live updates

**Features**:
- Tail files with live updates (follow logs like `tail -f`)
- Configurable refresh rate
- Filter by keyword/regex
- Opens syslog/application logs without dedicated terminal
- Save filtered results to clipboard or file

**Integration Points**:
- IPC handler: `tailFile(filePath, lines)` - returns last N lines
- Listener: `log-file-update` event for live data streaming
- FileManager integration: double-click log files to open in viewer

**State Management**:
- `filePath`: Currently viewed log file
- `logLines`: Array of log entries
- `filterRegex`: Regex filter for display
- `autoScroll`: Boolean for following new lines
- `isLive`: Whether watching for updates

---

## UI/UX Improvement Components

### 8. Theme Switcher Component (`ThemeSwitcherComponent.jsx`)
**Purpose**: Allow users to switch between dark/light/custom themes

**Features**:
- Toggle between light/dark/system-default themes
- Stores selection in electron-store
- Updates CSS variables globally
- Preview before applying
- Foundation for user-created themes

**Integration Points**:
- Updates CSS custom properties on `document.documentElement.style`
- Persists theme choice in electron-store's `preferences.theme`
- Global stylesheet definitions in `colors.module.scss`

**State Management**:
- `currentTheme`: 'dark' | 'light' | 'system'
- `availableThemes`: Array of theme definitions
- `customThemes`: User-created themes (optional)

---

### 9. Keyboard Shortcuts Panel (`ShortcutsComponent.jsx`)
**Purpose**: Display available shortcuts and reduce learning curve

**Features**:
- Displays all available shortcuts (Ctrl+Tab, Alt+\`, etc.)
- Searchable, filterable by category (navigation, terminal, editor, window)
- Customizable keybindings (future enhancement)
- Non-intrusive info sidebar
- Printable shortcut reference

**Integration Points**:
- Static shortcuts data + dynamically loaded from preferences
- No external data needed (hardcoded reference)
- View-only in MVP, customization in v2

**State Management**:
- `shortcuts`: Array of {keys, action, description, category}
- `activeFilter`: Category filter
- `searchText`: Shortcut search

---

### 10. Session Manager Component (`SessionManagerComponent.jsx`)
**Purpose**: Save/load workspace layouts as named sessions

**Features**:
- Save current layout as named "session" (e.g., "FrontendDev", "DevOps", "Learning")
- Quick switch between project-specific layouts
- Clone existing sessions as templates
- Delete unused sessions
- Auto-save current session on exit

**Integration Points**:
- Extends Layout persistence to user-friendly presets
- Stores in electron-store `sessions` key alongside current layout
- IPC: `saveSession(name, layoutJson)` and `loadSession(name)`
- TopBar gets session dropdown/quick-switch

**State Management**:
- `sessions`: Array of {name, layout, createdAt, lastUsed}
- `currentSession`: Currently active session name
- `showSessionMenu`: UI visibility toggle

---

## Utility Components

### 11. Terminal Splitter Helper (`TerminalSplitComponent.jsx`)
**Purpose**: Quick buttons to create linked terminal pairs

**Features**:
- Buttons to spawn terminals with:
  - Same shell type as active terminal
  - Same working directory
  - Arranged side-by-side or top-bottom in layout
- Quick helper for multi-terminal workflows
- Bridges lack of native terminal splitting in FlexLayout

**Integration Points**:
- Gets active terminal ID from focus manager
- Creates new terminal via existing `createTerminal` IPC
- Infers shell from active terminal's config
- Modifies layout model directly (like TopBar buttons)

**State Management**:
- `activeTerminalId`: To read shell/directory info
- `splitDirection`: 'horizontal' | 'vertical'

---

### 12. Environment Variables Editor (`EnvEditorComponent.jsx`)
**Purpose**: View and edit environment variables without text editor

**Features**:
- View/edit PATH, custom environment variables
- Apply per-shell or globally
- Platform-aware (Windows batch syntax vs. bash export)
- Syntax highlighting for bash/batch exports
- Export as `.env` file or shell-specific format

**Integration Points**:
- IPC handler: `getEnvironmentVariables(shellType)` - reads from shell config
- IPC handler: `setEnvironmentVariable(key, value, shellType)` - updates config
- ShellManager integration for persistence

**State Management**:
- `variables`: Object of {key: value}
- `shellType`: 'bash', 'powershell', 'cmd', etc.
- `scope`: 'global' | 'shell-specific'
- `isDirty`: Unsaved changes tracking

---

## Implementation Priority

### Phase 1 (High Impact, Lower Effort)
1. **Command History/Palette** - Highest UX win, 80% simple data storage
2. **Session Manager** - Solves multi-project workflow
3. **System Metrics Widget** - Visible value, minimal dependencies

### Phase 2 (Medium Impact, Medium Effort)
4. **Git Status Component** - Valuable for developers, uses CLI
5. **Log Viewer Component** - Powerful for DevOps
6. **Search Component** - Developer efficiency gain

### Phase 3 (Polish & Enhancement)
7. **Theme Switcher** - UI polish
8. **Keyboard Shortcuts Panel** - User education
9. **Process Monitor** - DevOps feature
10. **QuickNotes** - Power user feature
11. **Environment Variables Editor** - Advanced users
12. **Terminal Splitter Helper** - Workflow optimization

---

## Architectural Patterns

### Component Skeleton
All new components should follow:

```javascript
import React, { useState, useEffect, useRef } from 'react';

const NewComponent = ({ 
  componentId, 
  registerFocusable,    // From useFocusManager
  unregisterFocusable,  // From useFocusManager
  // Component-specific props passed by factory
}) => {
  const ref = useRef(null);
  const [state, setState] = useState(initialValue);

  // Register with focus manager
  useEffect(() => {
    if (registerFocusable && ref.current) {
      const focusFunc = () => ref.current?.focus();
      registerFocusable(componentId, focusFunc, 'component-type');
      return () => unregisterFocusable(componentId);
    }
  }, [componentId, registerFocusable, unregisterFocusable]);

  // IPC communication & external listeners
  useEffect(() => {
    const handleData = (data) => { /* ... */ };
    if (window.electronAPI) {
      const listener = window.electronAPI.onSomeEvent(handleData);
    }
    return () => {
      if (listener) window.electronAPI.removeListener('event', listener);
    };
  }, []);

  // Cleanup resources on unmount
  useEffect(() => {
    return () => { /* cleanup */ };
  }, []);

  return (
    <div ref={ref} className="new-component">
      {/* JSX */}
    </div>
  );
};

export default NewComponent;
```

### IPC Handler Pattern (main.js)
```javascript
ipcMain.handle('get-component-data', async (event, params) => {
  try {
    // Perform system operation
    const result = await someOperation(params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
});
```

### Factory Integration (App.jsx)
```javascript
const factory = (node) => {
  const component = node.getComponent();
  const id = node.getId();

  switch (component) {
    // ... existing cases ...
    case 'command-palette':
      return <CommandPaletteComponent key={id} componentId={id} 
                registerFocusable={registerFocusable}
                unregisterFocusable={unregisterFocusable} />;
    // ... more new cases ...
  }
};
```

---

## Storage & Persistence

### What Goes Where

**electron-store** (persisted in user data):
- Session layouts and names
- Command history (with timestamps)
- Favorite commands
- Theme preference
- Custom keybindings (future)
- Window state (already done)

**Layout Node Config** (embedded in layout JSON):
- Component-specific state that's layout-dependent:
  - Editor state (already done)
  - Notes content
  - Current log file path
  - Active filter settings

**Memory Only** (cleared on window close):
- Real-time metrics (CPU %, RAM)
- Live process list
- Current search results
- Active filter text

---

## UI/Layout Recommendations

### Component Sizing Guidelines
- **Sidebar panels** (Metrics, Git Status, Shortcuts, Session): min 250px, prefer 300-350px
- **Full-width panels** (Search, Log Viewer, Process Monitor): flexible width
- **Inline panels** (QuickNotes, Palette): 40% width when paired with terminal

### Keyboard Integration
- **Ctrl+P**: Open command palette (don't conflict with editor)
- **Ctrl+Shift+P**: Open session switcher
- **Ctrl+F**: Search (when terminal has focus)
- **Ctrl+`**: Theme switcher toggle (if not used)

---

## Risk Mitigation

### Dependency-Free Priority
Most recommended components use only Node.js built-ins:
- `os` module for system metrics
- `child_process` for shell commands
- `fs` for file operations (already used)
- No npm dependency bloat

### Graceful Degradation
- Metrics on unsupported platforms show "N/A"
- Git status disabled if not a git repo
- Process monitor skips unsupported process queries
- All components render empty state if system APIs fail

---

## Success Metrics

After implementation, success looks like:
✅ Command history reduces repeated typing significantly
✅ Session manager eliminates project context-switching pain
✅ Metrics widget serves as useful status bar
✅ Features benefit all three audience segments (devs, DevOps, sysadmins)
✅ No performance degradation in core terminal/editor functionality
✅ Each component adds <50KB to bundle size
