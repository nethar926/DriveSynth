import type { GaugeStyle } from '../hooks/useUiPrefs';

interface Props {
  value: number; // 0..1
  label: string;
  readout: string;
  style: GaugeStyle;
  size?: number;
}

export function Gauge({ value, label, readout, style, size = 220 }: Props) {
  const v = Math.min(1, Math.max(0, value));

  if (style === 'numeric') {
    return (
      <div className="gauge gauge-numeric" style={{ minWidth: size }}>
        <div className="gauge-readout">{readout}</div>
        <div className="gauge-label">{label}</div>
        <div className="gauge-bar-track" aria-hidden>
          <div className="gauge-bar-fill" style={{ width: `${v * 100}%` }} />
        </div>
      </div>
    );
  }

  if (style === 'bar') {
    return (
      <div className="gauge gauge-bar" style={{ width: Math.max(size, 280) }}>
        <div className="gauge-bar-header">
          <span className="gauge-label">{label}</span>
          <span className="gauge-readout-sm">{readout}</span>
        </div>
        <div className="gauge-bar-track tall">
          <div className="gauge-bar-fill" style={{ width: `${v * 100}%` }} />
        </div>
      </div>
    );
  }

  // arc
  const r = 84;
  const c = 2 * Math.PI * r;
  const arcLen = c * 0.75;
  const offset = arcLen * (1 - v);
  return (
    <div className="gauge gauge-arc" style={{ width: size, height: size }}>
      <svg viewBox="0 0 220 220" width={size} height={size} aria-hidden>
        <g transform="rotate(135 110 110)">
          <circle
            cx="110"
            cy="110"
            r={r}
            fill="none"
            stroke="var(--gauge-track)"
            strokeWidth="14"
            strokeDasharray={`${arcLen} ${c}`}
            strokeLinecap="round"
          />
          <circle
            cx="110"
            cy="110"
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="14"
            strokeDasharray={`${arcLen} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="gauge-arc-fill"
          />
        </g>
      </svg>
      <div className="gauge-arc-center">
        <div className="gauge-readout">{readout}</div>
        <div className="gauge-label">{label}</div>
      </div>
    </div>
  );
}
