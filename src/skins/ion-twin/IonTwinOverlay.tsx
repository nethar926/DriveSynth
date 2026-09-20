import type { CSSProperties } from 'react';

interface Props {
  rpmNorm: number;
  speedNorm: number;
  throttle: number;
  loadFeel: number;
}

/** Original twin-ion targeting HUD — Aurebesh labels via FT Aurebesh (OFL). */
export function IonTwinOverlay({ rpmNorm, speedNorm, throttle, loadFeel }: Props) {
  const lock = throttle > 0.55 || rpmNorm > 0.7;
  return (
    <div
      className={`ion-twin-overlay ${lock ? 'locked' : ''}`}
      style={
        {
          ['--ion-rpm']: rpmNorm,
          ['--ion-speed']: speedNorm,
          ['--ion-throttle']: throttle,
          ['--ion-load']: loadFeel,
        } as CSSProperties
      }
    >
      <div className="ion-scanlines" />
      <div className="ion-grid" />

      <div className="ion-status">
        <span className="aurebesh ion-status-ab">ION TWIN</span>
        <span className="ion-status-lat">ION TWIN · SCIFI</span>
        <span className={`ion-lock-pill ${lock ? 'on' : ''}`}>
          <span className="aurebesh">{lock ? 'LOCK' : 'SCAN'}</span>
          <span className="ion-lock-lat">{lock ? 'LOCK' : 'SCAN'}</span>
        </span>
      </div>

      <div className="ion-orbs" aria-hidden>
        <span className="ion-orb left" />
        <span className="ion-orb right" />
      </div>

      <svg className="ion-reticle" viewBox="0 0 320 320" aria-hidden>
        <defs>
          <filter id="ionGlow">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="160" cy="160" r="118" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
        <circle cx="160" cy="160" r="78" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <circle cx="160" cy="160" r="28" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M160 20 V62 M160 258 V300 M20 160 H62 M258 160 H300" stroke="currentColor" strokeWidth="2" />
        <path
          d="M96 96 L118 96 L118 118 M202 96 L224 96 L224 118 M96 202 L96 224 L118 224 M224 202 L224 224 L202 224"
          fill="none"
          stroke={lock ? '#3dff7a' : 'currentColor'}
          strokeWidth="2.5"
          filter="url(#ionGlow)"
        />
        <polygon
          points="160,148 166,160 160,172 154,160"
          fill={lock ? '#3dff7a' : 'currentColor'}
          opacity="0.9"
        />
      </svg>

      <div className="ion-brackets">
        <span className="br tl" />
        <span className="br tr" />
        <span className="br bl" />
        <span className="br brc" />
      </div>

      <div className="ion-footer">
        <span className="aurebesh">ENGAGE</span>
        <span className="ion-footer-lat">TARGETING ONLINE</span>
      </div>
    </div>
  );
}
