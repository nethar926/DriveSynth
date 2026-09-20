import { useRef, type CSSProperties } from 'react';
import {
  ION_LOCK_FOOTER,
  ION_LOCK_PILL,
  nextIonLockStage,
  type IonLockStage,
} from './lockLadder';

interface Props {
  rpmNorm: number;
  speedNorm: number;
  throttle: number;
  loadFeel: number;
  /** Optional parent-driven stage; else hysteresis from rpmNorm via nextIonLockStage. */
  lockStage?: IonLockStage;
  /** Accepted for API parity; DrivePage owns soft cue. */
  lockSfxEnabled?: boolean;
}

/** CRT phosphor ladder — navy → yellow → red/yellow flash → full red */
const NAVY = '#0c2468';
const NAVY_HOT = '#1e4bb8';
const YELLOW = '#ffe600';
const YELLOW_HOT = '#fff24a';
const RED = '#ff1a1a';
const RED_HOT = '#ff2200';

/** Dense perimeter tick degrees — open gaps at 3/9 for bracket groups; denser toward 12/6. */
function buildTickDegrees(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 144; i++) {
    const deg = i * 2.5;
    const dist3 = Math.min(Math.abs(deg - 90), Math.abs(deg - 270));
    const dist12 = Math.min(deg, Math.abs(deg - 180), 360 - deg);
    if (dist3 < 10) continue; // open 3/9 for horizontal brackets
    // denser fan near 12/6; thinner toward sides
    if (dist12 > 50 && i % 2 !== 0) continue;
    if (dist12 > 30 && dist12 <= 50 && i % 3 === 1) continue;
    out.push(deg);
  }
  return out;
}

const TICK_DEGS = buildTickDegrees();

function tickLength(deg: number): { inner: number; outer: number } {
  // 0° = 12 o'clock in our rotate(deg) with y-up ticks from center-top
  const dist12 = Math.min(Math.abs(deg % 360), Math.abs((deg % 360) - 360));
  const dist6 = Math.abs((deg % 360) - 180);
  const vertical = Math.min(dist12, dist6);
  const outer = 148;
  if (vertical < 4) return { inner: 118, outer }; // longest fan tips
  if (vertical < 14) return { inner: 124, outer };
  if (vertical < 28) return { inner: 132, outer };
  if (vertical < 45) return { inner: 138, outer };
  return { inner: 142, outer }; // short side ticks
}

/**
 * Original twin-ion interceptor silhouette (top-down wireframe).
 * Central angular fuselage + twin side ion nacelles on swept pylons —
 * NOT an X-wing / SW craft.
 */
function TwinIonCraft({
  color,
  opacity,
  bloom,
}: {
  color: string;
  opacity: number;
  bloom: boolean;
}) {
  return (
    <g
      className="ion-craft"
      opacity={opacity}
      filter={bloom ? 'url(#ionPhosphorHot)' : 'url(#ionPhosphor)'}
      stroke={color}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* Nose spike / sensor wedge */}
      <path d="M160 108 L168 128 L160 124 L152 128 Z" strokeWidth="1.4" fill={color} fillOpacity="0.15" />
      <path d="M160 108 L168 128 M160 108 L152 128" strokeWidth="1.6" />

      {/* Central angular fuselage (hex pod) */}
      <path
        d="M160 124 L176 136 L176 156 L160 172 L144 156 L144 136 Z"
        strokeWidth="1.8"
        fill={color}
        fillOpacity="0.08"
      />
      <path d="M152 140 L168 140 M152 152 L168 152 M160 136 L160 160" strokeWidth="1" opacity="0.85" />

      {/* Forward canopy chevron */}
      <path d="M154 132 L160 128 L166 132" strokeWidth="1.2" />

      {/* Swept pylons → twin ion nacelles */}
      <path d="M144 142 L112 138 L108 148 L144 150" strokeWidth="1.5" fill={color} fillOpacity="0.06" />
      <path d="M176 142 L208 138 L212 148 L176 150" strokeWidth="1.5" fill={color} fillOpacity="0.06" />

      {/* Left ion nacelle (elongated hex) */}
      <path
        d="M108 128 L118 124 L124 132 L124 164 L118 172 L108 168 L102 160 L102 136 Z"
        strokeWidth="1.7"
        fill={color}
        fillOpacity="0.1"
      />
      <path d="M108 136 L118 136 M108 160 L118 160 M113 128 L113 172" strokeWidth="0.9" opacity="0.8" />
      {/* Left exhaust notch */}
      <path d="M106 168 L113 178 L120 168" strokeWidth="1.3" />

      {/* Right ion nacelle */}
      <path
        d="M212 128 L202 124 L196 132 L196 164 L202 172 L212 168 L218 160 L218 136 Z"
        strokeWidth="1.7"
        fill={color}
        fillOpacity="0.1"
      />
      <path d="M202 136 L212 136 M202 160 L212 160 M207 128 L207 172" strokeWidth="0.9" opacity="0.8" />
      <path d="M200 168 L207 178 L214 168" strokeWidth="1.3" />

      {/* Nacelle fin spines (vertical, not X-wing foils) */}
      <path d="M113 124 L113 116 M113 116 L108 120 M113 116 L118 120" strokeWidth="1.2" />
      <path d="M207 124 L207 116 M207 116 L202 120 M207 116 L212 120" strokeWidth="1.2" />

      {/* Aft fuselage spike */}
      <path d="M152 168 L160 186 L168 168" strokeWidth="1.5" />
      <path d="M156 172 L164 172" strokeWidth="1" opacity="0.7" />
    </g>
  );
}

