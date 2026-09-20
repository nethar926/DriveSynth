import type { CSSProperties } from 'react';

interface Props {
  rpmNorm: number;
  speedNorm: number;
  throttle: number;
  loadFeel: number;
}

const RPM_R = 132;
const RPM_C = 2 * Math.PI * RPM_R;

/** Amber scan → green lock from throttle / rpm / loadFeel (Audio getHud). */
function acquireLocked(throttle: number, rpmNorm: number, loadFeel: number): boolean {
  return (
    (throttle >= 0.55 && rpmNorm >= 0.58) ||
    (rpmNorm >= 0.72 && loadFeel >= 0.42) ||
    (throttle >= 0.68 && loadFeel >= 0.55)
  );
}

function BracketSvg({ locked }: { locked: boolean }) {
  const stroke = locked ? '#3dff7a' : 'currentColor';
  const sw = locked ? 2.5 : 2;
  return (
    <svg viewBox="0 0 56 56" aria-hidden>
      <path d="M4 18 V4 H18" fill="none" stroke={stroke} strokeWidth={sw} />
      <path d="M38 4 H52 V18" fill="none" stroke={stroke} strokeWidth={sw} />
      <path d="M52 38 V52 H38" fill="none" stroke={stroke} strokeWidth={sw} />
      <path d="M18 52 H4 V38" fill="none" stroke={stroke} strokeWidth={sw} />
      <rect
        x="20"
        y="20"
        width="16"
        height="16"
        fill={locked ? 'rgba(61,255,122,0.08)' : 'none'}
        stroke={stroke}
        strokeWidth={locked ? 1 : 0.75}
        opacity={locked ? 1 : 0.35}
      />
    </svg>
  );
}

