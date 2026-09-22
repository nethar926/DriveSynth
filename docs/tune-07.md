# RevForge TUNE 07

## Product changes

TUNE opens Options, Visuals, Revs, Lab and Account, in that order. Visuals has Themes / Clusters tabs. Lab has DashLab / EngineForge tabs. Revs is the original engine catalog; Tune This Engine clones a preset to a user-owned engine before editing. Original engine parameters are not edited from Options. Recoloring lives in a collapsed Garage appearance dropdown in Revs. Throttle and hold-to-rev are rendered only in Demo mode.

First-use welcome, DashLab and EngineForge guides have multiple steps, skip, completion persistence and a help button to reopen them.

Account supports local multiple-vehicle profiles, active selection, top speed with lossless MPH/KPH conversion, year, brand, model and vehicle name. Active vehicle top speed drives all driving-cluster scales and drivetrain scaling. Saved configurations include sound layers, custom instrument layout, colors and fonts. Local saves work without sign-in.

The component car map supports pointer dragging, keyboard movement, selection, balance and spatial fade. Each layer has independent HRTF position, gain, pitch, low-pass filter and engine parameters. Added engine mechanical, exhaust pulse and turbo whistle sources. These are original synthesized components. Front/back is stereo spatial simulation; physical Tesla speaker routing has not been established. No claim of individual rear-speaker control is made.

## Twin-Ion reference calibration

Remeasured the supplied local WAV recordings using 22.05 kHz mono decoding, 8192-sample Welch spectra and separated spectral peaks. No waveform or sample from those files ships in the app.

| Reference | Duration | Strong resonances (Hz) |
|---|---:|---|
| Roar1.wav | 5.94 s | 205, 406, 361, 159, 517, 1063 |
| Roar2.wav | 5.20 s | 436, 552, 598, 129, 875, 1402 |
| Roar3.wav | 6.55 s | 420, 1314, 377, 1252, 732, 912 |
| Interior Hum.wav | 8.73 s | 57, 118, 186, 231 |
| TwinIon startup.wav | 2.18 s | 423, 479, 105, 834 |
| Targeting.wav | 2.18 s | 1499, 1262, 261 |
| Gearing Down.wav | 12.18 s | 78, 140, 242, 420 |

Expanded each roar from three to six measured resonances; retuned the third carrier to 140 Hz and reduced the overall pitch sweep. Interior partials now follow the measured hum peaks. Independent digital acceleration cue remains available. The earlier original FM ion-cannon model is retained. Startup and gear cues are shorter engine-event interpretations, not full-length recreations of the reference clips. No subjective A/B fidelity claim.

## Account activation required

Supabase client integration is implemented for Apple / Google OAuth with PKCE. The deployment needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Do not put a service-role key, Apple private key or Google client secret in the browser or repo.

1. Create/select the account owner's Supabase project and run `supabase/schema.sql`.
2. Enable Apple and Google providers in its Authentication settings, configuring their private credentials there.
3. Register the Supabase auth callback in each provider, then allow the published RevForge URL in Supabase redirect URLs.
4. Set the two public build variables and rebuild/deploy.
5. Test each provider and verify one account cannot read another account's garage.

The preview shows disabled sign-in buttons and a truthful connection notice until configured. Cloud synchronization cannot be tested before the account owner connects the provider project. Vehicles and saved configurations remain usable locally.
