# RevForge Visual + Drive Dynamics prefs

**Branch work:** Visual skins polish on `feature/revforge-fusion` tip  
**UI home (now):** `src/pages/CustomizePage.tsx` (`/customize` · Interface Options)  
**Also folded into:** TUNE → Visuals (`src/forge/ForgePage.tsx`)  
**Frontend move target:** ☰ → Interface Options → Visuals (when hamburger IA merges)

Pack overlays under `src/skins/` are untouched (ion-twin, aerospace-f14, ice-v8, ev-inverter).

## Components

| Piece | Path |
|---|---|
| ThemePicker SVG previews | `src/themes/ThemePicker.tsx` |
| Theme card / contrast CSS | `src/themes/themes.css` |
| Appearance knobs | `src/components/visuals/AppearanceKnobs.tsx` |
| Drive Dynamics panel | `src/components/visuals/DriveDynamicsPanel.tsx` |
| Gear tables | `src/hooks/gearLogic.ts` (`buildGearTables`) |
| Prefs hook | `src/hooks/useUiPrefs.ts` |

## Storage keys

### Blob
- `drivesynth.ui.v1` — full `UiPrefs` JSON (includes all fields below)

### Appearance mirrors (`revforge.prefs.*`)
| Key | Field | Range | Notes |
|---|---|---|---|
| `revforge.prefs.bloomGlow` | `bloomGlow` | 0..1 | CSS `--rf-bloom`, `--skin-bloom-mul` |
| `revforge.prefs.scanlineStrength` | `scanlineStrength` | 0..1 | CSS `--rf-scanline` → `--skin-scanline-opacity` |
| `revforge.prefs.hudOpacity` | `hudOpacity` | 0.25..1 | CSS `--hud-opacity` (also mirrors legacy `revforge.hudOpacity`) |
| `revforge.prefs.hudBezel` | `hudBezel` | 0..1 | CSS `--rf-bezel` |

### Drive Dynamics mirrors — **@Audio Synth**
| Key | Field | Range | Notes |
|---|---|---|---|
| `revforge.dynamics.gearCount` | `gearCount` | 4..8 | Scales ENTER/EXIT; Forge drivetrain `gears` |
| `revforge.dynamics.maxTopSpeedMph` | `maxTopSpeedMph` | 60..300 | Scales gear mph windows + gauge top (default **140** preserves classic 8-speed tables) |
| `revforge.dynamics.idleRpmMin` | `idleRpmMin` | 400..2000 | Idle floor. Approx **idleHz ≈ idleRpmMin / 60** |
| `revforge.dynamics.idleRpmMax` | `idleRpmMax` | 400..2500 | Idle ceiling / jitter band. **idleHzMax ≈ idleRpmMax / 60** |

Audio can `JSON.parse(localStorage.getItem('drivesynth.ui.v1'))` or read the dedicated `revforge.dynamics.*` strings without parsing the blob.

Defaults: `gearCount=8`, `maxTopSpeedMph=140`, `idleRpmMin=700`, `idleRpmMax=900` → ENTER `[0,8,18,32,48,68,90,115]`, EXIT `[0,5,14,26,42,60,80,102]`.
