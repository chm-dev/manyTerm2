import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

const TerminalComponent = ({ terminalId, shellId, onResize, registerFocusable, unregisterFocusable }) => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  
  // Refs to hold latest values to avoid stale closures in ResizeObserver
  const isReadyRef = useRef(false);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

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
      allowProposedApi: true
    });
    
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Load WebGL addon for better performance (with fallback)
    let webglAddon = null;
    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
      console.log('WebGL renderer loaded successfully for terminal:', terminalId);
    } catch (error) {
      console.warn('WebGL renderer not supported, falling back to canvas renderer:', error);
    }

    // Debounced resize handler using refs to avoid stale closures
    let resizeTimeout;
    const lastDimensions = { cols: 0, rows: 0 };
    
    const handleResize = () => {
      // Clear existing timer
      if (resizeTimeout) clearTimeout(resizeTimeout);
      
      // Set new timer (100ms debounce)
      resizeTimeout = setTimeout(() => {
        if (!terminal || !fitAddonRef.current) return;
        
        // Guard against zero dimensions (happens when tab is hidden/dragged)
        // Check if element is attached to DOM and has dimensions
        const element = terminalRef.current;
        if (!element || element.offsetWidth === 0 || element.offsetHeight === 0) {
          return;
        }
        
        try {
          // Fit to container
          fitAddon.fit();
          
          const { cols, rows } = terminal;
          
          // Don't resize to 0/invalid dimensions
          if (cols <= 0 || rows <= 0 || isNaN(cols) || isNaN(rows)) {
            return;
          }

          // Check if dimensions actually changed to prevent loops and unnecessary updates
          if (cols === lastDimensions.cols && rows === lastDimensions.rows) {
            // Even if dimensions are same, we might need a refresh if coming from hidden state
            // but usually we can skip the heavy IPC call
            return;
          }
          
          lastDimensions.cols = cols;
          lastDimensions.rows = rows;

          // Use ref.current to see if we are ready to send resize events
          if (window.electronAPI && isReadyRef.current) {
            window.electronAPI.resizeTerminal(terminalId, cols, rows);
          }

          // Force a redraw to fix any rendering artifacts
          // Renders from top (0) to bottom (rows-1)
          terminal.refresh(0, rows - 1);

          // Invoke parent callback if available
          if (onResizeRef.current) {
            onResizeRef.current(cols, rows);
          }
        } catch (e) {
          console.warn('Resize error:', e);
        }
      }, 100);
    };

    // Wait for the container to be properly sized before opening terminal
    const openTerminal = () => {
      if (terminalRef.current && terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
        try {
          terminal.open(terminalRef.current);
          handleResize(); // Initial fit
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
    fitAddonRef.current = fitAddon;

    // Set up event handlers
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
      exitListener = window.electronAPI.onTerminalExit(exitHandler);

      // Create terminal in main process first
      window.electronAPI.createTerminal(terminalId, shellId).then(() => {
        console.log('Terminal created successfully:', terminalId);
        setIsReady(true);
        isReadyRef.current = true; // Update ref immediately for any pending resize
        
        // Set up user input handler after terminal is created
        inputDisposable = terminal.onData((data) => {
          // console.log('User input:', terminalId, data);
          window.electronAPI.writeTerminal(terminalId, data);
        });
        
        // Trigger initial resize after creation
        handleResize();
        
      }).catch(error => {
        console.error('Failed to create terminal:', terminalId, error);
      });
    }

    // Set up resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }    // Cleanup function
    return () => {
      console.log('Cleaning up terminal:', terminalId);
      
      // Clear any pending resize
      if (resizeTimeout) clearTimeout(resizeTimeout);
      
      resizeObserver.disconnect();
      
      if (inputDisposable) {
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
          window.electronAPI.removeListener('terminal-data', dataListener);
        }
        if (exitListener) {
          window.electronAPI.removeListener('terminal-exit', exitListener);
        }
      }
      
      // Dispose WebGL addon explicitly if it exists
      if (webglAddon) {
        try {
          webglAddon.dispose();
        } catch (e) {
          console.warn('Error disposing WebGL addon:', e);
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
    };  }, [terminalId]);

  // Register/unregister with focus manager
  useEffect(() => {
    if (registerFocusable && xtermRef.current) {
      const focusFunction = () => {
        if (xtermRef.current && terminalRef.current) {
          xtermRef.current.focus();
        }
      };
      
      registerFocusable(terminalId, focusFunction, 'terminal');
      
      return () => {
        if (unregisterFocusable) {
          unregisterFocusable(terminalId);
        }
      };
    }
  }, [terminalId, registerFocusable, unregisterFocusable, isReady]);

  return (
    <div className="terminal-container">
      <div 
        ref={terminalRef} 
        className="terminal-wrapper"
      />
    </div>
  );
};

export default TerminalComponent;
