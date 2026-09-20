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
};

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_UI };
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return { ...DEFAULT_UI, ...parsed, mapping: { ...DEFAULT_UI.mapping, ...parsed.mapping } };
  } catch {
    return { ...DEFAULT_UI };
  }
}

export function useUiPrefs() {
  const [prefs, setPrefs] = useState<UiPrefs>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
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
