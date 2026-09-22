import type { UiPrefs } from '../../hooks/useUiPrefs';

interface Props {
  prefs: UiPrefs;
  update: (p: Partial<UiPrefs>) => void;
}

function Knob({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <label className="rf-knob tesla-touch">
      <span className="rf-knob-head">
        <span>{label}</span>
        <output>{display}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <small className="help-text dim">{hint}</small> : null}
    </label>
  );
}

/** Bloom / scanline / HUD opacity / bezel — Tesla ≥48px, no native select. */
export function AppearanceKnobs({ prefs, update }: Props) {
  return (
    <div className="rf-appearance-knobs" data-testid="appearance-knobs">
      <Knob
        label="Bloom / glow"
        value={prefs.bloomGlow}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(prefs.bloomGlow * 100)}%`}
        onChange={(bloomGlow) => update({ bloomGlow })}
        hint="Phosphor / needle glow intensity (CSS --rf-bloom)."
      />
      <Knob
        label="Scanline strength"
        value={prefs.scanlineStrength}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(prefs.scanlineStrength * 100)}%`}
        onChange={(scanlineStrength) => update({ scanlineStrength })}
        hint="CRT / HUD scan overlay (CSS --rf-scanline → --skin-scanline-opacity)."
      />
      <Knob
        label="HUD opacity"
        value={prefs.hudOpacity}
        min={0.25}
        max={1}
        step={0.01}
        display={`${Math.round(prefs.hudOpacity * 100)}%`}
        onChange={(hudOpacity) => update({ hudOpacity })}
        hint="Instrument cluster opacity (--hud-opacity)."
      />
      <Knob
        label="Bezel / frame"
        value={prefs.hudBezel}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(prefs.hudBezel * 100)}%`}
        onChange={(hudBezel) => update({ hudBezel })}
        hint="Frame / plate edge intensity (--rf-bezel)."
      />
    </div>
  );
}
