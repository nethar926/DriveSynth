/** Ion Twin rpmNorm lock ladder (~4% hysteresis). */

import type { LockStage } from './types';

export type { LockStage };

const STAGE_ORDER: LockStage[] = ['none', 'identified', 'lock', 'kill'];

/** Rising enter thresholds (rpmNorm). Falling exits at enter − hysteresis. */
const ENTER: Record<Exclude<LockStage, 'none'>, number> = {
  identified: 0.5,
  lock: 0.7,
  kill: 0.86,
};

function stageIndex(stage: LockStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * Next lock stage from rpmNorm with hysteresis so edges don’t flicker.
 * Rising: enter at 0.50 / 0.70 / 0.86 (none→identified→lock→kill).
 * Falling: leave at enter − h (default h≈0.04 → 0.46 / 0.66 / 0.82).
 */
export function nextLockStage(
  rpmNorm: number,
  prev: LockStage,
  hysteresis = 0.04,
): LockStage {
  const r = Math.max(0, Math.min(1, Number.isFinite(rpmNorm) ? rpmNorm : 0));
  const h = Math.max(0, hysteresis);
  let idx = stageIndex(prev);
  if (idx < 0) idx = 0;

  while (idx < STAGE_ORDER.length - 1) {
    const next = STAGE_ORDER[idx + 1] as Exclude<LockStage, 'none'>;
    if (r >= ENTER[next]) idx += 1;
    else break;
  }

  while (idx > 0) {
    const cur = STAGE_ORDER[idx] as Exclude<LockStage, 'none'>;
    if (r < ENTER[cur] - h) idx -= 1;
    else break;
  }

  return STAGE_ORDER[idx]!;
}

/** True for packs that use the Ion Twin lock ladder (scifi / ion-twin). */
export function packSupportsLockLadder(
  kind: string,
  topology?: string,
  id?: string,
): boolean {
  if (kind === 'scifi') return true;
  if (topology === 'ion-twin' || topology === 'tie-fighter') return true;
  if (id === 'ion-twin' || id === 'tie-fighter') return true;
  return false;
}
