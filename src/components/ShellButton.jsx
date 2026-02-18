import React, { useState } from 'react';
import '../scss/shell-button.scss';

/**
 * ShellButton - A draggable button component for selecting and creating terminals with different shells
 * Can be dragged onto the grid to create a split terminal with the selected shell
 */
const ShellButton = ({ shell, onDragStart }) => {
  const handleDragStart = (e) => {
    console.log('ShellButton drag start, shell:', shell.id, 'event:', e, 'event type:', typeof e);
    
    // Store the event in window for access from TopBar
    window._lastShellDragEvent = e;
    
    console.log('Stored event in window._lastShellDragEvent:', window._lastShellDragEvent);
    
    // Set the drag data immediately
    if (e && e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/shellId', shell.id);
    }
    
    console.log('About to call onDragStart with shell:', shell, 'and event:', e);
    
    // Pass the shell info and event to the parent (event first, then shell to match TopBar's expectations)
    if (onDragStart) {
      onDragStart(e, shell);
    }
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
