import type { CSSProperties } from 'react';

/**
 * Dial assignment for the Gradient cluster — swap 'rpm' / 'speed' to reassign.
 * (Named constant so the mapping is trivial to change later.)
 */
export const GRADIENT_DIAL_MAP: { left: 'rpm' | 'speed'; right: 'rpm' | 'speed' } = {
  left: 'rpm',
  right: 'speed',
};

export interface GradientClusterProps {
  /** 0..1 */
  rpmNorm: number;
  /** 0..1 */
  speedNorm: number;
  /** Absolute values for the center stack (ThemeStage provides these). */
  rpm?: number;
  /** Absolute speed in `unit`. */
  speed?: number;
  unit?: 'mph' | 'kph';
  gear?: number | string;
  /** 0..1 */
  load?: number;
  /** 0..1 */
  throttle?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** 0° = 12 o'clock, clockwise positive — same convention as the classic Dial. */
const pctToDeg = (pct: number) => -135 + clamp01(pct) * 270;

/** Etched tick ring — built once at module level like the Ion Twin scope. */
const TICKS: { deg: number; major: boolean }[] = Array.from({ length: 60 }, (_, i) => ({
  deg: i * 6,
  major: i % 5 === 0,
}));

/** Small orange pill markers (cf. macro shots) at fixed dial angles. */
const MARKER_DEGS = [75, 102];

function SweepDial({
  pct,
  tone,
  label,
}: {
  pct: number;
  tone: 'rpm' | 'speed';
  label: string;
}) {
  const deg = pctToDeg(pct);
  const rotate = { transform: `rotate(${deg}deg)` } as CSSProperties;
  return (
    <div className={`grad-dial grad-dial--${tone}`} role="img" aria-label={`${label} ${Math.round(clamp01(pct) * 100)} percent`}>
      <div className="grad-dial-face" aria-hidden />
      {tone === 'speed' && <div className="grad-dial-split" aria-hidden />}

      {/* Etched ticks sit UNDER the sweep so the beam brightens them as it passes. */}
      <svg className="grad-ticks" viewBox="0 0 200 200" aria-hidden>
        {TICKS.map(({ deg: d, major }) => (
          <line
            key={d}
            className={`grad-tick${major ? ' major' : ''}`}
            transform={`rotate(${d} 100 100)`}
            x1="100"
            y1={major ? 7 : 10}
            x2="100"
            y2="14"
          />
        ))}
      </svg>

      {/* Rotating light beam — hot core at the needle, trailing glow behind. */}
      <div className="grad-sweep" style={rotate} aria-hidden>
        <div className="grad-wedge" />
      </div>

      {/* Slim needle riding the beam's leading edge. */}
      <div className="grad-needle" style={rotate} aria-hidden>
        <i className="grad-needle-line" />
        <i className="grad-needle-tip" />
      </div>

      {MARKER_DEGS.map((d) => (
        <div key={d} className="grad-marker" style={{ transform: `rotate(${d}deg)` }} aria-hidden>
          <i />
        </div>
      ))}

      <div className="grad-hub" aria-hidden />
    </div>
  );
}

/**
 * RF Gradient Sweep — dual conic light-sweep dials around a glowing center stack.
 * Live values drive the beam/needle angle on the same render path as every other
 * cluster (no extra per-frame work): parent re-renders with new props, we set
 * rotation via inline style (transform-only, GPU friendly).
 */
export function GradientCluster({
  rpmNorm,
  speedNorm,
  rpm,
  speed,
  unit = 'mph',
  gear,
  load,
  throttle,
}: GradientClusterProps) {
  const rpmPct = clamp01(rpmNorm);
  const speedPct = clamp01(speedNorm);

  // Absolute readouts when provided (ThemeStage path); graceful fallback for
  // normalized-only callers (e.g. the DriveSkinSlot registry stub).
  const rpmShow = rpm != null ? Math.round(rpm).toLocaleString() : `${Math.round(rpmPct * 100)}%`;
  const speedShow = speed != null ? Math.round(speed) : Math.round(speedPct * 160);
  const gearShow = gear === 0 ? 'N' : (gear ?? '–');
  const unitShow = unit === 'kph' ? 'KM/H' : 'MPH';

  const leftPct = GRADIENT_DIAL_MAP.left === 'rpm' ? rpmPct : speedPct;
  const rightPct = GRADIENT_DIAL_MAP.right === 'rpm' ? rpmPct : speedPct;

  return (
    <div
      className="grad-cluster"
      role="img"
      aria-label={`Gradient cluster: ${speedShow} ${unitShow}, ${rpmShow} RPM, gear ${gearShow}`}
      style={
        {
          ['--grad-rpm' as string]: rpmPct,
          ['--grad-speed' as string]: speedPct,
          ['--grad-load' as string]: load ?? throttle ?? 0,
        } as CSSProperties
      }
    >
      <div className="grad-housing">
        <SweepDial pct={leftPct} tone="rpm" label="Engine RPM" />
        <div className="grad-center">
          <div className="grad-gear">
            <span>{gearShow}</span>
          </div>
          <div className="grad-speed">
            <strong>{speedShow}</strong>
            <small>{unitShow}</small>
          </div>
          <div className="grad-rpm-pill">
            <span>{rpmShow} RPM</span>
          </div>
        </div>
        <SweepDial pct={rightPct} tone="speed" label="Speed" />
      </div>
    </div>
  );
}
