# DriveSynth

**Free** Tesla in-car engine-sound web app. Procedural Web Audio only — original software, dribe-inspired UX concepts, **no** copied assets/branding/audio packs.

All packs unlocked. No accounts. No paywall.

## Quick start

```bash
cd DriveSynth
npm install
npm run dev      # http://localhost:5173
npm run build    # production → dist/
npm run preview  # serve dist locally
```

Open on a phone or laptop first, then bookmark the HTTPS URL in **Tesla Browser**.

## Tesla Browser tips

1. **Bookmark** the deployed HTTPS URL (do not rely on PWA / add-to-home-screen).
2. Complete setup **Parked**: tap **Start / Resume Engine** (user gesture unlocks `AudioContext`).
3. Tap the GPS badge to allow location — speed drives pitch; Δspeed proxies throttle.
4. No GPS / denied? Enable **Manual speed** + hold the **REV** pad.
5. **Keep the Browser tab open** — backgrounding may pause audio and sensors.
6. Avoid native OS volume extremes that mask sirens/nav; entertainment only.
7. Prefer landscape; targets are ≥48px for capacitive glass.

## Routes

| Route | Purpose |
|-------|---------|
| `/` or `/drive` | Driving HUD (default) |
| `/engines` | Free pack picker (all unlocked) |
| `/customize` | Themes, density, gauges, mapping (`localStorage` `drivesynth.ui.v1`) |
| `/builder` | Node graph editor, param rails, mock driving, save/export/import (`drivesynth.patches.v1`) |

Hash routing (`#/drive`) is used so static hosts work without rewrite rules.

## Built-in engines (procedural)

- **V8 Rumble** (`v8-rumble`) — AudioWorklet pulse-train ICE + Karplus–Strong exhaust (oscillator fallback)
- **I4 Zip** (`i4-zip`) — even-fire four-cylinder pulse path
- **EV Whine** (`ev-whine`) — inverter-style whine + buzz
- **Ion Twin** (`tie-fighter`) — twin-ion carriers + multi-formant howl + wet-road hiss — **procedural only, no samples**

## Audio API

```ts
interface EngineSynth {
  start(): Promise<void>;
  stop(): void;
  dispose(): void;
  setDriving(d: { speed: number; throttle: number; load?: number; reverse?: boolean }): void;
  setParams(p: Partial<EngineParams>): void;
  getParams(): EngineParams;
  toPatch(): EnginePatch;
  fromPatch(patch: EnginePatch): void;
}
```

Frontend maps mph → `speed` 0..1 via `mphToSpeed`. Audio owns RPM curves and smoothing.

## Key files

```
src/audio/EngineSynthImpl.ts   # Web Audio graphs + pulse worklet + driving mapping
src/audio/worklets/             # AudioWorklet processors (also copied to public/worklets)
src/audio/types.ts             # EngineSynth / EnginePatch contracts
src/audio/builtins.ts          # Free built-in patches
src/pages/DrivePage.tsx        # HUD, GPS, Rev pad
src/pages/EnginesPage.tsx      # Pack picker
src/pages/CustomizePage.tsx    # Themes / gauges
src/pages/BuilderPage.tsx      # Synth builder
src/hooks/useUiPrefs.ts        # drivesynth.ui.v1
src/hooks/usePatches.ts        # drivesynth.patches.v1
src/app/App.tsx                # Routing + wiring
```

## Legal / safety

- Original synthesis and UI. Inspired by public Tesla engine-sound UX patterns only.
- Do not ship copyrighted movie/game samples.
- Entertainment only — do not handle the screen while driving; GPS ≠ speedometer.

## Stack

Vite · React · TypeScript · Web Audio · React Router · Tailwind CSS v4
