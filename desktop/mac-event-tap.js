'use strict';

// macOS-only: a LISTEN-ONLY mouse event tap (koffi FFI, prebuilt N-API — no compile) that lets
// the user click the live wallpaper IN PLACE while the desktop icons stay visible and the window
// stays behind them. macOS routes empty-desktop clicks to Finder, so a window sunk below the icons
// never receives them; a session event tap observes those clicks and we forward only the ones that
// land on the bare desktop (no app window / Dock / widget on top) into the renderer via
// webContents.sendInputEvent. This is the only way to get "icons visible + window behind + clickable".
//
// SAFETY: the tap is kCGEventTapOptionListenOnly — it can ONLY observe, never modify or inject input,
// and it taps MOUSE events only (never the keyboard). It runs ONLY while wallpaper mode is active.
// Permission required: Input Monitoring (kTCCServiceListenEvent) — lighter than Accessibility.
//
// Every entry point is darwin-gated + fully guarded; any FFI failure → isAvailable()/start() return
// false and the caller falls back gracefully (no crash). The Windows path never touches this module.

let S = null;

// CGEventType
const kLeftDown = 1, kLeftUp = 2, kRightDown = 3, kRightUp = 4, kMouseMoved = 5, kLeftDragged = 6, kRightDragged = 7, kScroll = 22;
// Bare hover (no button) is forwarded so the renderer's hover-reveal chrome (left playlist drawer,
// bottom controls, search peek, 3D hover) works in wallpaper mode. kMouseMoved fires far above frame
// rate, and each forward needs isDesktopPoint() (a main-thread CGWindowList enumeration), so moves are
// TIME-THROTTLED to ~MOVE_THROTTLE_MS — capping both the WindowServer round-trips AND the renderer's
// heavy mousemove handler (getBoundingClientRect reflows) competing with the full-bleed WebGL rAF.
const MOVE_THROTTLE_MS = 40;
const kTapDisabledTimeout = 0xFFFFFFFE, kTapDisabledUserInput = 0xFFFFFFFF;
// Forward a click only if no on-screen window with layer ABOVE the Finder desktop covers the point.
const FINDER_DESKTOP_LAYER = -2147483603; // measured; our wallpaper sits one below at -2147483604

function init() {
  if (S) return S;
  if (process.platform !== 'darwin') { S = { ok: false, reason: 'not-darwin' }; return S; }
  try {
    const koffi = require('koffi');
    const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
    const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
    const libc = koffi.load('/usr/lib/libSystem.B.dylib');

    koffi.struct('MR_CGPoint', { x: 'double', y: 'double' });

    const fn = {
      CGEventGetLocation: cg.func('MR_CGPoint CGEventGetLocation(void *event)'),
      CGEventGetIntegerValueField: cg.func('int64 CGEventGetIntegerValueField(void *event, uint32 field)'),
      CGEventTapCreate: cg.func('void *CGEventTapCreate(uint32 tap, uint32 place, uint32 options, uint64 mask, void *cb, void *userInfo)'),
      CGEventTapEnable: cg.func('void CGEventTapEnable(void *port, bool enable)'),
      CGPreflightListenEventAccess: cg.func('bool CGPreflightListenEventAccess(void)'),
      CGRequestListenEventAccess: cg.func('bool CGRequestListenEventAccess(void)'),
      CGWindowListCopyWindowInfo: cg.func('void *CGWindowListCopyWindowInfo(uint32 option, uint32 rel)'),
      CGRectMakeWithDictionaryRepresentation: cg.func('bool CGRectMakeWithDictionaryRepresentation(void *dict, _Out_ void *rect)'),
      CFMachPortCreateRunLoopSource: cf.func('void *CFMachPortCreateRunLoopSource(void *allocator, void *port, long order)'),
      CFRunLoopGetMain: cf.func('void *CFRunLoopGetMain(void)'),
      CFRunLoopAddSource: cf.func('void CFRunLoopAddSource(void *rl, void *source, void *mode)'),
      CFRunLoopRemoveSource: cf.func('void CFRunLoopRemoveSource(void *rl, void *source, void *mode)'),
      CFArrayGetCount: cf.func('long CFArrayGetCount(void *arr)'),
      CFArrayGetValueAtIndex: cf.func('void *CFArrayGetValueAtIndex(void *arr, long i)'),
      CFDictionaryGetValue: cf.func('void *CFDictionaryGetValue(void *d, void *k)'),
      CFNumberGetValue: cf.func('bool CFNumberGetValue(void *num, int type, _Out_ void *out)'),
      CFRelease: cf.func('void CFRelease(void *p)'),
      dlopen: libc.func('void *dlopen(const char *path, int flags)'),
      dlsym: libc.func('void *dlsym(void *handle, const char *name)'),
    };

    const H = fn.dlopen(null, 1);
    const constPtr = (name) => koffi.decode(fn.dlsym(H, name), 'void *'); // deref the exported CFTypeRef var
    const consts = {
      commonModes: constPtr('kCFRunLoopCommonModes'),
      kWindowLayer: constPtr('kCGWindowLayer'),
      kWindowBounds: constPtr('kCGWindowBounds'),
    };

    // `type` MUST be uint32: CGEventType is a uint32 enum and the tap-disabled sentinels are
    // 0xFFFFFFFE/0xFFFFFFFF. Declared as signed `int`, koffi delivers them as -2/-1, the re-arm
    // branch never matches, and a system-disabled tap stays dead forever (forwarding silently dies).
    const TapProto = koffi.proto('void *MR_TapCb(void *proxy, uint32 type, void *event, void *userInfo)');
    S = { ok: true, koffi, fn, consts, TapProto, tap: null, source: null, cb: null, forward: null,
          leftDownDesktop: false, rightDownDesktop: false };
  } catch (e) {
    S = { ok: false, reason: e && e.message };
  }
  return S;
}

