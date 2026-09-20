import { useCallback, useEffect, useState } from 'react';

export type ThemeId = 'night' | 'day' | 'neon' | 'mono';
export type LayoutDensity = 'comfortable' | 'compact' | 'spacious';
export type GaugeStyle = 'arc' | 'bar' | 'numeric';
export type SpeedUnit = 'mph' | 'kph';

export interface ControlMapping {
  revPad: 'throttle';
  speedSlider: 'speed';
  mute: 'masterGain';
}

export interface UiPrefs {
  theme: ThemeId;
  accent: string;
  density: LayoutDensity;
  gaugeStyle: GaugeStyle;
  speedUnit: SpeedUnit;
  showKeepAliveTip: boolean;
  masterMuted: boolean;
  selectedEngineId: string;
  mapping: ControlMapping;
  /** Optional Ion Twin lock chirp; off by default until Audio ships triggerUiCue. */
  ionTwinLockSfx: boolean;
  /** Optional MANUAL upshift bark; off by default. Also mirrored to `ds-upshift-sfx`. */
  upshiftSfx: boolean;
}

const KEY = 'drivesynth.ui.v1';

export const DEFAULT_UI: UiPrefs = {
  theme: 'night',
  accent: '#3dffb5',
  density: 'comfortable',
  gaugeStyle: 'arc',
  speedUnit: 'mph',
  showKeepAliveTip: true,
  masterMuted: false,
  selectedEngineId: 'v8-rumble',
  mapping: {
    revPad: 'throttle',
    speedSlider: 'speed',
    mute: 'masterGain',
  },
  ionTwinLockSfx: false,
  upshiftSfx: false,
};

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    const dsUpshift = localStorage.getItem('ds-upshift-sfx') === '1';
    if (!raw) {
      return { ...DEFAULT_UI, upshiftSfx: dsUpshift };
    }
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    const upshiftSfx =
      typeof parsed.upshiftSfx === 'boolean' ? parsed.upshiftSfx : dsUpshift;
    return {
      ...DEFAULT_UI,
      ...parsed,
      mapping: { ...DEFAULT_UI.mapping, ...parsed.mapping },
      upshiftSfx,
    };
  } catch {
    return { ...DEFAULT_UI };
  }
}

export function useUiPrefs() {
  const [prefs, setPrefs] = useState<UiPrefs>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
      if (prefs.upshiftSfx) localStorage.setItem('ds-upshift-sfx', '1');
      else localStorage.removeItem('ds-upshift-sfx');
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.style.setProperty('--accent', prefs.accent);
    document.documentElement.dataset.density = prefs.density;
  }, [prefs]);

  const update = useCallback((partial: Partial<UiPrefs>) => {
    setPrefs((p) => ({ ...p, ...partial }));
  }, []);

  const reset = useCallback(() => setPrefs({ ...DEFAULT_UI }), []);

  return { prefs, update, reset };
}
