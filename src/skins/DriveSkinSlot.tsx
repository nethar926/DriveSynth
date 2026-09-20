import type { CSSProperties } from 'react';
import type { EngineId } from '../audio';
import { AerospaceF14Overlay } from './aerospace-f14/AerospaceF14Overlay';
import { IonTwinOverlay } from './ion-twin/IonTwinOverlay';

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
    case 'i6-silk':
      return 'ice-v8';
    case 'ev-whine':
    case 'ev-inverter-climb':
    case 'ev-regen-howl':
    case 'ev-dual-motor':
      return 'ev-inverter';
    case 'aerospace-f14':
      return 'aerospace-f14';
    default:
      return 'default';
  }
}

/** Per-engine Drive plate — Ion Twin / Aerospace F14 mount full overlays; others use CSS tokens. */
export function DriveSkinSlot({
  engineId,
  rpmNorm,
  speedNorm,
  loadFeel,
  throttle,
}: DriveSkinProps) {
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
      {skinId === 'ion-twin' && (
        <IonTwinOverlay
          rpmNorm={rpmNorm}
          speedNorm={speedNorm}
          throttle={throttle}
          loadFeel={loadFeel}
        />
      )}
      {skinId === 'aerospace-f14' && (
        <AerospaceF14Overlay
          rpmNorm={rpmNorm}
          speedNorm={speedNorm}
          throttle={throttle}
          loadFeel={loadFeel}
        />
      )}
    </div>
  );
}
