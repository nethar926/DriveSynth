# Handoff: remove Tie Fighter pack (Audio)

**Branch:** `audio/remove-tie-fighter-pack`  
**Lane:** Audio Synth · catalog / topology only (splash / AppShell / ForgePage chrome untouched)

## Sole sci-fi pack

| Role | Id | Display |
|------|----|---------|
| Builtin pack | `ion-twin` | Twin Ion |
| Topology | `ion-twin` | — |
| Skin (Frontend) | `ion-twin` | Twin Ion / Ion Twin HUD |

**Removed catalog id:** `tie-fighter` (no dual listing).

## Legacy migrate (kept on purpose)

- `resolveLegacyPackId('tie-fighter')` → `ion-twin`
- `resolveLegacyTopology('tie-fighter')` → `ion-twin`
- `migrateEnginePatch` on user patches (`usePatches`) + `selectedEngineId` in `useUiPrefs`
- `useAudioEngine(initialId)` resolves legacy ids at construct
- `getBuiltin('tie-fighter')` still resolves to Twin Ion builtin
- RevForge scene formerly `tie-fighter` → `trenchlight` (`revforge-trenchlight`); legacy `revforge-tie-fighter` / scene `tie-fighter` remap via `LEGACY_PACK_IDS` / `RETIRED_SCENE_IDS`

## Snippet

- Was: `public/snippets/ion-twin-tie-fighter.wav`
- Now: `public/snippets/ion-twin.wav` (`npm run render:snippets`)

## Frontend / Build Lead expectations

- Pack pickers / deep links should use **`ion-twin`** only for sci-fi.
- Theme Lab cockpit skins named `tie` / `xwing` / `road-tie-fighter` are **Frontend visual** retire work (not this branch). Audio does not ship a separate Tie Fighter engine pack.
- Research-only Burtt / design-language notes in `docs/audio-arch-v1-organic.md` remain; they do not advertise a shippable Tie Fighter pack id.

## Remaining builtin pack ids (after this change)

**Core:** `v8-rumble`, `i4-zip`, `i6-silk`, `rotary-hum`, `ev-whine`, `ev-inverter-climb`, `ev-regen-howl`, `ev-dual-motor`, `aerospace-f14`, `ion-twin`.

**RevForge scenes:** `revforge-road-66`, `revforge-apex-v8`, `revforge-neon-drive`, `revforge-italia`, `revforge-miami`, `revforge-autobahn`, `revforge-plaid`, `revforge-dune-runner`, `revforge-alpine`, `revforge-starliner`, `revforge-sakura-gtr`, `revforge-trenchlight`, `revforge-light-grid`.

Sole sci-fi **core** id: `ion-twin`. Sole sci-fi **RevForge scene** id: `trenchlight` (`revforge-trenchlight`, voice `starfighter` → topology `ion-twin`).
