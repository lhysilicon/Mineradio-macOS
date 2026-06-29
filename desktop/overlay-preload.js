const { contextBridge, ipcRenderer } = require('electron');

function bind(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload || {});
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('desktopOverlay', {
  onLyricsState: (callback) => bind('mineradio-desktop-lyrics-state', callback),
  onWallpaperState: (callback) => bind('mineradio-wallpaper-state', callback),
  setLyricsDrag: (dragging) => ipcRenderer.invoke('mineradio-desktop-lyrics-set-dragging', !!dragging),
  setLyricsPointerCapture: (active) => ipcRenderer.invoke('mineradio-desktop-lyrics-set-pointer-capture', !!active),
  setLyricsHotBounds: (bounds) => ipcRenderer.invoke('mineradio-desktop-lyrics-set-hot-bounds', bounds || {}),
  setLyricsLockState: (locked) => ipcRenderer.invoke('mineradio-desktop-lyrics-set-lock-state', !!locked),
  moveLyricsBy: (dx, dy) => ipcRenderer.invoke('mineradio-desktop-lyrics-move-by', Number(dx) || 0, Number(dy) || 0),
  closeLyrics: () => ipcRenderer.invoke('mineradio-desktop-lyrics-set-enabled', false, {}),
  // macOS wallpaper control pill (transport + mode toggle).
  onHudState: (callback) => bind('mineradio-wallpaper-hud-state', callback),
  onHudNowPlaying: (callback) => bind('mineradio-wallpaper-hud-nowplaying', callback),
  hudAction: (action) => ipcRenderer.invoke('mineradio-wallpaper-hud-action', String(action || '')),
  hudBrowsingToggle: () => ipcRenderer.invoke('mineradio-wallpaper-hud-browsing-toggle'),
  hudExit: () => ipcRenderer.invoke('mineradio-wallpaper-hud-exit'),
});
