# RevForge — Sound Lab 06

- Twin-Ion: three stackable moving-formant tonal screams with FM, reduced air bed, separate digital acceleration cue, body and spatial controls. Original procedural audio; no copied samples.
- Sound Lab: all built-in engine voices plus isolated roar, digital, interior, targeting, jet spool, thrust, afterburner, oscillator and noise sources. Up to eight layers, live level/pitch/pan/filter/response, mute/solo/duplicate/remove, advanced source parameters and graph routing. Main voice level and common master/mute output. Saved in voice presets.
- GPS: retains native speed (including zero); estimates from timestamped accurate coordinates when native speed is null; rejects stale, weak, impossible and stationary-wander estimates. Estimated/readout status, accuracy and Retry GPS. GPS HUD updates even before audio runs. Locations stay in memory.
- Background: actual synth output is routed through an HTML media element when supported, with direct-output fallback. Page hiding no longer intentionally stops enabled background audio. Hidden-page simulation updates continue while the browser schedules timers. Media Session remains experimental on Tesla.
- Lightbike: electric harmonic preset, Photon Cycle gauge and Light Grid atmosphere.
- Per-cluster number/label font picker, including bundled FT Aurebesh and Engli-Besh.
- 12 × 6 cluster builder: ten instrument types, placement, sizing, editable labels, overlap/boundary checks and saved layout.
- Gauge arcs, rails, needles and tick labels use configured top speed in the chosen display unit.

Validation: TypeScript/Vite build; offline audio, GPS fallback, physical-unit scales, grid geometry, mixer ownership/gating and media routing tests. Browser QA follows publication. GPS accuracy and background continuity still require a new Tesla field test; no hardware verification or subjective reference-match claim.
