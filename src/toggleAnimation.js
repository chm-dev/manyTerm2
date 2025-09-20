const { screen } = require('electron');

module.exports = (win, show = false) => {
  if (typeof show !== 'boolean') throw new Error('show param must be a boolean');
  
  // Configuration
  const duration = 150;
  const fps = 60;
  const frameDelay = 1000 / fps;
  const frames = Math.floor(fps * (duration / 1000));
  
  const currentBounds = win.getBounds();
  const display = screen.getDisplayMatching(currentBounds);
  
  if (show) {
    // Position window above screen before showing
    const startY = display.bounds.y - currentBounds.height;
    const endY = display.bounds.y;
    
    win.setBounds({
      ...currentBounds,
      y: startY
    });
    win.show();
    win.focus();
    
    // Animate sliding down
    const stepSize = (endY - startY) / frames;
    for (let i = 0; i <= frames; i++) {
      setTimeout(() => {
        const newY = startY + (stepSize * i);
        win.setBounds({ 
          ...currentBounds,
          y: Math.floor(newY) 
        });
      }, frameDelay * i);
    }
  } else {
    // Animate sliding up
    const startY = currentBounds.y;
    const endY = display.bounds.y - currentBounds.height;
    const stepSize = (endY - startY) / frames;
    
    for (let i = 0; i <= frames; i++) {
      setTimeout(() => {
        const newY = startY + (stepSize * i);
        win.setBounds({ 
          ...currentBounds,
          y: Math.floor(newY) 
        });
        
        // Hide window when animation completes
        if (i === frames) {
          setTimeout(() => win.hide(), 10);
        }
      }, frameDelay * i);
    }
  }
};
