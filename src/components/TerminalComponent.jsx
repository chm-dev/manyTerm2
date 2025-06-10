import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

const TerminalComponent = ({ terminalId, onResize }) => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selection: '#ffffff20'
      },
      fontFamily: '"FiraCode Nerd Font",Consolas, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
    });    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Load WebGL addon for better performance (with fallback)
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
      console.log('WebGL renderer loaded successfully for terminal:', terminalId);
    } catch (error) {
      console.warn('WebGL renderer not supported, falling back to canvas renderer:', error);
    }// Wait for the container to be properly sized before opening terminal
    const openTerminal = () => {
      if (terminalRef.current && terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
        try {
          terminal.open(terminalRef.current);
          fitAddon.fit();
        } catch (error) {
          console.warn('Error opening terminal:', error);
          // Retry after a short delay
          setTimeout(openTerminal, 100);
        }
      } else {
        // If container isn't ready, try again in a few milliseconds
        setTimeout(openTerminal, 10);
      }
    };

    openTerminal();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;    // Set up event handlers
    let dataHandler = null;
    let exitHandler = null;
    let dataListener = null;
    let exitListener = null;
    let inputDisposable = null;

    if (window.electronAPI) {
      // Create handlers with proper closure
      dataHandler = (id, data) => {
        if (id === terminalId && terminal) {
          terminal.write(data);
        }
      };

      exitHandler = (id) => {
        if (id === terminalId && terminal) {
          terminal.write('\r\n[Process completed]');
        }
      };

      // Set up listeners and store the actual listener functions for proper cleanup
      dataListener = window.electronAPI.onTerminalData(dataHandler);
      exitListener = window.electronAPI.onTerminalExit(exitHandler);// Create terminal in main process first
      window.electronAPI.createTerminal(terminalId).then(() => {
        console.log('Terminal created successfully:', terminalId);
        setIsReady(true);
        
        // Set up user input handler after terminal is created
        inputDisposable = terminal.onData((data) => {
          console.log('User input:', terminalId, data);
          window.electronAPI.writeTerminal(terminalId, data);
        });
        
        // Send initial size
        const cols = terminal.cols;
        const rows = terminal.rows;
        window.electronAPI.resizeTerminal(terminalId, cols, rows);
        if (onResize) {
          onResize(cols, rows);
        }
      }).catch(error => {
        console.error('Failed to create terminal:', terminalId, error);
      });
    }

    // Handle resize
    const handleResize = () => {
      if (fitAddon && terminal) {
        fitAddon.fit();
        const cols = terminal.cols;
        const rows = terminal.rows;
        if (window.electronAPI && isReady) {
          window.electronAPI.resizeTerminal(terminalId, cols, rows);
        }
        if (onResize) {
          onResize(cols, rows);
        }
      }
    };

    // Set up resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }    // Cleanup function
    return () => {
      console.log('Cleaning up terminal:', terminalId);
      resizeObserver.disconnect();
      if (inputDisposable) {
        console.log('Disposing input handler for:', terminalId);
        try {
          inputDisposable.dispose();
        } catch (error) {
          console.warn('Error disposing input handler:', error);
        }
      }
      if (window.electronAPI) {
        console.log('Closing terminal in main process:', terminalId);
        window.electronAPI.closeTerminal(terminalId);
        
        // Remove only the specific listeners for this terminal
        if (dataListener) {
          console.log('Removing data listener for:', terminalId);
          window.electronAPI.removeListener('terminal-data', dataListener);
        }
        if (exitListener) {
          console.log('Removing exit listener for:', terminalId);
          window.electronAPI.removeListener('terminal-exit', exitListener);
        }
      }
      if (terminal) {
        console.log('Disposing terminal instance:', terminalId);
        try {
          // Wait a bit before disposing to let any pending operations complete
          setTimeout(() => {
            if (terminal) {
              terminal.dispose();
            }
          }, 100);
        } catch (error) {
          console.warn('Error disposing terminal:', error);
        }
      }
    };
  }, [terminalId]);

  // Handle external resize (from FlexLayout changes)
  useEffect(() => {
    const handleLayoutResize = () => {
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
          const cols = xtermRef.current.cols;
          const rows = xtermRef.current.rows;
          if (window.electronAPI && isReady) {
            window.electronAPI.resizeTerminal(terminalId, cols, rows);
          }
          if (onResize) {
            onResize(cols, rows);
          }
        }
      }, 100);
    };

    window.addEventListener('resize', handleLayoutResize);
    
    // Also trigger on component mount
    handleLayoutResize();

    return () => {
      window.removeEventListener('resize', handleLayoutResize);
    };
  }, [terminalId, isReady, onResize]);

  return (
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: '#1e1e1e'
      }}
    />
  );
};

export default TerminalComponent;
