import { useCallback, useEffect, useState } from 'react';

export type ThemeId = 'night' | 'day' | 'neon' | 'mono';
export type LayoutDensity = 'comfortable' | 'compact' | 'spacious';
export type GaugeStyle = 'arc' | 'bar' | 'numeric';
export type SpeedUnit = 'mph' | 'kph';
/** Ion Twin SPEED glyph mode — aurebesh default; latin/dual for cabin glanceability. */
export type IonTwinSpeedScript = 'aurebesh' | 'latin' | 'dual';

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
  /**
   * Ion Twin SPEED script. Default aurebesh (always-on, not hold Easter egg).
   * Latin / dual-ghost for Customize glanceability under cabin motion.
   */
  ionTwinSpeedScript: IonTwinSpeedScript;
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
  ionTwinSpeedScript: 'aurebesh',
};

const LEGACY_AUREBESH_KEY = 'drivesynth.ionTwin.aurebeshNumerals';

function migrateIonTwinSpeedScript(
  parsed: Partial<UiPrefs>,
): IonTwinSpeedScript {
  const v = parsed.ionTwinSpeedScript;
  if (v === 'aurebesh' || v === 'latin' || v === 'dual') return v;
  // Legacy hold-to-flip Boolean: explicit false → latin; otherwise default aurebesh.
  try {
    const legacy = localStorage.getItem(LEGACY_AUREBESH_KEY);
    if (legacy === 'false' || legacy === '0') return 'latin';
  } catch {
    /* ignore */
  }
  return 'aurebesh';
}

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    const dsUpshift = localStorage.getItem('ds-upshift-sfx') === '1';
    if (!raw) {
      return {
        ...DEFAULT_UI,
        upshiftSfx: dsUpshift,
        ionTwinSpeedScript: migrateIonTwinSpeedScript({}),
      };
    }
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    const upshiftSfx =
      typeof parsed.upshiftSfx === 'boolean' ? parsed.upshiftSfx : dsUpshift;
    return {
      ...DEFAULT_UI,
      ...parsed,
      mapping: { ...DEFAULT_UI.mapping, ...parsed.mapping },
      upshiftSfx,
      ionTwinSpeedScript: migrateIonTwinSpeedScript(parsed),
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
