# Frontend handoff — continuous driving adapt (Audio fix)

**Branch:** `audio/fix-driving-adapt`  
**Lane:** Audio. Splash / AppShell / ForgePage chrome **untouched**.

## Status

Frontend wire is fine: `useDriveSimulation` still calls `setDriving` every rAF when `audio.running`, including `rpmNorm` from the drivetrain sim. Soft-cues do not gate driving.

## Audio root cause (fixed)

1. `createEngineSynth` dropped the `CharacterEngine` + `RevForgeSynth` wrap (Ion Twin continuous-roar port), so native RevForge packs and character forwarding broke.
2. `CharacterEngine` forced `legacyGate=0` for scifi/aerospace, muting the EngineSynthImpl continuous roar / organic jet once the wrap was restored without a mute fix.
3. `EngineSynthImpl.setDriving` discarded Frontend `rpmNorm` / `rpm`, then `applyDriving` rebuilt rpm from `speed^~2` with a **speed≥0.04 cliff** that collapsed Hold-to-rev morph when rolling started.

## Audio fix

- Prefer `DrivingInput.rpmNorm` when finite; else dual-map `speed→curve` + throttle without the cliff.
- Restore `createEngineSynth` → `RevForgeSynth` | `EngineSynthImpl` wrapped in `CharacterEngine`.
- Unmute base layer for scifi/aerospace (`baseLayerLevel`); ProceduralCharacter roar is opt-in via `tieSignature` (no longer forced on).
- `playStarter` / `playShutoff` forward through `CharacterEngine`.

## Frontend — no change required

Keep sending:

```ts
audio.setDriving({
  speed,      // 0..1 from mph / top speed
  throttle,   // pedal or GPS load
  load,
  rpm,
  rpmNorm,    // from idle/redline sim — Audio prefers this
  ...
});
```

Optional: if a caller omits `rpmNorm`, Audio falls back to speed/throttle dual map (parked revs still work).
