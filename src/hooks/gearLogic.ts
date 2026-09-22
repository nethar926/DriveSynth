export type IndicatedGear = 'N' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Baseline mph thresholds to ENTER gear (rising) — 8-speed reference curve. */
export const BASE_ENTER = [0, 8, 18, 32, 48, 68, 90, 115] as const;
/** Baseline mph thresholds to LEAVE gear (falling) — hysteresis. */
export const BASE_EXIT = [0, 5, 14, 26, 42, 60, 80, 102] as const;

/** Top-speed reference that keeps BASE_ENTER/EXIT unchanged at gearCount=8. */
export const DEFAULT_MAX_TOP_SPEED_MPH = 140;
export const DEFAULT_GEAR_COUNT = 8;

export type GearTables = { enter: number[]; exit: number[]; gearCount: number; maxTopSpeedMph: number };

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Sample the 8-gear baseline at fractional index 0..7. */
function sampleBaseline(table: readonly number[], index: number): number {
  const i = Math.min(7, Math.max(0, index));
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return table[lo]!;
  return lerp(table[lo]!, table[hi]!, i - lo);
}

/**
 * Build ENTER/EXIT tables for gearCount (4–8), scaled to maxTopSpeedMph.
 * gearCount=8 + DEFAULT_MAX_TOP_SPEED_MPH reproduces BASE_ENTER / BASE_EXIT exactly.
 */
export function buildGearTables(
  gearCount: number = DEFAULT_GEAR_COUNT,
  maxTopSpeedMph: number = DEFAULT_MAX_TOP_SPEED_MPH,
): GearTables {
  const n = clampInt(gearCount, 4, 8);
  const top = Math.min(300, Math.max(60, Number.isFinite(maxTopSpeedMph) ? maxTopSpeedMph : DEFAULT_MAX_TOP_SPEED_MPH));
  const scale = top / DEFAULT_MAX_TOP_SPEED_MPH;
  const enter: number[] = [];
  const exit: number[] = [];
  for (let i = 0; i < n; i++) {
    const src = n === 1 ? 0 : (i / (n - 1)) * 7;
    enter.push(sampleBaseline(BASE_ENTER, src) * scale);
    exit.push(sampleBaseline(BASE_EXIT, src) * scale);
  }
  return { enter, exit, gearCount: n, maxTopSpeedMph: top };
}

function gearNum(g: IndicatedGear): number {
  return g === 'N' ? 0 : g;
}

function fromNum(n: number, maxGear: number): IndicatedGear {
  if (n <= 0) return 'N';
  return Math.min(maxGear, Math.max(1, n)) as IndicatedGear;
}

export function formatGear(g: IndicatedGear): string {
  return g === 'N' ? 'N' : String(g);
}

export function clampIndicatedGear(g: IndicatedGear, gearCount: number): IndicatedGear {
  const max = clampInt(gearCount, 4, 8);
  if (g === 'N') return 'N';
  return Math.min(max, Math.max(1, g)) as IndicatedGear;
}

/** AUTO: indicated gear from speed with hysteresis. */
export function autoGearFromSpeed(
  mph: number,
  prev: IndicatedGear,
  tables: GearTables = buildGearTables(),
): IndicatedGear {
  const v = Math.max(0, mph);
  const max = tables.gearCount;
  const { enter, exit } = tables;
  if (v < 2) return 'N';
  let g = gearNum(prev);
  if (g === 0) g = 1;
  if (g > max) g = max;
  while (g < max && v >= enter[g]!) g += 1;
  while (g > 1 && v < exit[g - 1]!) g -= 1;
  return fromNum(g, max);
}

/** MANUAL: auto-downshift only when speed falls below current gear window. */
export function manualAutoDown(
  mph: number,
  current: IndicatedGear,
  tables: GearTables = buildGearTables(),
): IndicatedGear {
  if (current === 'N') return 'N';
  let g = gearNum(current);
  const max = tables.gearCount;
  if (g > max) g = max;
  const v = Math.max(0, mph);
  const { exit } = tables;
  while (g > 1 && v < exit[g - 1]!) g -= 1;
  if (v < 2) return 'N';
  return fromNum(g, max);
}

export function shiftUp(current: IndicatedGear, gearCount: number = DEFAULT_GEAR_COUNT): IndicatedGear {
  const max = clampInt(gearCount, 4, 8);
  if (current === 'N') return 1;
  if (current >= max) return max as IndicatedGear;
  return (current + 1) as IndicatedGear;
}

export function shiftDown(current: IndicatedGear): IndicatedGear {
  if (current === 'N') return 'N';
  if (current === 1) return 'N';
  return (current - 1) as IndicatedGear;
}
