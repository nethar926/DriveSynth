import type { ParamMeta } from '../audio';

interface Props {
  meta: ParamMeta;
  value: number;
  onChange: (id: string, value: number) => void;
}

export function ParamRail({ meta, value, onChange }: Props) {
  if (meta.kind === 'segmented' && meta.options) {
    return (
      <div className="param-rail">
        <div className="param-rail-head">
          <span>{meta.label}</span>
          <span className="param-val">{value}</span>
        </div>
        <div className="segmented">
          {meta.options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`seg-btn ${value === opt ? 'active' : ''}`}
              onClick={() => onChange(meta.id, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const display =
    meta.unit === 'Hz' ? `${Math.round(value)} Hz` : value.toFixed(2);

  return (
    <div className="param-rail">
      <div className="param-rail-head">
        <span>{meta.label}</span>
        <span className="param-val">{display}</span>
      </div>
      <input
        className="param-slider"
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step ?? 0.01}
        value={value}
        onChange={(e) => onChange(meta.id, Number(e.target.value))}
        aria-label={meta.label}
      />
    </div>
  );
}
