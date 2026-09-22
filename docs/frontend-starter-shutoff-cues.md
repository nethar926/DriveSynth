# Frontend: Ignition starter + Shutdown shutoff cues

**Audio-only contract** — do not change IGNITION splash / ForgePage / AppShell chrome for this feature. Soft-cue from existing Ignition / Shutdown handlers.

## API (same path as upshift)

```ts
// After audio unlocked / eng.start():
eng.triggerUiCue('starter');   // alias: 'ignition'
// or
eng.playStarter?.();

// Before eng.stop() (preferred order so the tail is audible):
eng.triggerUiCue('shutdown');  // alias: 'shutoff'
// or
eng.playShutoff?.();
eng.stop();
```

Also exported from `useAudioEngine()` as `triggerUiCue`, `playStarter`, `playShutoff`.

## Behavior

One-shots are **procedural from the active pack** (`kind` + live `EngineParams`) — not one shared WAV.

| Kind | Starter | Shutoff |
|------|---------|---------|
| `ice` | Irregular crank pulses → catch lope | Fuel-cut rundown + short mechanical settle |
| `aerospace` | Spool climb + light igniter hiss | Spool decay (no hard gate) |
| `scifi` (Ion Twin) | Twin-motor bed → formant breath | Howl collapses → motor bed → silence |
| `ev-whine` | Inverter wake + soft contactor | Spin-down + soft open |

`stop()` holds `output` gain when a shutoff was just cued so the tail is not muted by the normal 120ms fade.

## Notes

- Does **not** alter `setDriving` / continuous engine graph.
- Starter is debounced (~450ms) if Ignition double-fires.
- Idle chuff on `start()` remains as a short unlock diagnostic; Frontend starter is the full per-engine gesture.
