# Rotary chamber-pulse ICE family v1

**Date:** 2026-09-22 ET  
**Branch:** `audio/rotary-chamber-pulse`  
**Legal:** Method only — original procedural Web Audio. No sample rips.

## Why

Not pistons: **chamber pulses** on an eccentric shaft. Layout diversity (RES lesson / physics-pulse-bus) as pack identity without cloning catalog assets.

## Worklet contract

| Field | Value |
|-------|--------|
| `firingFamily` | **4** (`rotary`) — ints 0–3 remain auto / cross / flat / even-i6 |
| `chambersPerRotor` | default **3** (2…4) |
| `rotors` | **1** or **2** (pack default 2 for stacked hum) |
| Cycle | **360°** eccentric (not 720° 4-stroke) |
| Events/rev | `chambersPerRotor × rotors` |

### Geometry

- **1 rotor / 3 chambers:** `[0, 120, 240]` — 3 power events per eccentric rev  
- **2 rotors / 3 chambers:** rotor-B offset half chamber → `[0, 60, 120, 180, 240, 300]` — stacked cadence  

`firingMask` bit *i* SET disables chamber slot *i*. Drop-chamber **must** change lope intervals (same north star as drop-cyl).

## Builtin pack

| id | topology | family | chambers | rotors | notes |
|----|----------|--------|----------|--------|-------|
| `rotary-hum` | `rotary-hum` | 4 | 3 | 2 | Soft waveguide, light roughness; cylinders=6 = total slots |

## Starter / shutoff

ICE kind with `firingFamily >= 3.5` reuses crank path as **chamber spin-up / eccentric rundown** (even triple cadence, denser for twin stack) — no chrome changes.

## Files touched (additive)

- `src/audio/worklets/pulse-engine-processor.js`
- `src/audio/types.ts`, `builtins.ts`, `engineStateBridge.ts`, `EngineSynthImpl.ts`, `engineStartShutdown.ts`, `index.ts`
- `docs/rotary-chamber-pulse-v1.md`
- `scripts/render-snippets.mjs` (+ `public/snippets/rotary-hum.wav`)
- `tests/engine-state-bridge.test.mjs`

**Out of scope:** IGNITION splash / AppShell / ForgePage chrome.
