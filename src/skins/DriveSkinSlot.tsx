import type { CSSProperties } from 'react';
import type { EngineId } from '../audio';

/**
 * Mount point for @Visual Skins per-engine Drive plates.
 * Spec: /workspace/drivesynth-skins/SKIN_FRAMEWORK.md
 */
export interface DriveSkinProps {
  engineId: EngineId;
  rpmNorm: number;
  speedNorm: number;
  loadFeel: number;
  throttle: number;
}

/** engineId → skin id (Visual Skins registry) */
export function skinIdForEngine(engineId: string): string {
  switch (engineId) {
    case 'tie-fighter':
      return 'ion-twin';
    case 'v8-rumble':
    case 'i4-zip':
      return 'ice-v8';
    case 'ev-whine':
      return 'ev-inverter';
    case 'aerospace-f14':
      return 'aerospace-f14';
    default:
      return 'default';
  }
}

/** Default plate — Visual Skins replaces with IonTwinReticle etc. when greenlit. */
export function DriveSkinSlot({ engineId, rpmNorm, throttle }: DriveSkinProps) {
  const skinId = skinIdForEngine(engineId);
  return (
    <div
      className={`drive-skin drive-skin-${skinId}`}
      data-skin={skinId}
      data-engine={engineId}
      aria-hidden
      style={
        {
          ['--skin-rpm' as string]: String(rpmNorm),
          ['--skin-throttle' as string]: String(throttle),
        } as CSSProperties
      }
    >
      <div className="drive-skin-plate" />
      {skinId === 'ion-twin' && <div className="drive-skin-ion-stub" />}
    </div>
  );
}
