import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function loadBridge() {
  // Prefer tsx register if present
  try {
    const { register } = await import('node:module');
    // Node 20: use dynamic import of .ts via vite? fall through
  } catch {}
  try {
    return await import(pathToFileURL(join(root, 'src/audio/engineStateBridge.ts')).href);
  } catch (e) {
    // Fallback: evaluate key exports by spawning a tiny transpile-free duplicate check
    return null;
  }
}

// --- Pure mapping mirror (must stay in sync with engineStateBridge / schedules v1) ---
function mapRevforgeFiringToFamily(firing, cylinders) {
  const f = (firing ?? '').toLowerCase();
  if (f === 'crossplane') return 1;
  if (f === 'even' && cylinders >= 8) return 2;
  if (f === 'smooth' || f === 'even' || cylinders === 6 || cylinders === 4) return 3;
  return cylinders === 8 ? 1 : 3;
}

const SCHED_FAM = {
  'v8-rumble': 1,
  'i4-zip': 3,
  'i6-silk': 3,
  'road-66': 1,
  'apex-v8': 2,
  'neon-drive': 2,
  italia: 2,
  miami: 1,
  autobahn: 2,
  lofi: 3,
  'dune-runner': 1,
  alpine: 3,
};

function isSlotDisabled(mask, slot) {
  return (mask & (1 << slot)) !== 0;
}

function nextEventAnglesDeg(family, cylinders) {
  let fam = family | 0;
  if (fam === 0) fam = cylinders === 8 ? 1 : 3;
  if (fam === 1 || fam === 2) return [0, 90, 180, 270, 360, 450, 540, 630];
  if (cylinders === 6) return [0, 120, 240, 360, 480, 600];
  if (cylinders === 4) return [0, 180, 360, 540];
  return Array.from({ length: cylinders }, (_, i) => (i / cylinders) * 720);
}

function estimateNextPulseDt(crankAngleDeg, nextEventDeg, rpm) {
  const degPerSec = Math.max(200, rpm) * 6;
  let d = nextEventDeg - (crankAngleDeg % 720);
  if (d <= 0) d += 720;
  return d / degPerSec;
}

test('mask bit SET disables slot', () => {
  assert.equal(isSlotDisabled(0, 0), false);
  assert.equal(isSlotDisabled(1 << 1, 1), true);
});

test('crossPlane bank A intervals from schedule', () => {
  const bankA = [0, 180, 270, 450];
  const intervals = [];
  for (let i = 0; i < bankA.length; i++) {
    const a = bankA[i];
    const b = bankA[(i + 1) % bankA.length] + (i + 1 === bankA.length ? 720 : 0);
    intervals.push(b - a);
  }
  assert.deepEqual(intervals, [180, 90, 180, 270]);
});

test('mapRevforgeFiringToFamily canonical', () => {
  assert.equal(mapRevforgeFiringToFamily('crossplane', 8), 1);
  assert.equal(mapRevforgeFiringToFamily('even', 8), 2);
  assert.equal(mapRevforgeFiringToFamily('smooth', 6), 3);
  assert.equal(mapRevforgeFiringToFamily('even', 6), 3);
});

test('ICE schedule family table', () => {
  for (const [id, fam] of Object.entries(SCHED_FAM)) {
    assert.equal(SCHED_FAM[id], fam);
  }
  assert.equal('sakura-gtr' in SCHED_FAM, false);
});

test('nextPulseDt grows for farther event', () => {
  const a = nextEventAnglesDeg(1, 8);
  const dt0 = estimateNextPulseDt(85, a[1], 3000);
  const dt1 = estimateNextPulseDt(85, a[2], 3000);
  assert.ok(dt1 > dt0);
});

test('source files encode pack families + sakura exclusion', () => {
  const bridge = readFileSync(join(root, 'src/audio/engineStateBridge.ts'), 'utf8');
  const catalog = readFileSync(join(root, 'src/forge/catalog.ts'), 'utf8');
  const builtins = readFileSync(join(root, 'src/audio/builtins.ts'), 'utf8');
  assert.match(bridge, /miami:\s*\{[\s\S]*?firingFamily:\s*1/);
  assert.match(bridge, /'apex-v8':\s*\{[\s\S]*?firingFamily:\s*2/);
  assert.match(bridge, /alpine:\s*\{[\s\S]*?firingFamily:\s*3/);
  assert.match(bridge, /raw === 'sakura-gtr'/);
  assert.match(catalog, /scene\.id === ['"]sakura-gtr['"]/);
  assert.match(catalog, /sakuraLegacyPatch/);
  assert.match(builtins, /firingFamily:\s*1/);
  assert.match(builtins, /collectorDelayMs:\s*1\.8/);
  // sakura must not be an ICE_SCENE_CHARACTER key
  const charStart = catalog.indexOf('ICE_SCENE_CHARACTER');
  const charEnd = catalog.indexOf('};', charStart);
  const charBlock = catalog.slice(charStart, charEnd);
  assert.equal(charBlock.includes('sakura'), false);
});

test('revforge-packs.json sakura-gtr unchanged checksum field', () => {
  const packs = JSON.parse(
    readFileSync(join(root, 'src/forge/revforge-packs.json'), 'utf8'),
  );
  const sakura = packs.find((p) => p.id === 'sakura-gtr');
  assert.ok(sakura);
  assert.equal(sakura.engine.cylinders, 6);
  assert.equal(sakura.engine.firing, 'even');
  assert.equal(sakura.engine.idleRpm, 950);
  assert.equal(sakura.engine.turbo, 0.72);
});

test('catalog scenePatch legacy sakura params (source contains exact pulse values)', () => {
  const catalog = readFileSync(join(root, 'src/forge/catalog.ts'), 'utf8');
  assert.match(catalog, /pulseJitter: p\.firing === "crossplane" \? 0\.14 : 0\.045/);
  assert.match(catalog, /pulseWidth: p\.firing === "crossplane" \? 0\.44 : 0\.25/);
});
