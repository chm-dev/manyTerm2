const { globalShortcut, app, screen } = require('electron');
const toggleAnimation = require('./toggleAnimation');

let winIsFocused = false;
let toggleTimeout = false;

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

module.exports = (win, store) => {
  win.on('focus', () => (winIsFocused = true));
  win.on('blur', () => (winIsFocused = false));

  // Alt + ` - Toggle quake console mode
  try {
    const success1 = globalShortcut.register('Alt+`', () => {
      console.log('Alt+` pressed, toggleTimeout:', toggleTimeout);
      
      if (toggleTimeout === false) {
        if (win.isVisible()) {
          if (winIsFocused) {
            toggleAnimation(win, false);
          } else {
            win.focus();
          }
        } else {
          toggleAnimation(win, true);
        }
        
        toggleTimeout = true;
        setTimeout(() => {
          toggleTimeout = false;
        }, 250); // Prevent rapid toggling
      }
    });
    
    if (!success1) {
      console.error('Failed to register Alt+` shortcut');
    } else {
      console.log('Successfully registered Alt+` shortcut');
    }
  } catch (error) {
    console.error('Error registering Alt+` shortcut:', error);
  }

  // Alt + Shift + ` - Reset to default size and position
  try {
    const success2 = globalShortcut.register('Alt+Shift+`', () => {
      console.log('Alt+Shift+` pressed - resetting window');
      
      win.show();
      
      if (win.isMaximized()) {
        win.restore();
      }
      
      const display = screen.getDisplayMatching(win.getBounds());
      const defaultBounds = {
        width: display.bounds.width,
        height: Math.floor(display.bounds.height / 2),
        x: display.bounds.x,
        y: display.bounds.y
      };
      
      win.setBounds(defaultBounds);
      win.focus();
      
      // Store the new bounds
      store.set('bounds', defaultBounds);
    });
    
    if (!success2) {
      console.error('Failed to register Alt+Shift+` shortcut');
    } else {
      console.log('Successfully registered Alt+Shift+` shortcut');
    }
  } catch (error) {
    console.error('Error registering Alt+Shift+` shortcut:', error);
  }
};
