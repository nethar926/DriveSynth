import { useCallback, useEffect, useState } from 'react';

export type ThemeId = 'night' | 'day' | 'neon' | 'mono';
export type LayoutDensity = 'comfortable' | 'compact' | 'spacious';
/** @deprecated Prefer GaugeCluster; kept for persisted prefs + Gauge prop mapping. */
export type GaugeStyle = 'arc' | 'bar' | 'numeric';
export type GaugeCluster = 'classic' | 'digital' | 'minimal' | 'skin-native';
export type TelemetryDensity = 'full' | 'compact' | 'minimal';
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
  /** Legacy arc/bar/numeric — kept in sync with gaugeCluster. */
  gaugeStyle: GaugeStyle;
  /** Secondary cluster preference (Customize “Gauge cluster”). */
  gaugeCluster: GaugeCluster;
  /** LOAD/REVS/ACCEL strip density. */
  telemetryDensity: TelemetryDensity;
  speedUnit: SpeedUnit;
  showKeepAliveTip: boolean;
  masterMuted: boolean;
  selectedEngineId: string;
  mapping: ControlMapping;
  /** Optional Ion Twin lock chirp; off by default. */
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
  gaugeCluster: 'classic',
  telemetryDensity: 'full',
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

/** Map cluster pref → Gauge style prop. */
export function clusterToGaugeStyle(cluster: GaugeCluster): GaugeStyle {
  switch (cluster) {
    case 'digital':
      return 'bar';
    case 'minimal':
    case 'skin-native':
      return 'numeric';
    case 'classic':
    default:
      return 'arc';
  }
}

/** Map legacy gaugeStyle → cluster (migration). */
export function gaugeStyleToCluster(style: GaugeStyle): GaugeCluster {
  switch (style) {
    case 'bar':
      return 'digital';
    case 'numeric':
      return 'minimal';
    case 'arc':
    default:
      return 'classic';
  }
}

/** Packs that ship a signature secondary plate. */
export function packHasSkinNativeSecondary(skinId: string): boolean {
  return (
    skinId === 'ion-twin' ||
    skinId === 'aerospace-f14' ||
    skinId === 'ice-v8' ||
    skinId === 'ev-inverter'
  );
}

/**
 * Effective secondary cluster for Drive.
 * skin-native without a pack overlay falls back to minimal.
 */
export function resolveGaugeCluster(cluster: GaugeCluster, skinId: string): GaugeCluster {
  if (cluster === 'skin-native' && !packHasSkinNativeSecondary(skinId)) {
    return 'minimal';
  }
  return cluster;
}

function migrateIonTwinSpeedScript(parsed: Partial<UiPrefs>): IonTwinSpeedScript {
  const v = parsed.ionTwinSpeedScript;
  if (v === 'aurebesh' || v === 'latin' || v === 'dual') return v;
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
    const parsed = JSON.parse(raw) as Partial<UiPrefs> & { upshiftBarkSfx?: boolean };
    const upshiftSfx =
      typeof parsed.upshiftSfx === 'boolean'
        ? parsed.upshiftSfx
        : typeof parsed.upshiftBarkSfx === 'boolean'
          ? parsed.upshiftBarkSfx
          : dsUpshift;
    const merged: UiPrefs = {
      ...DEFAULT_UI,
      ...parsed,
      mapping: { ...DEFAULT_UI.mapping, ...parsed.mapping },
      upshiftSfx,
      ionTwinSpeedScript: migrateIonTwinSpeedScript(parsed),
    };
    if (parsed.gaugeCluster == null && parsed.gaugeStyle != null) {
      merged.gaugeCluster = gaugeStyleToCluster(parsed.gaugeStyle);
    }
    if (
      parsed.telemetryDensity !== 'full' &&
      parsed.telemetryDensity !== 'compact' &&
      parsed.telemetryDensity !== 'minimal'
    ) {
      merged.telemetryDensity = DEFAULT_UI.telemetryDensity;
    }
    merged.gaugeStyle = clusterToGaugeStyle(merged.gaugeCluster);
    return merged;
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
    document.documentElement.dataset.telemetry = prefs.telemetryDensity;
  }, [prefs]);

  const update = useCallback((partial: Partial<UiPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...partial };
      if (partial.gaugeCluster != null) {
        next.gaugeStyle = clusterToGaugeStyle(partial.gaugeCluster);
      } else if (partial.gaugeStyle != null && partial.gaugeCluster == null) {
        next.gaugeCluster = gaugeStyleToCluster(partial.gaugeStyle);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => setPrefs({ ...DEFAULT_UI }), []);

  return { prefs, update, reset };
}