function CardinalCrosshair({ color, snapped }: { color: string; snapped: boolean }) {
  // Vertical needles 12/6; horizontal triple-bracket groups at 3/9
  const needleGap = snapped ? 42 : 48;
  const bracketInset = snapped ? 52 : 58;
  return (
    <g className="ion-cardinal" stroke={color} filter="url(#ionPhosphor)" strokeLinecap="round">
      {/* 12 o'clock needle */}
      <line x1="160" y1="86" x2="160" y2={160 - needleGap} strokeWidth="1.6" />
      {/* 6 o'clock needle */}
      <line x1="160" y1={160 + needleGap} x2="160" y2="234" strokeWidth="1.6" />

      {/* 9 o'clock bracket group (3 parallel horizontals) */}
      <g strokeWidth="1.5">
        <line x1={160 - bracketInset - 14} y1="152" x2={160 - bracketInset} y2="152" />
        <line x1={160 - bracketInset - 18} y1="160" x2={160 - bracketInset} y2="160" />
        <line x1={160 - bracketInset - 14} y1="168" x2={160 - bracketInset} y2="168" />
      </g>
      {/* 3 o'clock bracket group */}
      <g strokeWidth="1.5">
        <line x1={160 + bracketInset} y1="152" x2={160 + bracketInset + 14} y2="152" />
        <line x1={160 + bracketInset} y1="160" x2={160 + bracketInset + 18} y2="160" />
        <line x1={160 + bracketInset} y1="168" x2={160 + bracketInset + 14} y2="168" />
      </g>
    </g>
  );
}

function stageAccent(stage: IonLockStage): string {
  switch (stage) {
    case 'identified':
      return YELLOW_HOT;
    case 'lock':
      return RED; // CSS ion-lock-flash alternates red ↔ yellow
    case 'kill':
      return RED_HOT;
    default:
      return NAVY;
  }
}

function stageTick(stage: IonLockStage): string {
  switch (stage) {
    case 'identified':
      return YELLOW;
    case 'lock':
      return RED;
    case 'kill':
      return RED_HOT;
    default:
      return NAVY;
  }
}

/**
 * Ion Twin CRT targeting scope — navy / yellow / red-yellow flash / full-red phosphor ladder.
 * Lock ladder: none → identified → lock → kill (~4% hysteresis; see lockLadder / audio lockStage).
 * Soft-cue: `data-lock-stage`; sits behind huge SPEED (pointer-events: none).
 */
