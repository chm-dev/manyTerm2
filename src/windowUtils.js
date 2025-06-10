const { screen } = require('electron');

function getDefaultBounds() {
  const primaryDisplay = screen.getPrimaryDisplay();
  return {
    width: primaryDisplay.bounds.width,
    height: Math.floor(primaryDisplay.bounds.height / 2),
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y
  };
}

function getBounds(store) {
  const defaultBounds = getDefaultBounds();
  
  if (!store) {
    return defaultBounds;
  }
  
  const savedBounds = store.get('bounds');
  
  if (savedBounds) {
    // Ensure the saved bounds are still valid (display might have changed)
    const displays = screen.getAllDisplays();
    const isValidBounds = displays.some(display => 
      savedBounds.x >= display.bounds.x &&
      savedBounds.x < display.bounds.x + display.bounds.width &&
      savedBounds.y >= display.bounds.y &&
      savedBounds.y < display.bounds.y + display.bounds.height
    );
    
    if (isValidBounds) {
      return savedBounds;
    }
  }
  
  return defaultBounds;
}

module.exports = {
  getBounds,
  getDefaultBounds
};
