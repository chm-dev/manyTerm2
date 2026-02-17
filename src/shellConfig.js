const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * Default shell configurations per platform
 */
const DEFAULT_SHELLS_WINDOWS = {
  cmd: {
    id: 'cmd',
    name: 'Command Prompt',
    executable: 'cmd.exe',
    args: ['/k'],
    cwd: '${HOMEPATH}',
    env: {},
    icon: 'cmd',
  },
  powershell: {
    id: 'powershell',
    name: 'PowerShell 7',
    executable: 'pwsh.exe',
    args: ['-NoExit'],
    cwd: '${HOMEPATH}',
    env: {},
    icon: 'powershell',
  },
  wps: {
    id: 'wps',
    name: 'Windows PowerShell',
    executable: 'powershell.exe',
    args: ['-NoExit'],
    cwd: '${HOMEPATH}',
    env: {},
    icon: 'powershell',
  },
};

const DEFAULT_SHELLS_UNIX = {
  bash: {
    id: 'bash',
    name: 'Bash',
    executable: 'bash',
    args: [],
    cwd: '${HOMEPATH}',
    env: {},
    icon: 'bash',
  },
  zsh: {
    id: 'zsh',
    name: 'Zsh',
    executable: 'zsh',
    args: [],
    cwd: '${HOMEPATH}',
    env: {},
    icon: 'zsh',
  },
  fish: {
    id: 'fish',
    name: 'Fish',
    executable: 'fish',
    args: [],
    cwd: '${HOMEPATH}',
    env: {},
    icon: 'fish',
  },
  sh: {
    id: 'sh',
    name: 'Sh',
    executable: 'sh',
    args: [],
    cwd: '${HOMEPATH}',
    env: {},
    icon: 'sh',
  },
};

/**
 * Get platform-appropriate default shell definitions
 */
const DEFAULT_SHELLS = process.platform === 'win32'
  ? DEFAULT_SHELLS_WINDOWS
  : DEFAULT_SHELLS_UNIX;

/**
 * Detect the user's preferred shell from the environment ($SHELL on Unix).
 * Returns a shell config object or null if detection fails.
 */
function detectSystemShell() {
  if (process.platform !== 'win32' && process.env.SHELL) {
    const shellPath = process.env.SHELL;
    const shellName = path.basename(shellPath);
    // Return a config using the exact path so it always resolves correctly
    return {
      id: shellName,
      name: shellName.charAt(0).toUpperCase() + shellName.slice(1),
      executable: shellPath,
      args: [],
      cwd: '${HOMEPATH}',
      env: {},
      icon: shellName,
    };
  }
  return null;
}

/**
 * Get default shell id for the current platform
 */
function getDefaultShellId() {
  if (process.platform === 'win32') {
    return 'cmd';
  }
  // On Unix prefer $SHELL basename, then fall back through common shells
  if (process.env.SHELL) {
    return path.basename(process.env.SHELL);
  }
  // Common fallback order
  for (const id of ['bash', 'zsh', 'fish', 'sh']) {
    try {
      execSync(`which ${id}`, { stdio: 'pipe' });
      return id;
    } catch {
      // not found, try next
    }
  }
  return 'sh';
}

/**
 * Check if a shell executable exists on the system
 * @param {string} executable - The shell executable name or absolute path
 * @returns {boolean} True if the executable can be found
 */
