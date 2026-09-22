# Ion Twin Layers v1

**Lane:** DriveSynth audio · ORIGINAL procedural Ion Twin  
**Branch target:** `audio/ion-twin-layers`  
**Legal:** Analyze-only refs — never ship ref WAVs as samples.

## Goal

Expose **separate tunable layer configs** that Frontend / Pro Builder can enable, gain-mix, and combine. Default pack = continuous roar (current TIE feel). Still driven by `setDriving({ speed, throttle })`.

## Layer ids

| Layer id | Ref DNA | Enable param | Mix param | Character knobs |
|----------|---------|--------------|-----------|-----------------|
| `motorBed` | B | `motorEnable` | `motorMix` | `corePitch`, `pulseRate`, `motorDetune`, `noiseBody`, `body`, `spoolLag`, `stereoTwin` |
| `formantHowl` | A/F | `howlEnable` | `howlMix` | `formantShift`, `formantSpread`, `resonance`/`formantQ`, `phraseRate`, `phraseDepth` |
| `screamBurst` | C | `screamEnable` | `screamMix` | `screamBright` (BP stack ~470/1270/1480) |
| `surge` | D | `surgeEnable` | `surgeMix` | rising CF + flyby on throttle spikes |
| `airSwoosh` | — | `airEnable` | `airMix` | `wetDry`, `wetHiss`/`air` |
| `grit` | — | `gritEnable` | `gritMix` | 2–5 kHz × load |

Enable params are `0` or `1` (≥0.5 = on). Mix params are `0..1`.

## Combine rules

1. Any subset of layers may be on; disabled layers contribute silence on their bus.
2. Flat `EngineParams` remain the live control surface (`setParams`).
3. Optional `EnginePatch.ionLayers?: IonTwinLayerConfig[]` mirrors enable/gain (+ character) for save/combine.
4. `applyIonTwinLayersToParams(base, layers)` merges layer rows into flat params (aliases kept in sync: `formantHowl`/`engineHowl`, `wetHiss`/`air`, `grit`, `carrierBite`/`motorMix`).
5. `combineIonTwinLayers(layers)` builds a scifi `EnginePatch` from a subset (starts all-off, then applies provided rows).
6. Presets: continuous roar = `TIE_DEFAULTS` / `ionTwinContinuousLayers()`; optional balanced stack = `TIE_FULL_STACK` / `ionTwinFullStackLayers()` (ref-E).

## Driving morph

`setDriving({ speed, throttle })` still morphs intensity / layer leadership with speed (motor lead at idle → howl at cruise → air/grit/scream with load). Spool lag and surge gestures remain speed/throttle driven; `surgeEnable`/`surgeMix` only scale the surge/flyby contribution.

## Frontend / Pro Builder

- `paramMetaForKind('scifi')` lists grouped enable + mix + character knobs.
- Prefer layer ids above in UI groups; do not rename franchise craft in labels (“Ion Twin”, “twin motors”, “formant howl”).
- Do **not** load attachment WAVs into the graph.

## Files

- `src/audio/types.ts` — layer params + `SoundLayer` + `layers?` on patch
- `src/audio/EngineSynthImpl.ts` — scream bus + enable gates
- `src/audio/builtins.ts` — `TIE_DEFAULTS` / `TIE_FULL_STACK` + param meta
- `src/audio/ionTwinLayers.ts` — combine helpers
- `public/snippets/ion-twin-tie-fighter.wav` — regenerated procedural preview only