export function IonTwinOverlay({
  rpmNorm,
  speedNorm,
  throttle,
  loadFeel,
  lockStage: lockStageProp,
}: Props) {
  const rpm = Math.max(0, Math.min(1, rpmNorm));
  const prevStageRef = useRef<IonLockStage>('none');

  const stage: IonLockStage =
    lockStageProp ??
    (() => {
      const next = nextIonLockStage(rpm, prevStageRef.current);
      prevStageRef.current = next;
      return next;
    })();

  if (lockStageProp != null) {
    prevStageRef.current = lockStageProp;
  }

  const lockedLike = stage === 'lock' || stage === 'kill';
  const accent = stageAccent(stage);
  const tickColor = stageTick(stage);
  const craftColor = stageTick(stage);
  const footer = ION_LOCK_FOOTER[stage];
  const pill = ION_LOCK_PILL[stage];
  const pillOn = stage !== 'none';

  const craftOpacity =
    stage === 'none' ? 0.08 : stage === 'identified' ? 0.55 : stage === 'lock' ? 0.92 : 1;
  const tickOpacity =
    stage === 'none' ? 0.35 : stage === 'identified' ? 0.7 : stage === 'lock' ? 0.88 : 1;

  // Drive SVG strokes via CSS vars so lock-stage flash can animate red ↔ yellow
  const tickStroke = 'var(--ion-tick)';
  const craftStroke = 'var(--ion-craft)';

  const aria =
    stage === 'kill'
      ? `Kill targeting reticle at ${Math.round(rpm * 100)} percent`
      : stage === 'lock'
        ? `Locked targeting reticle at ${Math.round(rpm * 100)} percent`
        : stage === 'identified'
          ? `Target identified reticle at ${Math.round(rpm * 100)} percent`
          : `CRT targeting scope at ${Math.round(rpm * 100)} percent`;

  return (
    <div
      className={`ion-twin-overlay ion-twin-overlay--${stage}${lockedLike ? ' locked' : ''}`}
      data-lock-stage={stage}
      style={
        {
          ['--ion-rpm']: rpm,
          ['--ion-speed']: speedNorm,
          ['--ion-throttle']: throttle,
          ['--ion-load']: loadFeel,
          ['--ion-accent']: accent,
          ['--ion-tick']: tickColor,
          ['--ion-craft']: craftColor,
          ['--ion-navy']: NAVY,
          ['--ion-navy-hot']: NAVY_HOT,
          ['--ion-yellow']: YELLOW,
          ['--ion-yellow-hot']: YELLOW_HOT,
          ['--ion-red']: RED,
          ['--ion-red-hot']: RED_HOT,
        } as CSSProperties
      }
    >
      <div className="ion-scanlines" />

      {/* Decorative brushed bezel + knobs (CSS only, not controls) */}
      <div className="ion-crt-housing" aria-hidden>
        <span className="ion-knob ion-knob--l" />
        <span className="ion-led ion-led--a" />
        <span className="ion-led ion-led--b" />
        <div className="ion-bezel">
          <div className="ion-bezel-ring" />
        </div>
        <span className="ion-knob ion-knob--r1" />
        <span className="ion-knob ion-knob--r2" />
      </div>

      <div className="ion-status">
        <span className="aurebesh ion-status-ab">ION TWIN</span>
        <span className="ion-status-lat">CRT SCOPE</span>
        <span className={`ion-lock-pill${pillOn ? ' on' : ''} ion-lock-pill--${stage}`}>
          <span className="aurebesh">{pill}</span>
          <span className="ion-lock-lat">{pill}</span>
        </span>
      </div>

      <svg
        className="ion-crt-scope"
        viewBox="0 0 320 320"
        role="img"
        aria-label={aria}
      >
        <defs>
          <filter id="ionPhosphor" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ionPhosphorHot" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feGaussianBlur stdDeviation="5" in="SourceGraphic" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="ionCrtClip">
            <circle cx="160" cy="160" r="150" />
          </clipPath>
          <radialGradient id="ionVoid" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#020508" />
            <stop offset="70%" stopColor="#000000" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
        </defs>

        <circle cx="160" cy="160" r="150" fill="url(#ionVoid)" />

        <g clipPath="url(#ionCrtClip)" opacity={tickOpacity}>
          {/* Outer soft ring */}
          <circle
            cx="160"
            cy="160"
            r="148"
            fill="none"
            stroke={tickStroke}
            strokeWidth="0.5"
            opacity="0.35"
            filter="url(#ionPhosphor)"
          />

          {/* Dense tick ring — longer at 12/6, shorter toward 3/9 */}
          <g stroke={tickStroke} strokeLinecap="round" filter="url(#ionPhosphor)">
            {TICK_DEGS.map((deg) => {
              const { inner, outer } = tickLength(deg);
              const vertical = Math.min(
                Math.min(Math.abs(deg % 360), Math.abs((deg % 360) - 360)),
                Math.abs((deg % 360) - 180),
              );
              const sw = vertical < 8 ? 1.6 : vertical < 25 ? 1.2 : 0.85;
              return (
                <line
                  key={deg}
                  transform={`rotate(${deg} 160 160)`}
                  x1="160"
                  y1={inner}
                  x2="160"
                  y2={outer}
                  strokeWidth={sw}
                />
              );
            })}
          </g>

          <CardinalCrosshair color={tickStroke} snapped={lockedLike} />

          <TwinIonCraft
            color={craftStroke}
            opacity={craftOpacity}
            bloom={lockedLike}
          />
        </g>
      </svg>

      {/* Bottom Aurebesh readout strip inside scope area */}
      <div className="ion-readout" aria-hidden>
        <span className="ion-readout-seg">
          <span className="aurebesh">{footer.aurebesh}</span>
        </span>
        <span className="ion-readout-div" />
        <span className="ion-readout-seg ion-readout-lat">{footer.latin}</span>
        <span className="ion-readout-div" />
        <span className="ion-readout-seg aurebesh">{Math.round(rpm * 100)}</span>
      </div>

      <div className="ion-footer">
        <span className="aurebesh">{footer.aurebesh}</span>
        <span className="ion-footer-lat">{footer.latin}</span>
      </div>
    </div>
  );
}

export type { IonLockStage as LockStage };
