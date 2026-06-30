'use strict';

// macOS-only: hide / restore the Finder desktop ICONS (not the desktop widgets) so a
// desktop-level wallpaper window can receive clicks IN PLACE. macOS routes every click on
// the empty desktop to the Finder desktop window, which both draws the icons and owns that
// hit-testing — so a window sunk below it never gets the click. Removing the icon layer
// (`com.apple.finder CreateDesktop = false` + relaunch Finder) takes that click-catcher
// away, and the wallpaper window underneath becomes the natural click target with full
// native event fidelity. Proven by Übersicht (issue #34). Zero TCC permission, unsigned-safe.
//
// Everything here is darwin-gated and fully fail-soft: if `defaults`/`killall` ever fail the
// caller is told (returns false) and falls back to the lift-over-icons browse path so the
// user can still interact. A crash-safety marker in userData guarantees a hard crash never
// leaves the icons stranded-hidden — the next launch restores them.

const { execFile, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DOMAIN = 'com.apple.finder';
const KEY = 'CreateDesktop';

let markerPath = null;       // userData/.wallpaper-icons-hidden — written while hidden
let priorValue = undefined;  // 'absent' | '0' | '1' — the user's CreateDesktop before we hid
let hidden = false;

// In self-test we must NOT actually relaunch the real Finder (killall Finder would disrupt
// the live desktop). MINERADIO_ICONS_DRYRUN exercises the marker/state machine only.
function dryRun() { return process.env.MINERADIO_ICONS_DRYRUN === '1'; }

function run(cmd, args) {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: 8000 }, (err, stdout) => {
        resolve({ ok: !err, out: (stdout || '').toString().trim(), err: err && err.message });
      });
    } catch (e) { resolve({ ok: false, err: e && e.message }); }
  });
}

// Wire up the crash-safety marker location. Call once after the app knows its userData dir.
function configure(userDataDir) {
  if (process.platform !== 'darwin') return;
  try { markerPath = path.join(userDataDir, '.wallpaper-icons-hidden'); } catch (e) { markerPath = null; }
}

async function readCreateDesktop() {
  if (dryRun()) return 'absent';
  const r = await run('/usr/bin/defaults', ['read', DOMAIN, KEY]);
  if (!r.ok) return 'absent';   // key missing → icons shown (the macOS default)
  return r.out === '0' || r.out === '1' ? r.out : 'absent';
}

async function relaunchFinder() {
  if (dryRun()) return;
  await run('/usr/bin/killall', ['Finder']);
}

function writeMarker(val) {
  if (!markerPath) return;
  try { fs.writeFileSync(markerPath, String(val)); } catch (e) {}
}
function clearMarker() {
  if (!markerPath) return;
  try { if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath); } catch (e) {}
}

// Hide the desktop icons. Remembers the prior CreateDesktop value so restore is exact.
async function hide() {
  if (process.platform !== 'darwin') return false;
  if (hidden) return true;
  try {
    priorValue = await readCreateDesktop();
    if (!dryRun()) {
      const w = await run('/usr/bin/defaults', ['write', DOMAIN, KEY, '-bool', 'false']);
      if (!w.ok) return false;
    }
    writeMarker(priorValue);          // marker BEFORE relaunch so a crash mid-relaunch still recovers
    await relaunchFinder();
    hidden = true;
    return true;
  } catch (e) { return false; }
}

// Restore the desktop icons to exactly the user's prior state. Idempotent; also recovers a
// stranded state (marker present but our in-process flag is false, e.g. after a crash).
async function show() {
  if (process.platform !== 'darwin') return false;
  let prior = priorValue;
  if (prior === undefined && markerPath) {
    try { if (fs.existsSync(markerPath)) prior = (fs.readFileSync(markerPath, 'utf8').trim() || 'absent'); } catch (e) {}
  }
  if (prior === undefined && !hidden) return true;   // nothing to restore
  try {
    if (!dryRun()) {
      if (prior === '0') {
        await run('/usr/bin/defaults', ['write', DOMAIN, KEY, '-bool', 'false']); // user kept icons hidden globally
      } else if (prior === '1') {
        await run('/usr/bin/defaults', ['write', DOMAIN, KEY, '-bool', 'true']);
      } else {
        await run('/usr/bin/defaults', ['delete', DOMAIN, KEY]);                  // 'absent' → back to default
      }
    }
    await relaunchFinder();
    clearMarker();   // clear only AFTER Finder is actually relaunched, so a death mid-restore
                     // leaves the marker → next launch re-runs the (harmless, idempotent) restore
    hidden = false;
    priorValue = undefined;
    return true;
  } catch (e) { return false; }
}

// Synchronous restore for the quit path: the process may exit before an async show() finishes
// its defaults-write + killall, which would leave the icons hidden until the next launch (the
// marker would still recover them, but that's a worse experience). execFileSync guarantees the
// icons are back BEFORE the app dies. Same prior-state logic as show(); idempotent.
function showSync() {
  if (process.platform !== 'darwin') return false;
  let prior = priorValue;
  if (prior === undefined && markerPath) {
    try { if (fs.existsSync(markerPath)) prior = (fs.readFileSync(markerPath, 'utf8').trim() || 'absent'); } catch (e) {}
  }
  if (prior === undefined && !hidden) return true;
  const sync = (cmd, args) => { if (dryRun()) return; try { execFileSync(cmd, args, { timeout: 8000, stdio: 'ignore' }); } catch (e) {} };
  try {
    if (prior === '0') sync('/usr/bin/defaults', ['write', DOMAIN, KEY, '-bool', 'false']);
    else if (prior === '1') sync('/usr/bin/defaults', ['write', DOMAIN, KEY, '-bool', 'true']);
    else sync('/usr/bin/defaults', ['delete', DOMAIN, KEY]);
    sync('/usr/bin/killall', ['Finder']);
    clearMarker();
    hidden = false;
    priorValue = undefined;
    return true;
  } catch (e) { return false; }
}

// On startup: if a marker survived from a previous session, the app crashed while icons were
// hidden → restore them so the user is never left with a stranded icon-free desktop.
async function recoverIfStranded() {
  if (process.platform !== 'darwin' || !markerPath) return false;
  try {
    if (!fs.existsSync(markerPath)) return false;
    priorValue = (fs.readFileSync(markerPath, 'utf8').trim() || 'absent');
    hidden = true;
    return await show();
  } catch (e) { return false; }
}

function isHidden() { return hidden; }

module.exports = { configure, hide, show, showSync, recoverIfStranded, isHidden };