// Is the screen point on the bare desktop (nothing app/Dock/widget/pill on top)? Reads the live
// on-screen window list and returns false if any window above the Finder desktop covers the point.
function isDesktopPoint(x, y) {
  const s = S; if (!s || !s.ok) return false;
  let arr = null;
  try {
    arr = s.fn.CGWindowListCopyWindowInfo(1 /*onScreenOnly*/, 0);
    if (!arr) return false;
    const n = Number(s.fn.CFArrayGetCount(arr));
    const numBuf = Buffer.alloc(8);
    const rect = Buffer.alloc(32);
    for (let i = 0; i < n; i++) {
      const d = s.fn.CFArrayGetValueAtIndex(arr, i);
      if (!d) continue;
      const layerV = s.fn.CFDictionaryGetValue(d, s.consts.kWindowLayer);
      if (!layerV) continue;
      s.fn.CFNumberGetValue(layerV, 3 /*SInt32*/, numBuf);
      const layer = numBuf.readInt32LE(0);
      if (layer <= FINDER_DESKTOP_LAYER) continue;        // desktop / wallpaper / below — not "on top"
      const boundsV = s.fn.CFDictionaryGetValue(d, s.consts.kWindowBounds);
      if (!boundsV) continue;
      if (!s.fn.CGRectMakeWithDictionaryRepresentation(boundsV, rect)) continue;
      const bx = rect.readDoubleLE(0), by = rect.readDoubleLE(8), bw = rect.readDoubleLE(16), bh = rect.readDoubleLE(24);
      if (x >= bx && x < bx + bw && y >= by && y < by + bh) return false; // covered by something on top
    }
    return true;
  } catch (e) {
    return false;
  } finally {
    if (arr) { try { s.fn.CFRelease(arr); } catch (e) {} }
  }
}

