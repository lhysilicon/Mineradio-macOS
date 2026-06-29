'use strict';

// macOS-only NSWindow level bridge (koffi FFI, prebuilt N-API — no compile, no
// electron-rebuild). Lets us sink a LIVE BrowserWindow to the desktop wallpaper
// level (behind Finder icons) and raise it back to normal level WITHOUT
// destroying/recreating the window — preserving the renderer's audio / visualizer /
// login state. This is why we use direct [NSWindow setLevel:] instead of Electron's
// construction-time type:'desktop' (which would force a destroy+recreate on toggle).
//
// Every entry point is fully guarded: if koffi or any AppKit symbol fails to load,
// init() records ok=false and all functions become safe no-ops. Callers MUST check
// isAvailable() and fall back to plain app-window mode so the app never crashes.
//
// The Windows wallpaper path (WorkerW re-parent) does not use this module at all.

let state = null;

function init() {
  if (state) return state;
  if (process.platform !== 'darwin') { state = { ok: false, reason: 'not-darwin' }; return state; }
  try {
    const koffi = require('koffi');
    const objc = koffi.load('/usr/lib/libobjc.A.dylib');
    const sel_registerName = objc.func('void* sel_registerName(const char*)');
    // objc_msgSend declared once per concrete prototype (arm64 requires exact sigs).
    const msgSend_ptr     = objc.func('objc_msgSend', 'void*',         ['void*', 'void*']);            // id  (id, SEL)
    const msgSend_long    = objc.func('objc_msgSend', 'long',          ['void*', 'void*']);            // NSInteger (id, SEL)
    const msgSend_ulong   = objc.func('objc_msgSend', 'unsigned long', ['void*', 'void*']);            // NSUInteger (id, SEL) e.g. occlusionState
    const msgSend_v_long  = objc.func('objc_msgSend', 'void',  ['void*', 'void*', 'long']);           // setLevel:
    const msgSend_v_ulong = objc.func('objc_msgSend', 'void',  ['void*', 'void*', 'unsigned long']);  // setCollectionBehavior:
    const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
    const CGWindowLevelForKey = cg.func('int32 CGWindowLevelForKey(int32)');
    const kCGDesktopIconWindowLevelKey = 18;
    // One below the desktop-ICON level: above the system wallpaper picture (so the
    // window is actually visible AS the wallpaper) but below the icons (so they stay
    // on top). NOTE: the older kCGDesktopWindowLevel-1 (what Electron's type:'desktop'
    // uses) renders BELOW the system wallpaper on macOS 26 Tahoe — verified invisible
    // on-device — so we sit just under the icon layer instead.
    const desktopLevel = CGWindowLevelForKey(kCGDesktopIconWindowLevelKey) - 1;

    const selCache = new Map();
    const SEL = (s) => { let v = selCache.get(s); if (!v) { v = sel_registerName(s); selCache.set(s, v); } return v; };

    state = { ok: true, koffi, SEL, msgSend_ptr, msgSend_long, msgSend_ulong, msgSend_v_long, msgSend_v_ulong, desktopLevel };
  } catch (e) {
    console.warn('[mac-window-level] FFI init failed; wallpaper level control unavailable:', e && e.message);
    state = { ok: false, reason: e && e.message };
  }
  return state;
}

function nswindow(win) {
  const s = init();
  if (!s.ok || !win || win.isDestroyed()) return null;
  try {
    const view = s.koffi.decode(win.getNativeWindowHandle(), 'void *'); // NSView*
    if (!view) return null;
    return s.msgSend_ptr(view, s.SEL('window'));                        // [view window] -> NSWindow*
  } catch (e) {
    return null;
  }
}

// NSWindowCollectionBehavior bits we use: CanJoinAllSpaces(1<<0) | Stationary(1<<4) | IgnoresCycle(1<<6)
const COLLECTION_ALL_SPACES = (1 << 0) | (1 << 4) | (1 << 6); // 81
const COLLECTION_DEFAULT = 0;
// NSWindowOcclusionState.visible bit (AppKit): the window (or part of it) is visible.
// When fully covered by another window the bit clears. Used by the energy controller to
// stop rendering a wallpaper nobody can see. NOTE: reliability for an all-spaces /
// desktop-level window is measured by the occlusion probe before being trusted.
const OCCLUSION_VISIBLE = (1 << 1); // 2

module.exports = {
  isAvailable() { return init().ok === true; },
  reason() { return init().reason; },
  desktopLevel() { return init().desktopLevel; },
  normalLevel() { return 0; }, // NSNormalWindowLevel

  getLevel(win) {
    const s = init(); const w = nswindow(win);
    if (!s.ok || !w) return null;
    try { return s.msgSend_long(w, s.SEL('level')); } catch (e) { return null; }
  },

  setLevel(win, level) {
    const s = init(); const w = nswindow(win);
    if (!s.ok || !w) return false;
    try { s.msgSend_v_long(w, s.SEL('setLevel:'), level); return true; }
    catch (e) { console.warn('[mac-window-level] setLevel failed:', e && e.message); return false; }
  },

  setCollectionBehavior(win, mask) {
    const s = init(); const w = nswindow(win);
    if (!s.ok || !w) return false;
    try { s.msgSend_v_ulong(w, s.SEL('setCollectionBehavior:'), mask >>> 0); return true; }
    catch (e) { console.warn('[mac-window-level] setCollectionBehavior failed:', e && e.message); return false; }
  },

  // Raw NSWindowOcclusionState bitmask, or null if unavailable.
  getOcclusionState(win) {
    const s = init(); const w = nswindow(win);
    if (!s.ok || !w) return null;
    try { return Number(s.msgSend_ulong(w, s.SEL('occlusionState'))); } catch (e) { return null; }
  },
  // true = at least partially visible; false = fully occluded; null = can't tell.
  isVisibleByOcclusion(win) {
    const st = this.getOcclusionState(win);
    if (st == null) return null;
    return (st & OCCLUSION_VISIBLE) !== 0;
  },

  COLLECTION_ALL_SPACES,
  COLLECTION_DEFAULT,
  OCCLUSION_VISIBLE,
};
