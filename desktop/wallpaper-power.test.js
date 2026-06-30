'use strict';

// Offline regression tests for the macOS wallpaper energy-controller power logic.
// Pure Node, no Electron, no network. Run: `node desktop/wallpaper-power.test.js`.
//
// The load-bearing case is resume-while-locked (the bug being fixed): a wake event
// that fires while the screen is still locked must NOT clear idle — it must keep the
// wallpaper visualizer idle so it does not render at full GPU behind the lock screen.

const assert = require('assert');
const { macWallpaperPowerTransition } = require('./wallpaper-power');

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log('ok - ' + name);
}

// lock-screen sets locked + idle:true
check('lock-screen sets screenLocked=true and idle=true', () => {
  const r = macWallpaperPowerTransition('lock-screen', false);
  assert.strictEqual(r.screenLocked, true);
  assert.strictEqual(r.idle, true);
});

// unlock-screen clears locked + idle:false
check('unlock-screen clears screenLocked and idle=false', () => {
  const r = macWallpaperPowerTransition('unlock-screen', true);
  assert.strictEqual(r.screenLocked, false);
  assert.strictEqual(r.idle, false);
});

// suspend idles without touching lock state (locked stays locked)
check('suspend keeps screenLocked unchanged and idle=true (was locked)', () => {
  const r = macWallpaperPowerTransition('suspend', true);
  assert.strictEqual(r.screenLocked, true);
  assert.strictEqual(r.idle, true);
});
check('suspend keeps screenLocked unchanged and idle=true (was unlocked)', () => {
  const r = macWallpaperPowerTransition('suspend', false);
  assert.strictEqual(r.screenLocked, false);
  assert.strictEqual(r.idle, true);
});

// THE FIX: resume while UNLOCKED clears idle (resume rendering).
check('resume while unlocked clears idle (idle=false)', () => {
  const r = macWallpaperPowerTransition('resume', false);
  assert.strictEqual(r.screenLocked, false);
  assert.strictEqual(r.idle, false);
});

// THE FIX (would fail before the patch): resume while LOCKED must re-assert idle,
// NOT clear it. Old code always cleared idle on resume → wallpaper rendered behind
// the lock screen.
check('resume while locked re-asserts idle (idle=true) — regression guard', () => {
  const r = macWallpaperPowerTransition('resume', true);
  assert.strictEqual(r.screenLocked, true, 'resume must not change lock state');
  assert.strictEqual(r.idle, true, 'resume-while-locked must keep idle=true, not clear it');
});

// Full lock→suspend→wake-to-lock sequence: idle must stay asserted at every step.
check('lock → suspend → resume(still locked) keeps idle asserted throughout', () => {
  let locked = false;
  let s = macWallpaperPowerTransition('lock-screen', locked);
  locked = s.screenLocked;
  assert.strictEqual(s.idle, true);
  s = macWallpaperPowerTransition('suspend', locked);
  locked = s.screenLocked;
  assert.strictEqual(s.idle, true);
  s = macWallpaperPowerTransition('resume', locked);
  locked = s.screenLocked;
  assert.strictEqual(locked, true, 'still locked after wake');
  assert.strictEqual(s.idle, true, 'must NOT resume rendering behind the lock screen');
  // Now the user actually unlocks → rendering resumes.
  s = macWallpaperPowerTransition('unlock-screen', locked);
  assert.strictEqual(s.screenLocked, false);
  assert.strictEqual(s.idle, false);
});

// Unknown events leave state unchanged (idle:null = no-op).
check('unknown event is a no-op (idle=null, lock unchanged)', () => {
  const r = macWallpaperPowerTransition('shutdown', true);
  assert.strictEqual(r.screenLocked, true);
  assert.strictEqual(r.idle, null);
});

console.log('\n' + pass + ' passed');
