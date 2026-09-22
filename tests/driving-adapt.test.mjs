import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const impl = readFileSync(join(root, 'src/audio/EngineSynthImpl.ts'), 'utf8');
const character = readFileSync(join(root, 'src/audio/CharacterEngine.ts'), 'utf8');

test('createEngineSynth restores CharacterEngine + RevForgeSynth wrap', () => {
  assert.match(impl, /new RevForgeSynth/);
  assert.match(impl, /new CharacterEngine/);
  assert.match(impl, /patch\?\.revforge/);
  assert.doesNotMatch(
    impl,
    /export function createEngineSynth\(ctx: AudioContext, patch\?: EnginePatch\): EngineSynth \{\s*return new EngineSynthImpl/,
  );
});

test('setDriving preserves Frontend rpmNorm', () => {
  assert.match(impl, /rpmNorm: d\.rpmNorm/);
  assert.match(impl, /Prefer Frontend rpmNorm/);
  assert.match(impl, /d\.rpmNorm !== undefined && Number\.isFinite\(d\.rpmNorm\)/);
});

test('fallback dual-map has no speed≥0.04 Hold-to-rev cliff', () => {
  // Old cliff: if (d.speed < 0.04) { rpmNorm = Math.max(rpmNorm, d.throttle * 0.55); } else { rpmNorm = clamp(rpmNorm + d.throttle * 0.12); }
  assert.doesNotMatch(
    impl,
    /if \(d\.speed < 0\.04\) \{\s*rpmNorm = Math\.max\(rpmNorm, d\.throttle \* 0\.55\);\s*\} else \{\s*rpmNorm = clamp\(rpmNorm \+ d\.throttle \* 0\.12\);/,
  );
  assert.match(impl, /Math\.max\(fromSpeed, fromThr\)/);
});

test('CharacterEngine keeps base continuous roar unmuted and forwards soft-cues', () => {
  assert.doesNotMatch(character, /legacyGate\.gain\.value=kind==='scifi'\|\|kind==='aerospace'\?0/);
  assert.match(character, /baseLayerLevel/);
  assert.match(character, /playStarter\(\)\{this\.base\.playStarter/);
  assert.match(character, /playShutoff\(\)\{this\.base\.playShutoff/);
  assert.doesNotMatch(character, /tieSignature===undefined\)this\.options\.tieSignature=1/);
});

test('shutoffUntil / started do not gate setDriving', () => {
  const setDriving = impl.slice(impl.indexOf('setDriving(d: DrivingInput)'), impl.indexOf('setIdleBand'));
  assert.doesNotMatch(setDriving, /this\.started/);
  assert.doesNotMatch(setDriving, /shutoffUntil/);
  const apply = impl.slice(impl.indexOf('private applyDriving'), impl.indexOf('private updateLockStage'));
  assert.doesNotMatch(apply, /if\s*\(\s*!this\.started/);
  assert.doesNotMatch(apply, /shutoffUntil/);
});
