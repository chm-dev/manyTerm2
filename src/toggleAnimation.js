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

  // win.show()/win.hide() each rescale the window by the monitor's DPI factor
  // (1.25 on a 125% display, even though scaleFactor reports 1). If we carried
  // win.getBounds() forward as the size, that inflation would compound on every
  // toggle. Instead we re-assert an authoritative geometry derived from
  // display.bounds on every animation frame — the same values that make the
  // Shift+Alt+` reset reliable — so any show/hide inflation is corrected before
  // it is visible and never accumulates.
  const targetX = display.bounds.x;
  const targetWidth = display.bounds.width;
  const targetHeight = Math.floor(display.bounds.height / 2);
  const topY = display.bounds.y;
  const hiddenY = display.bounds.y - targetHeight;

  const placeAt = (y) =>
    win.setBounds({ x: targetX, y, width: targetWidth, height: targetHeight });

  if (show) {
    // Position window above the screen before showing
    placeAt(hiddenY);
    win.show();
    win.focus();

    // Animate sliding down
    const stepSize = (topY - hiddenY) / frames;
    for (let i = 0; i <= frames; i++) {
      setTimeout(() => {
        placeAt(Math.floor(hiddenY + stepSize * i));
      }, frameDelay * i);
    }
  } else {
    // Animate sliding up
    const stepSize = (hiddenY - topY) / frames;
    for (let i = 0; i <= frames; i++) {
      setTimeout(() => {
        placeAt(Math.floor(topY + stepSize * i));

        // Hide window when animation completes
        if (i === frames) {
          setTimeout(() => win.hide(), 10);
        }
      }, frameDelay * i);
    }
  }
};
