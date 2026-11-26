import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const WWW = path.join(ROOT, 'www');

function loadArenas() {
  const code = fs.readFileSync(path.join(WWW, 'js', 'levels.js'), 'utf8');
  const ctx = { window: {}, Math, console };
  vm.runInNewContext(code, ctx);
  return ctx.window;
}

test('all 20 arenas build cleanly with valid spawn, targets, portals, and 4 bosses', () => {
  const win = loadArenas();
  assert.equal(win.SLING_ARENA_META.length, 20);
  assert.equal(win.SLING_ARENA_BUILDERS.length, 20);

  let bossCount = 0;
  for (let i = 0; i < win.SLING_ARENA_BUILDERS.length; i++) {
    const a = win.SLING_ARENA_BUILDERS[i]();
    assert.equal(a.num, i + 1);
    assert.ok(a.spawn.x >= 32 && a.spawn.x <= a.width - 32, `A${a.num} invalid spawn.x`);
    assert.ok(a.spawn.y >= 32 && a.spawn.y <= a.height - 32, `A${a.num} invalid spawn.y`);
    assert.ok(a.targets.length >= 1, `A${a.num} must have targets`);

    // Ensure spawn does not overlap any spike or solid wall
    for (const s of a.spikes) {
      const hit = a.spawn.x + 10 > s.x && a.spawn.x - 10 < s.x + s.w && a.spawn.y + 10 > s.y && a.spawn.y - 10 < s.y + s.h;
      assert.equal(hit, false, `A${a.num} spawn overlaps spike`);
    }
    for (const w of a.walls) {
      const hit = a.spawn.x + 10 > w.x && a.spawn.x - 10 < w.x + w.w && a.spawn.y + 10 > w.y && a.spawn.y - 10 < w.y + w.h;
      assert.equal(hit, false, `A${a.num} spawn overlaps wall`);
    }
    // Verify every portal has a valid partner
    for (const pt of a.portals) {
      const partner = a.portals.find(o => o.id === pt.pairId);
      assert.ok(partner, `A${a.num} portal ${pt.id} missing partner ${pt.pairId}`);
    }
    if (a.targets.some(t => t.kind === 'boss')) bossCount++;
  }
  assert.equal(bossCount, 4, 'Expected exactly 4 mini-bosses (W5, W10, W15, W20)');
});

test('security headers, strict CSP (no inline script), COPPA 13+, and privacy contact are enforced', () => {
  const headers = fs.readFileSync(path.join(WWW, '_headers'), 'utf8');
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/i);
  assert.match(headers, /X-Frame-Options:\s*DENY/i);
  assert.match(headers, /Content-Security-Policy:.*script-src 'self'/i);

  const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.match(html, /https:\/\/jakeplay\.com\/\?auth=login/, 'Sign-in should link directly to main JakePlay portal');
  assert.match(html, /id="gameFormDelete"/);

  const privacy = fs.readFileSync(path.join(WWW, 'privacy.html'), 'utf8');
  assert.doesNotMatch(privacy, /outlook\.com/i);
  assert.match(privacy, /privacy@jakeplay\.com/i);
  assert.match(privacy, /COPPA/i);

  const engine = fs.readFileSync(path.join(WWW, 'js', 'engine.js'), 'utf8');
  assert.match(engine, /function escapeHtml\(/);
  assert.match(engine, /slingshot_dummy_guest_v1/);
});
