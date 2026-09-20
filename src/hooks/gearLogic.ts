export type IndicatedGear = 'N' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** mph thresholds to ENTER gear (rising). */
const ENTER = [0, 8, 18, 32, 48, 68, 90, 115];
/** mph thresholds to LEAVE gear (falling) — hysteresis. */
const EXIT = [0, 5, 14, 26, 42, 60, 80, 102];

function gearNum(g: IndicatedGear): number {
  return g === 'N' ? 0 : g;
}

function fromNum(n: number): IndicatedGear {
  if (n <= 0) return 'N';
  return Math.min(8, Math.max(1, n)) as IndicatedGear;
}

export function formatGear(g: IndicatedGear): string {
  return g === 'N' ? 'N' : String(g);
}

/** AUTO: indicated gear from speed with hysteresis. */
export function autoGearFromSpeed(mph: number, prev: IndicatedGear): IndicatedGear {
  const v = Math.max(0, mph);
  if (v < 2) return 'N';
  let g = gearNum(prev);
  if (g === 0) g = 1;
  while (g < 8 && v >= ENTER[g]) g += 1;
  while (g > 1 && v < EXIT[g - 1]) g -= 1;
  return fromNum(g);
}

/** MANUAL: auto-downshift only when speed falls below current gear window. */
export function manualAutoDown(mph: number, current: IndicatedGear): IndicatedGear {
  if (current === 'N') return 'N';
  let g = gearNum(current);
  const v = Math.max(0, mph);
  while (g > 1 && v < EXIT[g - 1]) g -= 1;
  if (v < 2) return 'N';
  return fromNum(g);
}

export function shiftUp(current: IndicatedGear): IndicatedGear {
  if (current === 'N') return 1;
  if (current >= 8) return 8;
  return (current + 1) as IndicatedGear;
}

export function shiftDown(current: IndicatedGear): IndicatedGear {
  if (current === 'N') return 'N';
  if (current === 1) return 'N';
  return (current - 1) as IndicatedGear;
}
