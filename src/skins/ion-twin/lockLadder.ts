/** Ion Twin lock ladder UI labels; stage math lives in audio/lockStage. */

export type { LockStage as IonLockStage } from '../../audio';
export { nextLockStage as nextIonLockStage } from '../../audio';

import type { LockStage } from '../../audio';

/** Commentary chip label; NONE shows nothing. */
export const ION_LOCK_CHIP: Record<LockStage, string | null> = {
  none: null,
  identified: 'IDENTIFIED',
  lock: 'LOCK',
  kill: 'KILL',
};

/** Compact pill label (Aurebesh / Latin short). */
export const ION_LOCK_PILL: Record<LockStage, string> = {
  none: 'SCAN',
  identified: 'IDENT',
  lock: 'LOCK',
  kill: 'KILL',
};

/** Footer / status Latin line. */
export const ION_LOCK_FOOTER: Record<LockStage, { aurebesh: string; latin: string }> = {
  none: { aurebesh: 'ENGAGE', latin: 'TARGETING ONLINE' },
  identified: { aurebesh: 'IDENTIFIED', latin: 'TARGET IDENTIFIED' },
  lock: { aurebesh: 'LOCKED', latin: 'TARGET LOCK' },
  kill: { aurebesh: 'KILL', latin: 'TARGET KILL' },
};

export function ionLockChipLabel(stage: LockStage): string | null {
  return ION_LOCK_CHIP[stage];
}
