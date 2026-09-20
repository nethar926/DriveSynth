import test from "node:test";
import assert from "node:assert/strict";
import {
  createSimulation,
  stepSimulation,
  wheelRpm,
} from "../src/forge/simulation.ts";
import type { Controls, Drivetrain } from "../src/forge/simulation.ts";
const config: Drivetrain = {
  idleRpm: 780,
  redline: 6800,
  shiftRpm: 6100,
  gears: 6,
  finalDrive: 3.31,
};
const base: Controls = {
  pedal: 0,
  brake: false,
  mode: "manual",
  shift: 0,
  source: "demo",
  gpsSpeed: null,
};
function run(
  s: ReturnType<typeof createSimulation>,
  controls: Partial<Controls>,
  seconds = 1,
) {
  for (let i = 0; i < seconds * 60; i++)
    stepSimulation(s, config, 1 / 60, { ...base, ...controls });
}
test("neutral revs to redline without accelerating the car", () => {
  const s = createSimulation(config);
  s.gear = 0;
  run(s, { pedal: 1 }, 3);
  assert.equal(s.speedMps, 0);
  assert.equal(s.distance, 0);
  assert.ok(s.rpm > 6700);
  assert.ok(s.rpm <= 6800);
});
test("upshift drops actual RPM at the same GPS speed", () => {
  const s = createSimulation(config);
  s.speedMps = 18;
  s.gear = 2;
  run(s, { source: "gps", gpsSpeed: 18 }, 2);
  const before = s.rpm;
  stepSimulation(s, config, 1 / 60, {
    ...base,
    source: "gps",
    gpsSpeed: 18,
    shift: 1,
  });
  run(s, { source: "gps", gpsSpeed: 18 }, 1);
  assert.equal(s.gear, 3);
  assert.ok(s.rpm < before * 0.9);
  assert.ok(Math.abs(s.rpm - wheelRpm(18, config, 3)) < 1);
  assert.equal(s.speedMps, 18);
});
test("GPS speed cannot be overridden by virtual pedal or brakes", () => {
  const s = createSimulation(config);
  run(s, { source: "gps", gpsSpeed: 20, pedal: 1, brake: true }, 6);
  assert.ok(Math.abs(s.speedMps - 20) < 0.01);
});
test("stale GPS returns smoothly to idle instead of freezing high RPM", () => {
  const s = createSimulation(config);
  s.speedMps = 25;
  run(s, { source: "gps", gpsSpeed: null }, 12);
  assert.ok(s.speedMps < 0.01);
  assert.ok(s.rpm < 800);
});
test("automatic gearbox upshifts under power and downshifts to stop", () => {
  const s = createSimulation(config);
  run(s, { mode: "auto", pedal: 1 }, 35);
  assert.ok(s.gear >= 3);
  assert.ok(s.rpm <= config.redline);
  run(s, { mode: "auto", brake: true }, 30);
  assert.equal(s.speedMps, 0);
  assert.equal(s.gear, 1);
});
test("rejects downshifts that would over-rev", () => {
  const s = createSimulation(config);
  s.gear = 6;
  s.speedMps = 65;
  stepSimulation(s, config, 1 / 60, {
    ...base,
    source: "gps",
    gpsSpeed: 65,
    shift: -1,
  });
  assert.equal(s.gear, 6);
});
test("simulation stays finite and nonnegative after a long browser pause", () => {
  const s = createSimulation(config);
  stepSimulation(s, config, 100, { ...base, pedal: 1 });
  assert.ok(s.speedMps < 1);
  run(s, { brake: true }, 2);
  assert.equal(s.speedMps, 0);
  for (const [key, v] of Object.entries(s))
    if (typeof v === "number") assert.ok(Number.isFinite(v), key);
});
