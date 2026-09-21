# Cockpit Lab 05

Twin-Ion now uses only the new procedural audio bus; the previous synth's output is gated off for sci-fi voices. The rebuilt engine uses sine partials with slow drift, low-frequency body, colored noise, broad moving resonances and short filtered spatial delays. Three roar banks can be enabled together with independent levels and gain normalization. Existing single-variant presets migrate on first layer edit. Body, air and spatial depth are tunable. No supplied recordings are embedded.

Ion Cannons replace the Blasters label. The new MP3 reference was measured locally: prominent lower-mid energy around 400–450 Hz and low components around 65–130 Hz. The procedural approximation uses paired FM discharges, pitch decay and a filtered pressure tail. Pitch and level are adjustable. This is not a claim of an exact perceptual match.

Aerospace voices have a separate rotor/compressor spool bus, inertia and pitch controls, filtered thrust bus and afterburner component. The prior broadband jet output is gated off. Turning Jet Simulation off retains only spool. Native combustion fundamentals follow four-stroke firing frequency rather than crankshaft frequency; EV frequency follows motor electrical order. Distortion and runaway high-RPM gain are reduced. Shared legacy/native engine output filtering responds smoothly to RPM and load. These are browser sound models, not calibrated recordings of specific engines.

Galactic Enforcer is an additional selectable cockpit, using code-drawn instruments inspired by the supplied images: sensor pods, cannon-charge segments and a central targeting scope. The target is simulated; acquisition stages follow normalized RPM, with hysteresis shared by the new sci-fi audio wrapper. Optional confirmation cues work on both sci-fi engines. Cannon charge is an animated engine-reactive display, not an ammunition model.

Time circuits now show destination, present and last-departed dates. A physical-style keypad validates MMDDYYYYHHMM in local 24-hour time. Present time starts at the current date; crossing 88 mph shifts its simulated clock to the destination and records the departure. A 2.4-second visual/audio transition rearms below 84 mph. GPS is never changed. Destination and departure persist; real local date remains visible. Reduced-motion settings suppress the transition animation.

Display contains saved per-theme instrument colors and the full atmosphere palette (sky, haze, sun, road, lanes, shoulder, fog, particles and accent), with resets. Theme IDs remain stable.

Validation: 42 automated checks, including stacked audio bounds, procedural cues, independently gated jet layers, calendar validation and unit-independent 88-mph threshold. Audio render tests establish finite/audible output and gating, not subjective sound quality. Tesla media events and background audio still require field testing.
