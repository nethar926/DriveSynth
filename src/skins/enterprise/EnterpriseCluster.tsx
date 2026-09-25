import type { CSSProperties } from 'react';

export interface EnterpriseClusterProps {
  /** 0..1 */
  rpmNorm: number;
  /** 0..1 */
  speedNorm: number;
  /** Absolute values for readouts (ThemeStage provides these). */
  rpm?: number;
  /** Absolute speed in `unit`. */
  speed?: number;
  unit?: 'mph' | 'kph';
  gear?: number | string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** Chunky segments in the RPM bar — fills from the right, per the mockup. */
const SEGS = 2;

/**
 * Ring spin: always turning, faster with value.
 * Idle ~8s/rev, full tilt ~1.6s/rev. Set via inline animation-duration so the
 * parent render loop (same path as every other cluster) drives it live.
 */
const spinDur = (pct: number) => `${(2 / (0.25 + clamp01(pct))).toFixed(2)}s`;

/**
 * RF Enterprise — strict LCARS command cluster, reflowable.
 * Black canvas. Left: orange LCARS mass with a tall header, black inset,
 * Oswald Black numerals (RPM over MPH), a purple rule that runs lighter over
 * the orange, and a chunky green RPM bar filling right-to-left (red at
 * redline). Right: purple LCARS panel with a WARP header, twin warp rings
 * (outer spins with speed, inner with RPM) and the gear in purple at the core.
 * Bottom: orange LCARS strip with a black inset.
 */
export function EnterpriseCluster({
  rpmNorm,
  speedNorm,
  rpm,
  speed,
  unit = 'mph',
  gear,
}: EnterpriseClusterProps) {
  const rpmPct = clamp01(rpmNorm);
  const speedPct = clamp01(speedNorm);

  const rpmShow = rpm != null ? String(Math.round(rpm)) : `${Math.round(rpmPct * 100)}%`;
  const speedShow = speed != null ? Math.round(speed) : Math.round(speedPct * (unit === 'kph' ? 260 : 160));
  const gearShow = gear === 0 ? 'N' : (gear ?? '–');
  const unitShow = unit === 'kph' ? 'KPH' : 'MPH';
  const filled = Math.round(rpmPct * SEGS);

  return (
    <div
      className="ent"
      role="img"
      aria-label={`Enterprise cluster: ${speedShow} ${unitShow}, ${rpmShow} RPM, gear ${gearShow}`}
    >
      <div className="ent-main">
        <section className="ent-left" aria-label="Speed and RPM">
          <div className="ent-inset">
            <div className="ent-line">
              <strong className="ent-num ent-rpm-num">{rpmShow}</strong>
              <span className="ent-label">RPM</span>
            </div>
            <div className="ent-rule" aria-hidden />
            <div className="ent-line">
              <strong className="ent-num ent-speed-num">{speedShow}</strong>
              <span className="ent-label">{unitShow}</span>
            </div>
            <div className="ent-bar" role="img" aria-label={`RPM ${Math.round(rpmPct * 100)} percent`}>
              {Array.from({ length: SEGS }, (_, i) => (
                <i key={i} className={i >= SEGS - filled ? 'on' : ''} aria-hidden />
              ))}
            </div>
          </div>
        </section>

        <section className="ent-right" aria-label="Warp drive">
          <div className="ent-warp">
            <span className="ent-label ent-warp-label">WARP</span>
          </div>
          <div className="ent-rings">
            <div
              className="ent-ring"
              style={{ animationDuration: spinDur(speedPct) } as CSSProperties}
              aria-hidden
            >
              <svg viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="84"
                  fill="none"
                  stroke="#8e44ad"
                  strokeWidth="20"
                  strokeLinecap="round"
                  strokeDasharray="200 328"
                />
              </svg>
            </div>
            <div
              className="ent-ring ent-ring--rev"
              style={{ animationDuration: spinDur(rpmPct) } as CSSProperties}
              aria-hidden
            >
              <svg viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="58"
                  fill="none"
                  stroke="#f5820d"
                  strokeWidth="15"
                  strokeLinecap="round"
                  strokeDasharray="140 55 100 70"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="40"
                  fill="none"
                  stroke="#c39bd3"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray="95 157"
                />
              </svg>
            </div>
            <div className="ent-gear">
              <span className="ent-num">{gearShow}</span>
            </div>
          </div>
        </section>
      </div>
      <div className="ent-foot" aria-hidden>
        <i />
      </div>
    </div>
  );
}
