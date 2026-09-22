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
/** UI font stack. Aurebesh is accents-only (brand / ion glyphs), not body. */
export type FontFamilyId = 'system' | 'sans' | 'mono' | 'aurebesh';

export interface ThemeColors {
  bg: string;
  text: string;
  accent: string;
  surface: string;
}

export interface ControlMapping {
  revPad: 'throttle';
  speedSlider: 'speed';
  mute: 'masterGain';
}

export interface UiPrefs {
  theme: ThemeId;
  accent: string;
  /** Full palette tokens — overrides theme CSS vars when set. */
  colors: ThemeColors;
  /** Body / UI font. Aurebesh only affects accent chrome via data-font. */
  fontFamily: FontFamilyId;
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

export const THEME_COLOR_PRESETS: Record<ThemeId, ThemeColors> = {
  night: { bg: '#07090d', text: '#e8eef8', accent: '#3dffb5', surface: '#10141c' },
  day: { bg: '#f2f5fa', text: '#0c1220', accent: '#0b5fff', surface: '#ffffff' },
  neon: { bg: '#05040a', text: '#f7e9ff', accent: '#ff3d9a', surface: '#120a18' },
  mono: { bg: '#0a0a0a', text: '#f0f0f0', accent: '#e8ecf2', surface: '#141414' },
};

export const FONT_STACKS: Record<FontFamilyId, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  sans: '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  /** Body stays readable Latin; Aurebesh applied to .aurebesh / brand accents via data-font. */
  aurebesh: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const DEFAULT_UI: UiPrefs = {
  theme: 'night',
  accent: '#3dffb5',
  colors: { ...THEME_COLOR_PRESETS.night },
  fontFamily: 'system',
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

function normalizeColors(parsed: Partial<UiPrefs>): ThemeColors {
  const theme = (parsed.theme ?? DEFAULT_UI.theme) as ThemeId;
  const preset = THEME_COLOR_PRESETS[theme] ?? THEME_COLOR_PRESETS.night;
  const c = parsed.colors;
  return {
    bg: typeof c?.bg === 'string' ? c.bg : preset.bg,
    text: typeof c?.text === 'string' ? c.text : preset.text,
    accent:
      typeof c?.accent === 'string'
        ? c.accent
        : typeof parsed.accent === 'string'
          ? parsed.accent
          : preset.accent,
    surface: typeof c?.surface === 'string' ? c.surface : preset.surface,
  };
}

function normalizeFont(v: unknown): FontFamilyId {
  if (v === 'system' || v === 'sans' || v === 'mono' || v === 'aurebesh') return v;
  return DEFAULT_UI.fontFamily;
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
    const colors = normalizeColors(parsed);
    const merged: UiPrefs = {
      ...DEFAULT_UI,
      ...parsed,
      colors,
      accent: colors.accent,
      fontFamily: normalizeFont(parsed.fontFamily),
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

function applyCssTokens(prefs: UiPrefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.density = prefs.density;
  root.dataset.telemetry = prefs.telemetryDensity;
  root.dataset.font = prefs.fontFamily;

  const { bg, text, accent, surface } = prefs.colors;
  root.style.setProperty('--bg', bg);
  root.style.setProperty('--text', text);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--surface', surface);
  // Keep elevated surfaces in sync for existing chrome.
  root.style.setProperty('--bg-elev', surface);
  root.style.setProperty('--bg-card', surface);
  root.style.setProperty('--font', FONT_STACKS[prefs.fontFamily]);
  root.style.setProperty('--accent-dim', `color-mix(in srgb, ${accent} 35%, transparent)`);
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
    applyCssTokens(prefs);
  }, [prefs]);

  const update = useCallback((partial: Partial<UiPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...partial };
      if (partial.colors) {
        next.colors = { ...p.colors, ...partial.colors };
        if (partial.colors.accent) next.accent = partial.colors.accent;
      }
      // Theme preset: refresh palette unless caller also passed colors.
      if (partial.theme != null && partial.colors == null) {
        const preset = THEME_COLOR_PRESETS[partial.theme];
        next.colors = { ...preset };
        next.accent = preset.accent;
      }
      // Legacy single accent field → colors.accent
      if (partial.accent != null && partial.colors == null) {
        next.colors = { ...next.colors, accent: partial.accent };
      }
      if (partial.gaugeCluster != null) {
        next.gaugeStyle = clusterToGaugeStyle(partial.gaugeCluster);
      } else if (partial.gaugeStyle != null && partial.gaugeCluster == null) {
        next.gaugeCluster = gaugeStyleToCluster(partial.gaugeStyle);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => setPrefs({ ...DEFAULT_UI, colors: { ...DEFAULT_UI.colors } }), []);

  return { prefs, update, reset };
}
