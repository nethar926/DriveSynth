import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BASE_ENTER,
  BASE_EXIT,
  DEFAULT_MAX_TOP_SPEED_MPH,
  autoGearFromSpeed,
  buildGearTables,
  shiftUp,
} from '../src/hooks/gearLogic.ts';

test('default 8-gear tables match classic ENTER/EXIT mph windows', () => {
  const t = buildGearTables(8, DEFAULT_MAX_TOP_SPEED_MPH);
  assert.equal(t.gearCount, 8);
  assert.deepEqual(
    t.enter.map((v) => Math.round(v * 1000) / 1000),
    [...BASE_ENTER],
  );
  assert.deepEqual(
    t.exit.map((v) => Math.round(v * 1000) / 1000),
    [...BASE_EXIT],
  );
});

test('doubling top speed doubles thresholds', () => {
  const t = buildGearTables(8, DEFAULT_MAX_TOP_SPEED_MPH * 2);
  assert.equal(Math.round(t.enter[7]!), BASE_ENTER[7]! * 2);
  assert.equal(Math.round(t.exit[7]!), BASE_EXIT[7]! * 2);
});

test('4-gear curve redistributes across the same mph envelope', () => {
  const t = buildGearTables(4, DEFAULT_MAX_TOP_SPEED_MPH);
  assert.equal(t.gearCount, 4);
  assert.equal(Math.round(t.enter[0]!), 0);
  assert.equal(Math.round(t.enter[3]!), BASE_ENTER[7]!);
});

test('auto gear respects scaled tables and gear cap', () => {
  const t = buildGearTables(6, DEFAULT_MAX_TOP_SPEED_MPH);
  assert.equal(autoGearFromSpeed(0.5, 'N', t), 'N');
  assert.equal(autoGearFromSpeed(25, 1, t), 2);
  const top = autoGearFromSpeed(200, 1, t);
  assert.equal(top, 6);
  assert.equal(shiftUp(6, 6), 6);
  assert.equal(shiftUp('N', 6), 1);
});