module.exports = {
  isAvailable() { return init().ok === true; },
  reason() { return init().reason; },
  hasPermission() {
    const s = init(); if (!s.ok) return false;
    try { return !!s.fn.CGPreflightListenEventAccess(); } catch (e) { return false; }
  },
  // Triggers the macOS Input Monitoring prompt (only effective once per app identity). Returns the
  // current grant state; the user must enable Mineradio in System Settings if false.
  requestPermission() {
    const s = init(); if (!s.ok) return false;
    try { return !!s.fn.CGRequestListenEventAccess(); } catch (e) { return false; }
  },
  isDesktopPoint,

  // Start observing mouse events; forward(evt) is called ONLY for clicks on the bare desktop.
  // evt = { kind: 'down'|'up'|'drag'|'rdown'|'rup'|'scroll', x, y, dy, dx }. Returns true if armed.
  start(forward) {
    const s = init(); if (!s.ok) return false;
    if (s.tap) return true; // already running
    if (!this.hasPermission()) return false;
    try {
      s.forward = forward;
      const mask = (1n << BigInt(kLeftDown)) | (1n << BigInt(kLeftUp)) | (1n << BigInt(kLeftDragged)) | (1n << BigInt(kMouseMoved))
        | (1n << BigInt(kRightDown)) | (1n << BigInt(kRightUp)) | (1n << BigInt(kRightDragged)) | (1n << BigInt(kScroll));
      s.cb = s.koffi.register((proxy, type, event) => {
        try {
          if (type === kTapDisabledTimeout || type === kTapDisabledUserInput) {
            if (s.tap) s.fn.CGEventTapEnable(s.tap, true); // system disabled us → re-arm
            return event;
          }
          const loc = s.fn.CGEventGetLocation(event);
          const x = loc.x, y = loc.y;
          if (type === kLeftDown) { s.leftDownDesktop = isDesktopPoint(x, y); if (s.leftDownDesktop && s.forward) s.forward({ kind: 'down', x, y }); }
          else if (type === kLeftDragged) { if (s.leftDownDesktop && s.forward) s.forward({ kind: 'drag', x, y }); }
          else if (type === kLeftUp) { if (s.leftDownDesktop && s.forward) s.forward({ kind: 'up', x, y }); s.leftDownDesktop = false; }
          else if (type === kMouseMoved) {
            // Bare hover (no button) → forward so wallpaper hover-reveal chrome works. Time-throttled
            // (timestamp compare, no timer to leak) so isDesktopPoint + the renderer handler stay cheap.
            const now = Date.now();
            if (now - (s.lastMoveAt || 0) >= MOVE_THROTTLE_MS) {
              s.lastMoveAt = now;
              if (s.forward && isDesktopPoint(x, y)) s.forward({ kind: 'move', x, y });
            }
          }
          else if (type === kRightDown) { s.rightDownDesktop = isDesktopPoint(x, y); if (s.rightDownDesktop && s.forward) s.forward({ kind: 'rdown', x, y }); }
          else if (type === kRightDragged) { if (s.rightDownDesktop && s.forward) s.forward({ kind: 'drag', x, y }); }
          else if (type === kRightUp) { if (s.rightDownDesktop && s.forward) s.forward({ kind: 'rup', x, y }); s.rightDownDesktop = false; }
          else if (type === kScroll) {
            if (s.forward && isDesktopPoint(x, y)) {
              const dy = Number(s.fn.CGEventGetIntegerValueField(event, 11)); // ScrollWheelEventDeltaAxis1
              const dx = Number(s.fn.CGEventGetIntegerValueField(event, 12)); // Axis2
              s.forward({ kind: 'scroll', x, y, dy, dx });
            }
          }
        } catch (e) { /* never let a tap callback throw into WindowServer */ }
        return event;
      }, s.koffi.pointer(s.TapProto));

      s.tap = s.fn.CGEventTapCreate(1 /*session*/, 0 /*headInsert*/, 1 /*listenOnly*/, mask, s.cb, null);
      if (!s.tap) { // permission missing → NULL; unregister the trampoline we just made so it doesn't leak
        try { s.koffi.unregister(s.cb); } catch (e) {}
        s.cb = null; s.forward = null; return false;
      }
      s.fn.CGEventTapEnable(s.tap, true);
      s.source = s.fn.CFMachPortCreateRunLoopSource(null, s.tap, 0);
      const rl = s.fn.CFRunLoopGetMain(); // Electron's main thread runs this CFRunLoop → callback fires
      s.fn.CFRunLoopAddSource(rl, s.source, s.consts.commonModes);
      return true;
    } catch (e) {
      try { this.stop(); } catch (_) {}
      return false;
    }
  },

  stop() {
    const s = S; if (!s || !s.ok) return;
    try {
      if (s.tap) s.fn.CGEventTapEnable(s.tap, false);
      if (s.source) { const rl = s.fn.CFRunLoopGetMain(); s.fn.CFRunLoopRemoveSource(rl, s.source, s.consts.commonModes); }
      // Free what we own — else every start/stop cycle (enter/exit, interact toggle, browsing
      // on/off) leaks. Source + tap follow the CF Create rule (+1 each); the koffi callback
      // trampoline must be unregistered. Order: disable + remove from runloop FIRST (done above,
      // so no in-flight callback), then release the source, the mach-port tap, and the trampoline.
      if (s.source) s.fn.CFRelease(s.source);
      if (s.tap) s.fn.CFRelease(s.tap);
      if (s.cb) s.koffi.unregister(s.cb);
    } catch (e) {}
    s.tap = null; s.source = null; s.cb = null; s.forward = null;
    s.leftDownDesktop = false; s.rightDownDesktop = false; s.lastMoveAt = 0;
  },

  isRunning() { return !!(S && S.ok && S.tap); },
};
