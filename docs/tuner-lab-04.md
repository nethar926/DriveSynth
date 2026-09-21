# RevForge Tuner Lab 04

Full-viewport launch and floating HUD adapted from the published RevForge interface. Atmosphere and dashboard overlays are independent. Tuner contains Themes, Clusters, Display, and SynthGarage; scale and opacity persist. All 40 theme display names are revised without breaking saved IDs.

SynthGarage saves gear count (1–10), maximum RPM, auto-shift RPM, linked redline RPM/percentage, and top speed. Maximum RPM limits the simulation; redline marks the warning band. Top speed caps demo travel and sets gear scaling; measured GPS is not capped to the custom vehicle setting.

The new live signal editor routes real Web Audio nodes: engine input, oscillator, noise, low-pass filter, gain and output. Changes apply during audition, disconnected nodes stay silent, and cycles are rejected. The older /sound-builder remains a legacy parameter-mapping editor; it is no longer the main Tuner workflow.

Original procedural character layers were calibrated using spectral and amplitude-envelope measurements of the seven supplied WAV references. No recordings, samples, or extracted waveforms are shipped. Roar variants emphasize 205/404/1066, 436/598/1400 and 420/721/1254 Hz respectively; optional interior hum uses 54/108/129 Hz and targeting uses 1260/1502/2099 Hz. Pitch, resonance, grit, pulse, attack, release and levels are adjustable. Startup, shutdown, gearing and blaster cues use synthesized sweeps and filtered noise. These are approximations requiring listening feedback, not exact reproductions.

Received Media Session play/pause events fire blasters for a running sci-fi voice. Touch controls remain available. Tesla field tests previously failed media-button delivery and background audio; this update does not claim either works. Tesla GPS permissions/data availability still require vehicle testing.

Source comparison: the published UI was inspected from https://rev-forge.grok.me, whose observed entry assets were index-BeSJJ7Vw.js, routes-BoYveTbx.js and styles-DpL81MnU.css. The shared Grok page was a conversation, not a full source export. The deployed interface and existing recovered synthesis informed integration; no unrelated Grok runtime was copied.

Validation: 38 tests cover native audio, character-layer gating/cues/cleanup, real graph filtering/routing, media-action dispatch, custom gear count/top speed, automatic shifts, GPS separation and simulation bounds. Production build succeeds. Lint reports existing React and unused-helper warnings; no lint errors.
