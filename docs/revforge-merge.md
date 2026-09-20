# DriveSynth × RevForge

This branch combines Wilson's published RevForge application with DriveSynth. RevForge is the default sound engine, following Wilson's preference for its synthesis. The original nine DriveSynth voices remain selectable alternatives.

## Sources and provenance

- DriveSynth baseline: `a98a64d9abe8b6e4537ecc60a14d80beb61a65cf`.
- RevForge published app: https://rev-forge.grok.me/ (inspected September 20, 2026).
- Public application bundle: `/assets/routes-BoYveTbx.js`.
- Bundle SHA-256: `bda6f4dd018e750c4bd389dbccd0d7174c42016bbaee1d28b0dcef65051d1764`.

The public bundle supplied the 13 preset definitions, 11 architecture templates, procedural Canvas scene art, and the native audio implementation. Only application-owned functionality was ported; no Grok framework bundle, account integration, tracking script, or remix overlay is included. The private source repository was not available. Recovered synthesis and scene modules retain short local identifiers from the published bundle; expression statements were expanded and formatted for readability.

## Combined behavior

- `/drive`: new responsive dashboard, animated environments, 13 RevForge presets, nine DriveSynth alternatives, manual/automatic transmission, neutral, brake and throttle.
- Native RevForge studio: architecture selection, turbo, blow-off, crackle, grit, engine character, transmission settings, optional lo-fi layer, save/export of custom voices.
- `/builder`: existing DriveSynth signal editor, including an adapter for native voice parameter editing. The existing graph editor maps node parameters onto synthesis controls; arbitrary signal routing is not added by this merge.
- `/cockpit`: original DriveSynth cockpit view, including TIE and F-14 themes. This remains the legacy drive UI; its indicated manual gear is not connected to the new `/drive` drivetrain.
- Existing engine library, customization, diagnostics and saved user patches are retained. Native presets include a `revforge` object so saving and reloading preserves their synthesis backend.

### Audio preservation and changes

The oscillator waveforms, harmonics, pink/white/brown noise layers, filters, compression, shift ducking, overrun crackle, blow-off and procedural lo-fi music algorithms come from RevForge. Preset sound parameters are carried over directly, rather than approximated with DriveSynth's worklet engine.

The adapter shares the application's AudioContext and mute/volume output. It uses one destination path; the published app connected both directly to the destination and through a media element. Loudness can therefore differ at the same numeric volume setting. Graph nodes and timers are explicitly disposed when changing audio backends. A WaveShaper replacement fallback preserves the requested distortion curve in strict runtimes that reject repeated curve assignments. See https://webaudio.github.io/web-audio-api/#dom-waveshapernode-curve and https://github.com/WebAudio/web-audio-api/issues/2655.

### Drive and GPS

The new drivetrain derives RPM from speed, gear ratio, final drive and wheel circumference. The same RPM feeds the dashboard and sound engine. Neutral permits stationary free revving; over-revving downshifts are rejected. GPS input is measured speed, not a pedal-adjustable speed target. Missing or stale GPS readings return the simulated engine smoothly toward idle. Browser GPS does not expose the vehicle's accelerator, CAN bus, actual gearbox or wheel speed.

Demo is the default. GPS permission is requested only after choosing Live GPS. Lost pointer capture, blur and modal opening release virtual controls. Hiding the drive tab stops audio; returning requires Resume. Animations respect reduced-motion preference and are capped at 30 FPS with a 1.5 pixel-ratio ceiling.

## Verification

Use Node 24, `npm ci`, `npm test`, `npm run build` and `npm run lint`.

21 tests cover all 13 native audio presets with a real offline Web Audio renderer, graph/timer disposal, manual RPM drops, neutral, automatic shifting, braking, rejected over-rev downshifts, stale GPS and long frame gaps. Tests establish finite, audible output and drivetrain behavior; they do not establish perceptual audio equivalence or in-car compatibility.

The production build succeeds. Server-side rendering checks pass for the drive, cockpit, engines, customization and builder routes; diagnostics intentionally reads browser globals. Lint has warnings, including existing React hook findings. Interactive layout/audio checks of the combined app and testing on the actual Tesla remain required. The available cloud browser could inspect the published RevForge app, but rejected local preview URLs and local file navigation. No browser-policy workaround was used.

## Before promoting to production

Host this branch's `dist/` on an isolated HTTPS preview. Verify phone and Tesla landscape layouts, Start/Stop/Mute, all voice families, saved custom presets, background/resume, denied/stale GPS, touch cancellation and manual shifts. A/B the native voices against RevForge at matched loudness. This branch does not change the existing production deployment.
