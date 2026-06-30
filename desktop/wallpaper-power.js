'use strict';

// Pure decision logic for the macOS wallpaper-mode energy controller's power
// signals, extracted from main.js so it can be unit-tested without Electron.
// main.js wires these decisions to powerMonitor events + setWallpaperPowerIdle.
//
// Why lock state is tracked: a `resume` event fires on wake. If the wake happens
// while the screen is still LOCKED (e.g. lock-screen → suspend → wake to the lock
// screen), unconditionally clearing idle would spin the wallpaper visualizer back
// up at full GPU behind the lock screen — unseen work the energy controller is
// meant to prevent. So we only CLEAR idle on resume when the screen is unlocked;
// if it is still locked we RE-ASSERT idle.
//
// `idle` semantics in the return value:
//   true  → ask the renderer to idle. Only meaningful in wallpaper mode, so the
//           wiring in main.js gates applying SET-true on macWallpaperActive.
//   false → clear idle. Always safe to apply.
//   null  → leave the current idle state unchanged.
function macWallpaperPowerTransition(event, screenLocked) {
  switch (event) {
    case 'lock-screen':
      return { screenLocked: true, idle: true };
    case 'unlock-screen':
      return { screenLocked: false, idle: false };
    case 'suspend':
      // Suspend does not change lock state, but the wallpaper is provably unseen.
      return { screenLocked: screenLocked, idle: true };
    case 'resume':
      // Wake: only resume rendering if the screen is actually visible (unlocked).
      return { screenLocked: screenLocked, idle: screenLocked ? true : false };
    default:
      return { screenLocked: screenLocked, idle: null };
  }
}

module.exports = { macWallpaperPowerTransition };
