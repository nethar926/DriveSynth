import type { CSSProperties } from 'react';

interface Props {
  rpmNorm: number;
  speedNorm: number;
  throttle: number;
  loadFeel: number;
}

const LOAD_R = 136;
const LOAD_C = 2 * Math.PI * LOAD_R;
const CHEVRON_COUNT = 6;

/** AB ARMED from throttle / rpm / loadFeel (Audio getHud) — high-power afterburn cue. */
function afterburnArmed(throttle: number, rpmNorm: number, loadFeel: number): boolean {
  return (
    (throttle >= 0.72 && rpmNorm >= 0.65) ||
    (rpmNorm >= 0.78 && loadFeel >= 0.55) ||
    (throttle >= 0.82 && loadFeel >= 0.5)
  );
}

/** Original aerospace HUD plate — pitch ladder + canopy frame; does not own SPEED/LOAD. */
export function AerospaceF14Overlay({ rpmNorm, speedNorm, throttle, loadFeel }: Props) {
  const rpm = Math.max(0, Math.min(1, rpmNorm));
  const thr = Math.max(0, Math.min(1, throttle));
  const load = Math.max(0, Math.min(1, loadFeel));
  const armed = afterburnArmed(thr, rpm, load);
  const litChevrons = Math.round(thr * CHEVRON_COUNT);
  const dashOffset = LOAD_C * (1 - load);
  const tipDeg = load * 360;
  const climbOffset = armed ? -10 : 0;
  const accent = armed ? '#ffc850' : '#7cffb2';
  const accentHot = armed ? '#ff7a2e' : '#7cffb2';

  return (
    <div
      className={`aero-f14-overlay ${armed ? 'armed' : ''}`}
      style={
        {
          ['--aero-rpm']: rpm,
          ['--aero-speed']: speedNorm,
          ['--aero-throttle']: thr,
          ['--aero-load']: load,
        } as CSSProperties
      }
    >
      <div className="aero-scanlines" />
      <div className="aero-grid" />
      {armed && <div className="aero-heat-band" aria-hidden />}

      <div className="aero-status">
        <span className="aero-status-name">AEROSPACE F14</span>
        <span className="aero-status-lat">AEROSPACE · DRIVE</span>
        <span className={`aero-ab-pill ${armed ? 'on' : ''}`}>
          {armed ? 'AB ARMED' : 'AB STBY'}
        </span>
      </div>

      <div className="aero-throttle" aria-hidden>
        <span className="aero-thr-label">THR</span>
        <div className={`aero-chevrons ${armed ? 'hot' : ''}`}>
          {Array.from({ length: CHEVRON_COUNT }, (_, i) => (
            <span key={i} className={i < litChevrons ? 'on' : ''} />
          ))}
        </div>
      </div>

      {/* Invented trapezoid canopy silhouette — not military IP */}
      <svg className="aero-canopy" viewBox="0 0 420 420" aria-hidden>
        <defs>
          <linearGradient id="aeroFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
            <stop offset="45%" stopColor={armed ? '#7cffb2' : '#8aa0a8'} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accentHot} stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          d="M70 50 L350 50 L390 140 L390 300 L350 370 L70 370 L30 300 L30 140 Z"
          fill="none"
          stroke="url(#aeroFrameGrad)"
          strokeWidth={armed ? 1.6 : 1.4}
          opacity={armed ? 0.9 : 0.75}
        />
        <path
          d="M90 70 L330 70 L360 145 L360 290 L330 350 L90 350 L60 290 L60 145 Z"
          fill={armed ? 'rgba(255,200,80,0.04)' : 'rgba(124,255,178,0.03)'}
          stroke={accent}
          strokeWidth={armed ? 0.8 : 0.7}
          opacity={armed ? 0.5 : 0.4}
        />
        <g stroke={accent} strokeWidth={armed ? 1.8 : 1.6} fill="none" opacity="0.85">
          <path d="M70 50 L70 78 M70 50 L98 50" />
          <path d="M350 50 L350 78 M350 50 L322 50" />
          <path d="M70 370 L70 342 M70 370 L98 370" />
          <path d="M350 370 L350 342 M350 370 L322 370" />
        </g>
      </svg>

      <svg
        className="aero-ladder"
        viewBox="0 0 340 340"
        role="img"
        aria-label={
          armed
            ? `Pitch reference climb cue at ${Math.round(load * 100)} percent load`
            : `Pitch ladder level flight at ${Math.round(load * 100)} percent load`
        }
      >
        <defs>
          <filter id="aeroBloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="170" cy="170" r="148" fill="none" stroke={accent} strokeWidth="0.6" opacity="0.22" />
        <circle
          cx="170"
          cy="170"
          r="120"
          fill="none"
          stroke={armed ? '#ff7a2e' : '#8aa0a8'}
          strokeWidth="0.8"
          opacity="0.32"
          strokeDasharray="4 6"
        />

        <g
          transform={`translate(0 ${climbOffset})`}
          stroke={accent}
          strokeLinecap="square"
          filter="url(#aeroBloom)"
        >
          <g opacity="0.55" strokeWidth="1.2">
            <line x1="110" y1="58" x2="140" y2="58" />
            <line x1="200" y1="58" x2="230" y2="58" />
            <line x1="140" y1="58" x2="140" y2="64" />
            <line x1="200" y1="58" x2="200" y2="64" />
          </g>
          <g opacity="0.7" strokeWidth="1.4">
            <line x1="95" y1="98" x2="145" y2="98" />
            <line x1="195" y1="98" x2="245" y2="98" />
            <line x1="145" y1="98" x2="145" y2="106" />
            <line x1="195" y1="98" x2="195" y2="106" />
          </g>
          <g strokeWidth={armed ? 2.4 : 2.2} opacity="0.95">
            <line x1="55" y1="170" x2="130" y2="170" />
            <line x1="210" y1="170" x2="285" y2="170" />
            <path
              d={armed ? 'M155 170 L170 152 L185 170 L170 166 Z' : 'M155 170 L170 155 L185 170 L170 168 Z'}
              fill={accent}
              stroke="none"
            />
          </g>
          <g opacity="0.7" strokeWidth="1.4">
            <line x1="95" y1="242" x2="145" y2="242" />
            <line x1="195" y1="242" x2="245" y2="242" />
            <line x1="145" y1="242" x2="145" y2="234" />
            <line x1="195" y1="242" x2="195" y2="234" />
          </g>
          <g opacity="0.55" strokeWidth="1.2">
            <line x1="110" y1="282" x2="140" y2="282" />
            <line x1="200" y1="282" x2="230" y2="282" />
            <line x1="140" y1="282" x2="140" y2="276" />
            <line x1="200" y1="282" x2="200" y2="276" />
          </g>
        </g>

        <g
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fontSize="10"
          fill={accent}
          opacity="0.65"
          letterSpacing="0.05em"
          transform={`translate(0 ${climbOffset})`}
        >
          <text x="100" y="62" textAnchor="end">
            +20
          </text>
          <text x="240" y="62">
            +20
          </text>
          <text x="85" y="102" textAnchor="end">
            +10
          </text>
          <text x="255" y="102">
            +10
          </text>
          <text x="85" y="246" textAnchor="end">
            −10
          </text>
          <text x="255" y="246">
            −10
          </text>
          <text x="100" y="286" textAnchor="end">
            −20
          </text>
          <text x="240" y="286">
            −20
          </text>
        </g>

        <g filter="url(#aeroBloom)">
          <circle
            cx="170"
            cy="170"
            r={LOAD_R}
            fill="none"
            stroke={armed ? 'rgba(255,122,46,0.18)' : 'rgba(124,255,178,0.12)'}
            strokeWidth={armed ? 5 : 4}
          />
          <circle
            className="aero-load-arc"
            cx="170"
            cy="170"
            r={LOAD_R}
            fill="none"
            stroke={accentHot}
            strokeWidth={armed ? 5 : 4}
            strokeLinecap="round"
            strokeDasharray={LOAD_C}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 170 170)"
            opacity="0.9"
          />
          <circle
            className="aero-load-tip"
            cx="170"
            cy={170 - LOAD_R}
            r="3.5"
            fill={accent}
            opacity="0.95"
            transform={`rotate(${tipDeg} 170 170)`}
          />
        </g>

        <text
          x="170"
          y="210"
          textAnchor="middle"
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fontSize="10"
          fill={armed ? '#ffc850' : '#8aa0a8'}
          letterSpacing="0.22em"
          opacity="0.8"
        >
          PITCH REF
        </text>
        <text
          x="170"
          y="228"
          textAnchor="middle"
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fontSize="14"
          fontWeight="700"
          fill={accentHot}
          letterSpacing="0.1em"
        >
          {armed ? '+CLIMB' : 'LVL'}
        </text>
      </svg>

      <div className="aero-footer">
        <span className="aero-mode">{armed ? 'AFTERBURN' : 'FLIGHT STANDBY'}</span>
      </div>
    </div>
  );
}