function shellExists(executable) {
  // Absolute path – check directly on disk (handles /bin/bash, /usr/bin/zsh, etc.)
  if (path.isAbsolute(executable)) {
    return fs.existsSync(executable);
  }
  try {
    if (process.platform === 'win32') {
      execSync(`where ${executable}`, { stdio: 'pipe' });
      return true;
    } else {
      execSync(`which ${executable}`, { stdio: 'pipe' });
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Resolve environment variables in a path string
 * @param {string} str - Path string that may contain ${VAR} placeholders
 * @returns {string} Resolved path
 */
function resolveEnvVariables(str) {
  if (!str) return str;
  
  return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    if (varName === 'HOMEPATH') {
      return os.homedir();
    }
    return process.env[varName] || match;
  });
}

/**
 * Validate a shell configuration object
 * @param {object} shellConfig - Shell configuration to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateShellConfig(shellConfig) {
  const errors = [];

  if (!shellConfig.id || typeof shellConfig.id !== 'string') {
    errors.push('Shell must have a valid "id" string');
  }

  if (!shellConfig.name || typeof shellConfig.name !== 'string') {
    errors.push('Shell must have a valid "name" string');
  }

  if (!shellConfig.executable || typeof shellConfig.executable !== 'string') {
    errors.push('Shell must have a valid "executable" string');
  }

  if (!Array.isArray(shellConfig.args)) {
    errors.push('Shell "args" must be an array');
  }

  if (shellConfig.cwd && typeof shellConfig.cwd !== 'string') {
    errors.push('Shell "cwd" must be a string');
  }

  if (shellConfig.env && typeof shellConfig.env !== 'object') {
    errors.push('Shell "env" must be an object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get merged shell configuration from defaults and user config.
 * On Unix, the $SHELL-detected shell is injected first so it always appears.
 * @param {object} userConfig - User-provided shell configurations
 * @returns {object} Merged shell configurations with available shells
 */
function getMergedShellConfig(userConfig) {
  const merged = {};

  // Inject system-detected shell first (Unix $SHELL)
  const systemShell = detectSystemShell();
  if (systemShell) {
    merged[systemShell.id] = systemShell;
  }

  // Add platform defaults
  Object.assign(merged, DEFAULT_SHELLS);

  // Merge in user config
  if (userConfig && userConfig.available && typeof userConfig.available === 'object') {
    Object.assign(merged, userConfig.available);
  }

  return merged;
}

/**
 * Get available shells that actually exist on the system
 * @param {object} shellConfig - Shell configurations
 * @returns {object} Available shell configurations
 */
function getAvailableShells(shellConfig) {
  const available = {};

  Object.entries(shellConfig).forEach(([shellId, config]) => {
    // Resolve the executable path
    const resolvedExecutable = resolveEnvVariables(config.executable);
    
    // Check if shell exists
    if (shellExists(resolvedExecutable)) {
      available[shellId] = config;
    } else {
      console.warn(`Shell not found: ${config.name} (${resolvedExecutable})`);
    }
  });

  return available;
}

/**
 * Get a shell configuration by ID
 * @param {string} shellId - The shell ID to retrieve
 * @param {object} userShellConfig - User-provided shell configurations
 * @returns {object|null} Shell configuration or null if not found
 */
function getShellConfig(shellId, userShellConfig) {
  const merged = getMergedShellConfig(userShellConfig);
  const available = getAvailableShells(merged);

  if (available[shellId]) {
    return available[shellId];
  }

  console.warn(`Shell not found: ${shellId}, falling back to default`);
  const defaultId = userShellConfig?.default || getDefaultShellId();
  return available[defaultId] || Object.values(available)[0] || null;
}

/**
 * Get all available shells for UI display
 * @param {object} userShellConfig - User-provided shell configurations
 * @returns {array} Array of available shell configurations
 */
function listAvailableShells(userShellConfig) {
  const merged = getMergedShellConfig(userShellConfig);
  const available = getAvailableShells(merged);
  return Object.values(available);
}

/**
 * Get the default shell configuration
 * @param {object} userShellConfig - User-provided shell configurations
 * @returns {object} Default shell configuration
 */
function getDefaultShell(userShellConfig) {
  const merged = getMergedShellConfig(userShellConfig);
  const available = getAvailableShells(merged);
  const defaultId = userShellConfig?.default || getDefaultShellId();

  return available[defaultId] || Object.values(available)[0] || DEFAULT_SHELLS.cmd;
}

/**
 * Prepare shell spawn options from shell config
 * @param {object} shellConfig - Shell configuration
 * @param {object} terminalOptions - Terminal-specific options (cols, rows, etc.)
 * @returns {object} Options suitable for pty.spawn()
 */
function getSpawnOptions(shellConfig, terminalOptions = {}) {
  const cwd = shellConfig.cwd ? resolveEnvVariables(shellConfig.cwd) : os.homedir();
  const env = {
    ...process.env,
    ...shellConfig.env,
  };

  return {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd,
    env,
    ...terminalOptions,
  };
}

module.exports = {
  DEFAULT_SHELLS,
  getDefaultShellId,
  shellExists,
  resolveEnvVariables,
  validateShellConfig,
  getMergedShellConfig,
  getAvailableShells,
  getShellConfig,
  listAvailableShells,
  getDefaultShell,
  getSpawnOptions,
};
