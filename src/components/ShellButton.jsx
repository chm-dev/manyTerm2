import React from 'react';
import '../scss/shell-button.scss';

/**
 * ShellButton - A draggable button component for selecting and creating terminals with different shells
 * Can be dragged onto the grid to create a split terminal with the selected shell
 */
const ShellButton = ({ shell, onDragStart }) => {
  const handleDragStart = (e) => {
    if (onDragStart) {
      onDragStart(shell.id);
    }
    
    // Set the drag data
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/shellId', shell.id);
  };

  return (
    <button
      draggable
      className="shell-button"
      onDragStart={handleDragStart}
      title={`Drag to create split terminal with ${shell.name}`}
    >
      <span className="shell-button-icon">{getIconForShell(shell.id)}</span>
      <span className="shell-button-label">{shell.name}</span>
    </button>
  );
};

/**
 * Get icon/emoji for a shell based on its ID
 */
function getIconForShell(shellId) {
  const iconMap = {
    cmd: '⌘',
    powershell: '⚡',
    wps: '⚡',
    bash: '🐚',
    zsh: '🐚',
    fish: '🐠',
  };
  return iconMap[shellId] || '▶️';
}

export default ShellButton;
