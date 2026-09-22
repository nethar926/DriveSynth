/**
 * Audio Physics — thin ICE EngineState smooth → worklet bridge (§1 / §2).
 * firingMask: uint8; bit i SET → cylinder/slot i disabled. Default 0 = all fire.
 * Worklet owns sample-accurate crank schedule; bridge is HUD/QA + param push helper.
 */
import type { EngineStateSnapshot } from './types';

export type FiringFamilyName = 'crossPlane' | 'flatPlane' | 'i6' | 'even' | 'auto';

export interface EngineStatePackHints {
  cylinders?: number;
  firingFamily?: number | FiringFamilyName;
  firingMask?: number;
  dropCyl?: number;
  misfireAmount?: number;
  pulseJitter?: number;
  tauMan?: number;
  mufflerClosed?: number;
  mufflerOpen?: number;
}

export interface EngineStateRawInput {
  speed?: number;
  throttle: number;
  load?: number;
  rpmHint?: number;
}

export interface WorkletParamPush {
  rpm: number;
  throttle: number;
  load: number;
  firingMask: number;
  misfire: number;
  firingFamily: number;
  cylinders: number;
  pulseJitter: number;
  mufflerMixHint: number;
  intakeScaleHint: number;
  growlScaleHint: number;
}

const FAMILY_NUM: Record<string, number> = {
  auto: 0,
  crossPlane: 1,
  flatPlane: 2,
  i6: 3,
  even: 3,
};

export function isSlotDisabled(mask: number, slot: number): boolean {
  if (slot < 0 || slot > 7) return false;
  return (mask & (1 << slot)) !== 0;
}

/** Explicit eventAnglesDeg per family (§2.2). */
export function nextEventAnglesDeg(family: number, cylinders: number): number[] {
  let fam = family | 0;
  if (fam === 0) fam = cylinders === 8 ? 1 : 3;
  if (fam === 1 || fam === 2) return [0, 90, 180, 270, 360, 450, 540, 630];
  if (cylinders === 6) return [0, 120, 240, 360, 480, 600];
  const n = Math.max(4, Math.min(12, cylinders | 0));
  return Array.from({ length: n }, (_, i) => (i / n) * 720);
}

/** Estimate seconds to next event from crank ° and rpm (§2.1). */
export function estimateNextPulseDt(
  crankAngleDeg: number,
  nextEventDeg: number,
  rpm: number,
): number {
  const degPerSec = Math.max(200, rpm) * 6;
  let d = nextEventDeg - (crankAngleDeg % 720);
  if (d <= 0) d += 720;
  return d / degPerSec;
}

export class EngineStateBridge {
  rpm = 800;
  throttle = 0;
  load = 0;
  firingMask = 0;
  misfireAmount = 0;
  firingFamily = 0;
  cylinders = 8;
  crankAngleDeg = 0;
  manifoldNorm = 0;
  exhaustOpenness = 0.35;
  pulseJitter = 0.015;
  private tauMan = 0.12;

  get bankSchedule(): FiringFamilyName {
    const f = this.firingFamily | 0;
    if (f === 1) return 'crossPlane';
    if (f === 2) return 'flatPlane';
    if (f === 3 && this.cylinders === 6) return 'i6';
    if (f === 3) return 'even';
    return 'auto';
  }

  setFiringMask(mask: number): void {
    this.firingMask = Math.max(0, Math.min(255, Math.round(mask))) & 255;
  }

  dropCylinder(slot: number): void {
    const s = Math.max(0, Math.min(7, Math.round(slot)));
    this.firingMask = (this.firingMask | (1 << s)) & 255;
  }

  tick(dt: number, raw: EngineStateRawInput, hints: EngineStatePackHints = {}): void {
    const d = Math.max(0.001, Math.min(0.25, dt));
    if (hints.cylinders != null) this.cylinders = hints.cylinders;
    if (hints.firingFamily != null) {
      const f = hints.firingFamily;
      this.firingFamily = typeof f === 'string' ? (FAMILY_NUM[f] ?? 0) : f;
    }
    if (hints.firingMask != null) this.setFiringMask(hints.firingMask);
    if (hints.dropCyl != null) this.dropCylinder(hints.dropCyl);
    if (hints.misfireAmount != null) this.misfireAmount = Math.max(0, Math.min(1, hints.misfireAmount));
    if (hints.pulseJitter != null) this.pulseJitter = Math.max(0, Math.min(0.03, hints.pulseJitter));
    if (hints.tauMan != null) this.tauMan = hints.tauMan;

    const thr = Math.max(0, Math.min(1, raw.throttle));
    const load = Math.max(-1, Math.min(1, raw.load ?? 0));
    this.throttle += (thr - this.throttle) * Math.min(1, d * 12);
    this.load += (load - this.load) * Math.min(1, d * 10);
    const rpmTarget = raw.rpmHint != null ? raw.rpmHint : 800 + thr * 4000;
    this.rpm += (rpmTarget - this.rpm) * Math.min(1, d * 8);

    const a = 1 - Math.exp(-d / Math.max(0.05, this.tauMan));
    this.manifoldNorm += (thr - this.manifoldNorm) * a;
    const muffClosed = hints.mufflerClosed ?? 0.25;
    const muffOpen = hints.mufflerOpen ?? 0.9;
    const openT = 0.35 * Math.max(0, this.load) + 0.65 * this.throttle;
    this.exhaustOpenness = muffClosed + (muffOpen - muffClosed) * openT;

    this.crankAngleDeg = (this.crankAngleDeg + this.rpm * 6 * d) % 720;
  }

  toWorkletParams(): WorkletParamPush {
    const open = this.exhaustOpenness;
    return {
      rpm: this.rpm,
      throttle: this.throttle,
      load: this.load,
      firingMask: this.firingMask,
      misfire: this.misfireAmount,
      firingFamily: this.firingFamily,
      cylinders: this.cylinders,
      pulseJitter: Math.min(0.5, this.pulseJitter * (0.5 / 0.03)),
      mufflerMixHint: 1 - open * 0.55,
      intakeScaleHint: this.manifoldNorm * (0.3 + 0.7 * this.throttle),
      growlScaleHint: 0.85 + open * 0.25,
    };
  }

  snapshot(): EngineStateSnapshot {
    return {
      rpm: this.rpm,
      throttle: this.throttle,
      load: this.load,
      firingMask: this.firingMask,
      misfireAmount: this.misfireAmount,
      firingFamily: this.firingFamily,
      bankSchedule: this.bankSchedule,
      cylinders: this.cylinders,
      crankAngleDeg: this.crankAngleDeg,
      manifoldNorm: this.manifoldNorm,
      exhaustOpenness: this.exhaustOpenness,
      pulseJitter: this.pulseJitter,
    };
  }
}