/** Original twin-ion targeting HUD — Aurebesh labels via FT Aurebesh (OFL). */
export function IonTwinOverlay({ rpmNorm, speedNorm, throttle, loadFeel }: Props) {
  const rpm = Math.max(0, Math.min(1, rpmNorm));
  const lock = acquireLocked(throttle, rpm, loadFeel);
  const dashOffset = RPM_C * (1 - rpm);
  const tipDeg = rpm * 360;
  const accent = lock ? '#3dff7a' : '#ffb020';

  const minorTicks = [10, 20, 40, 50, 70, 80, 100, 110, 130, 140, 160, 170, 190, 200, 220, 230, 250, 260, 280, 290, 310, 320, 340, 350];

  return (
    <div
      className={`ion-twin-overlay ${lock ? 'locked' : ''}`}
      style={
        {
          ['--ion-rpm']: rpm,
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

      {/* Hexagonal outer frame — original geometry */}
      <svg className="ion-hex" viewBox="0 0 400 400" aria-hidden>
        <defs>
          <linearGradient id="ionHexStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
            <stop offset="50%" stopColor="#ffb020" stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <polygon
          points="200,18 362,110 362,290 200,382 38,290 38,110"
          fill="none"
          stroke="url(#ionHexStroke)"
          strokeWidth={lock ? 2 : 1.5}
          opacity={lock ? 0.85 : 0.7}
        />
        <polygon
          points="200,42 340,122 340,278 200,358 60,278 60,122"
          fill={lock ? 'rgba(61,255,122,0.04)' : 'rgba(255,176,32,0.03)'}
          stroke={accent}
          strokeWidth="0.75"
          opacity={lock ? 0.5 : 0.4}
        />
        <g stroke={accent} strokeWidth="1.5" fill="none" opacity="0.85">
          <path d="M190 28 L200 18 L210 28" />
          <path d="M352 100 L362 110 L352 122" />
          <path d="M352 278 L362 290 L352 300" />
          <path d="M210 372 L200 382 L190 372" />
          <path d="M48 300 L38 290 L48 278" />
          <path d="M48 122 L38 110 L48 100" />
        </g>
      </svg>

      <svg
        className="ion-reticle"
        viewBox="0 0 320 320"
        role="img"
        aria-label={
          lock
            ? `Locked targeting reticle at ${Math.round(rpm * 100)} percent`
            : `RPM-linked targeting reticle at ${Math.round(rpm * 100)} percent`
        }
      >
        <defs>
          <filter id="ionGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Nested rings */}
        <circle cx="160" cy="160" r="142" fill="none" stroke={accent} strokeWidth="0.6" opacity="0.25" />
        <circle cx="160" cy="160" r="118" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.55" />
        <circle cx="160" cy="160" r="88" fill="none" stroke="#ffb020" strokeWidth="1" opacity={lock ? 0.35 : 0.4} />
        <circle cx="160" cy="160" r="52" fill="none" stroke={accent} strokeWidth={lock ? 2 : 1.5} opacity={lock ? 0.85 : 0.7} />

        {/* Major + minor ticks */}
        <g stroke={accent} strokeLinecap="round" filter="url(#ionGlow)">
          <g strokeWidth={lock ? 2.2 : 2} opacity="0.9">
            <line x1="160" y1="22" x2="160" y2="38" />
            <line x1="160" y1="282" x2="160" y2="298" />
            <line x1="22" y1="160" x2="38" y2="160" />
            <line x1="282" y1="160" x2="298" y2="160" />
            <line x1="71.4" y1="71.4" x2="82.7" y2="82.7" />
            <line x1="237.3" y1="237.3" x2="248.6" y2="248.6" />
            <line x1="248.6" y1="71.4" x2="237.3" y2="82.7" />
            <line x1="82.7" y1="237.3" x2="71.4" y2="248.6" />
          </g>
          <g strokeWidth="1" opacity="0.45">
            {minorTicks.map((deg) => (
              <line key={deg} transform={`rotate(${deg} 160 160)`} x1="160" y1="36" x2="160" y2="46" />
            ))}
          </g>
        </g>

        {/* RPM arc driven by rpmNorm */}
        <g filter="url(#ionGlow)">
          <circle
            cx="160"
            cy="160"
            r={RPM_R}
            fill="none"
            stroke="rgba(255,176,32,0.15)"
            strokeWidth="5"
          />
          <circle
            className="ion-rpm-arc"
            cx="160"
            cy="160"
            r={RPM_R}
            fill="none"
            stroke="#ffb020"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RPM_C}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 160 160)"
            opacity="0.95"
          />
          <circle
            className="ion-rpm-tip"
            cx="160"
            cy="28"
            r="3.5"
            fill={lock ? '#3dff7a' : '#ffb020'}
            opacity="0.95"
            transform={`rotate(${tipDeg} 160 160)`}
          />
        </g>

        {/* Crosshair */}
        <g stroke={accent} strokeWidth={lock ? 1.2 : 1} opacity={lock ? 0.85 : 0.65}>
          <line x1="160" y1="118" x2="160" y2="142" />
          <line x1="160" y1="178" x2="160" y2="202" />
          <line x1="118" y1="160" x2="142" y2="160" />
          <line x1="178" y1="160" x2="202" y2="160" />
        </g>
        <circle cx="160" cy="160" r={lock ? 6 : 4} fill="none" stroke={accent} strokeWidth={lock ? 2 : 1.5} />
        <circle cx="160" cy="160" r={lock ? 2 : 1.5} fill={accent} />

        <text
          x="160"
          y="230"
          textAnchor="middle"
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fontSize="11"
          fill={accent}
          letterSpacing="0.2em"
          opacity="0.75"
        >
          {lock ? 'ACQUIRED' : 'RPM ARC'}
        </text>
        <text
          x="160"
          y="248"
          textAnchor="middle"
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fontSize="16"
          fontWeight="700"
          fill="#ffb020"
          letterSpacing="0.08em"
        >
          {Math.round(rpm * 100)}%
        </text>
      </svg>

      <div className="ion-brackets" aria-hidden>
        <span className="br tl">
          <BracketSvg locked={lock} />
        </span>
        <span className="br tr">
          <BracketSvg locked={lock} />
        </span>
        <span className="br bl">
          <BracketSvg locked={lock} />
        </span>
        <span className="br brc">
          <BracketSvg locked={lock} />
        </span>
      </div>

      <div className="ion-footer">
        <span className="aurebesh">{lock ? 'LOCKED' : 'ENGAGE'}</span>
        <span className="ion-footer-lat">{lock ? 'TARGET LOCK' : 'TARGETING ONLINE'}</span>
      </div>
    </div>
  );
}
