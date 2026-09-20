import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { BUILTIN_PATCHES, getBuiltin } from "../audio";
import type { EnginePatch } from "../audio";
import type { useAudioEngine } from "../hooks/useAudioEngine";
import type { useGeolocation } from "../hooks/useGeolocation";
import type { UiPrefs } from "../hooks/useUiPrefs";
import { SCENES, sceneForId, scenePatch, drivetrainFor } from "./catalog";
import { NativeStudio } from "./NativeStudio";
import { SceneCanvas } from "./SceneCanvas";
import { useDriveSimulation } from "./useDriveSimulation";
import "./forge.css";

interface Props {
  audio: ReturnType<typeof useAudioEngine>;
  gps: ReturnType<typeof useGeolocation>;
  prefs: UiPrefs;
  update: (p: Partial<UiPrefs>) => void;
  onSelectEngine: (p: EnginePatch) => void;
  onGpsEnabled: (enabled: boolean) => void;
  onSavePatch: (patch: EnginePatch) => void;
  userPatches: EnginePatch[];
}
function storedScene(engineId: string) {
  if (engineId.startsWith("revforge-")) return engineId.slice(9);
  try {
    return localStorage.getItem("drivesynth.forge.scene") ?? "road-66";
  } catch {
    return "road-66";
  }
}
function Icon({
  name,
  size = 20,
}: {
  name: "power" | "grid" | "tune" | "volume" | "arrow" | "close" | "wave";
  size?: number;
}) {
  const paths = {
    power: (
      <>
        <path d="M12 3v9" />
        <path d="M6.5 5.5a8 8 0 1 0 11 0" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="15" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="15" width="6" height="6" rx="1" />
        <rect x="15" y="15" width="6" height="6" rx="1" />
      </>
    ),
    tune: (
      <>
        <path d="M4 7h7m5 0h4M4 17h3m5 0h8" />
        <circle cx="13" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
    volume: (
      <>
        <path d="m11 4-5 4H3v8h3l5 4zM16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    wave: <path d="M2 12h3l3-8 4 16 4-13 3 5h3" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function ForgePage({
  audio,
  gps,
  prefs,
  update,
  onSelectEngine,
  onGpsEnabled,
  onSavePatch,
  userPatches,
}: Props) {
  const [sceneId, setSceneId] = useState(() => storedScene(audio.engineId));
  const [panel, setPanel] = useState<
    "scenes" | "garage" | "tune" | "studio" | null
  >(null);
  const [source, setSource] = useState<"demo" | "gps">("demo");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [pedal, setPedal] = useState(0);
  const [brake, setBrake] = useState(false);
  const [motion, setMotion] = useState(true);
  const [mutedBeforeHide, setMutedBeforeHide] = useState(false);
  const [revision, setRevision] = useState(0);
  const scene = sceneForId(sceneId);
  const patch = useMemo(
    () =>
      audio.getPatch() ??
      userPatches.find((p) => p.id === audio.engineId) ??
      getBuiltin(audio.engineId),
    [audio, userPatches, revision],
  );
  const config = useMemo(() => drivetrainFor(patch, scene), [patch, scene]);
  const { simulation, hud, shift, neutral, reset } = useDriveSimulation(
    audio,
    gps,
    config,
    source,
    mode,
    pedal,
    brake,
  );
  const speed = hud.speedMps * (prefs.speedUnit === "kph" ? 3.6 : 2.236936);
  const rpmPercent = Math.min(1, hud.rpm / config.redline);
  const revReady = audio.running && source === "demo";
  const [tone, setTone] = useState<number | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem("drivesynth.forge.scene", sceneId);
    } catch {
      /* private browsing */
    }
  }, [sceneId]);
  useEffect(() => {
    audio.setUpshiftSfxEnabled(prefs.upshiftSfx);
    audio.setLockSfxEnabled(prefs.ionTwinLockSfx);
  }, [audio, prefs.upshiftSfx, prefs.ionTwinLockSfx]);
  useEffect(() => {
    const release = () => {
      setPedal(0);
      setBrake(false);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        release();
        audio.stop();
        setMutedBeforeHide(true);
      }
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [audio]);
  useEffect(() => {
    if (panel) {
      setPedal(0);
      setBrake(false);
    }
  }, [panel]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      if (e.key === "Escape") {
        setPanel(null);
        setPedal(0);
        setBrake(false);
        return;
      }
      if (panel || !audio.running) return;
      if (e.code === "Space" && source === "demo") {
        e.preventDefault();
        setPedal(e.type === "keydown" ? 1 : 0);
      }
      if (e.key.toLowerCase() === "b" && source === "demo")
        setBrake(e.type === "keydown");
      if (mode === "manual" && e.type === "keydown" && !e.repeat) {
        if (["ArrowUp", ".", "="].includes(e.key)) {
          e.preventDefault();
          shift(1);
        }
        if (["ArrowDown", ",", "-"].includes(e.key)) {
          e.preventDefault();
          shift(-1);
        }
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
    };
  }, [audio.running, panel, source, mode, shift]);
  const setDriving = audio.setDriving;
  useEffect(
    () => () => setDriving({ speed: 0, throttle: 0, load: 0 }),
    [setDriving],
  );
  useEffect(() => () => onGpsEnabled(false), [onGpsEnabled]);
  const selectScene = (id: string) => {
    setSceneId(id);
    onSelectEngine(scenePatch(sceneForId(id)));
    setPedal(0);
    setBrake(false);
    setPanel(null);
  };
  const start = () => {
    setMutedBeforeHide(false);
    void audio.start();
  };
  const stop = () => {
    setPedal(0);
    setBrake(false);
    audio.stop();
    reset();
  };
  const sourceChange = (next: "demo" | "gps") => {
    setSource(next);
    setPedal(0);
    setBrake(false);
    onGpsEnabled(next === "gps");
  };
  const hold = (
    e: PointerEvent<HTMLButtonElement>,
    type: "throttle" | "brake",
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (type === "throttle") setPedal(1);
    else setBrake(true);
  };
  const gpsLabel =
    gps.status === "live"
      ? "GPS live"
      : gps.status === "denied"
        ? "GPS denied"
        : gps.status === "stale"
          ? "GPS stale"
          : "Waiting for GPS";
  const options = [...BUILTIN_PATCHES, ...userPatches];
  return (
    <div
      className="forge"
      style={{ "--forge-accent": scene.palette.accent } as CSSProperties}
    >
      <header className="forge-header">
        <Link to="/drive" className="forge-brand" aria-label="DriveSynth home">
          <span className="forge-logo">
            <Icon name="wave" size={25} />
          </span>
          <span>
            DRIVESYNTH<small>REVFORGE EDITION</small>
          </span>
        </Link>
        <nav className="forge-nav" aria-label="Main navigation">
          <span className="forge-nav-active">Drive</span>
          <button onClick={() => setPanel("garage")}>Garage</button>
          <button onClick={() => setPanel("studio")}>Synth studio</button>
          <Link to="/cockpit">Cockpit</Link>
        </nav>
        <div className="forge-header-tools">
          <span className="forge-version">PROCEDURAL AUDIO / 01</span>
          <button
            className="forge-icon"
            aria-label="Sound and display settings"
            onClick={() => setPanel("tune")}
          >
            <Icon name="tune" />
          </button>
        </div>
      </header>
      <main className="forge-main">
        <div className="forge-heading">
          <div>
            <p className="forge-eyebrow">YOUR DRIVE. YOUR SOUND.</p>
            <h1>A different kind of engine.</h1>
          </div>
          <div className="forge-status">
            <i className={audio.running ? "is-live" : ""} />
            {audio.starting
              ? "STARTING"
              : audio.running
                ? "ENGINE LIVE"
                : "ENGINE STANDBY"}
          </div>
        </div>
        <div className="forge-dashboard">
          <section
            className="forge-world"
            aria-label="Driving scene and instruments"
          >
            <SceneCanvas
              scene={scene}
              simulation={simulation}
              motion={motion}
            />
            <div className="forge-world-shade" />
            <div className="forge-scene-title">
              <span className="forge-scene-index">
                {String(SCENES.indexOf(scene) + 1).padStart(2, "0")} /{" "}
                {SCENES.length}
              </span>
              <h2>{scene.name}</h2>
              <p>{scene.tagline}</p>
            </div>
            <button
              className="forge-scene-button"
              onClick={() => setPanel("scenes")}
            >
              <Icon name="grid" size={16} />
              Change scene
            </button>
            <div className="forge-speed">
              <span className="forge-eyebrow">
                {source === "demo" ? "SIMULATED SPEED" : gpsLabel.toUpperCase()}
              </span>
              <div>
                <strong data-testid="speed">
                  {Math.round(speed).toString().padStart(2, "0")}
                </strong>
                <span>{prefs.speedUnit === "kph" ? "KM/H" : "MPH"}</span>
              </div>
              <span className="forge-speed-note">
                {source === "demo"
                  ? "Demo drive · no vehicle connection"
                  : "Browser GPS · estimated speed"}
              </span>
            </div>
            <div className="forge-instruments">
              <div className="forge-revs">
                <div className="forge-instrument-top">
                  <span>ENGINE SPEED</span>
                  <span>
                    <b data-testid="rpm">
                      {audio.running
                        ? Math.round(hud.rpm).toLocaleString()
                        : "—"}
                    </b>{" "}
                    RPM
                  </span>
                </div>
                <div
                  className="forge-rpm-bars"
                  aria-label={`${Math.round(hud.rpm)} RPM`}
                >
                  {Array.from({ length: 40 }, (_, i) => (
                    <i
                      key={i}
                      className={`${i / 40 < rpmPercent && audio.running ? "lit" : ""} ${i > 32 ? "redline" : ""}`}
                    />
                  ))}
                </div>
                <div className="forge-rpm-scale">
                  <span>0</span>
                  <span>{Math.round(config.redline / 2000)}</span>
                  <span>{(config.redline / 1000).toFixed(1)} × 1000</span>
                </div>
              </div>
              <div className="forge-gear">
                <span>GEAR</span>
                <strong data-testid="gear">
                  {hud.gear === 0 ? "N" : hud.gear}
                </strong>
                <small>
                  {hud.shifting
                    ? "SHIFTING"
                    : config.gears === 1
                      ? "DIRECT"
                      : mode === "auto"
                        ? "AUTOMATIC"
                        : "MANUAL"}
                </small>
              </div>
            </div>
            {!audio.running && (
              <button
                className="forge-ignition"
                disabled={audio.starting}
                onClick={start}
              >
                <Icon name="power" size={20} />
                {audio.starting
                  ? "Starting…"
                  : mutedBeforeHide
                    ? "Resume engine"
                    : "Start engine"}
                <Icon name="arrow" size={18} />
              </button>
            )}
          </section>
          <aside className="forge-console" aria-label="Drive controls">
            <div className="forge-console-title">
              <span className="forge-eyebrow">POWERTRAIN</span>
              <button
                className="forge-text-button"
                onClick={() => setPanel("garage")}
              >
                Swap <Icon name="arrow" size={14} />
              </button>
            </div>
            <h2>{audio.patchName}</h2>
            <p className="forge-engine-type">
              {patch?.kind === "ice"
                ? `${patch.params.cylinders ?? 8} CYLINDER · COMBUSTION`
                : patch?.kind === "scifi"
                  ? "TWIN ION · SCI-FI"
                  : patch?.kind === "aerospace"
                    ? "TURBINE · AEROSPACE"
                    : "ELECTRIC · INVERTER"}
            </p>
            <div className="forge-specs">
              <div>
                <span>REDLINE</span>
                <strong>
                  {config.redline.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  <small>rpm</small>
                </strong>
              </div>
              <div>
                <span>LOAD</span>
                <strong>
                  {Math.round(hud.load * 100)}
                  <small>%</small>
                </strong>
              </div>
            </div>
            <div className="forge-control-group">
              <span className="forge-label">INPUT SOURCE</span>
              <div className="forge-segment">
                <button
                  aria-pressed={source === "demo"}
                  onClick={() => sourceChange("demo")}
                >
                  Demo
                </button>
                <button
                  aria-pressed={source === "gps"}
                  onClick={() => sourceChange("gps")}
                >
                  Live GPS
                </button>
              </div>
            </div>
            <div className="forge-control-group">
              <span className="forge-label">TRANSMISSION</span>
              <div className="forge-segment">
                <button
                  aria-pressed={mode === "auto"}
                  onClick={() => setMode("auto")}
                >
                  Automatic
                </button>
                <button
                  disabled={config.gears === 1}
                  aria-pressed={mode === "manual"}
                  onClick={() => setMode("manual")}
                >
                  Manual
                </button>
              </div>
            </div>
            {mode === "manual" && config.gears > 1 && (
              <div className="forge-paddles">
                <button
                  aria-label="Downshift"
                  onClick={() => shift(-1)}
                  disabled={!audio.running}
                >
                  −
                </button>
                <button
                  aria-label="Neutral"
                  onClick={neutral}
                  disabled={!audio.running}
                >
                  N
                </button>
                <button
                  aria-label="Upshift"
                  onClick={() => shift(1)}
                  disabled={!audio.running}
                >
                  +
                </button>
              </div>
            )}
            <label className="forge-throttle">
              <span className="forge-label">
                THROTTLE <b>{Math.round(pedal * 100)}%</b>
              </span>
              <input
                aria-label="Throttle"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={pedal}
                disabled={!revReady}
                onChange={(e) => setPedal(Number(e.target.value))}
              />
              <span className="forge-control-hint">
                {source === "gps"
                  ? "Engine load follows measured acceleration."
                  : hud.gear === 0
                    ? "Neutral · free rev without moving."
                    : "Raise the throttle to drive the simulation."}
              </span>
            </label>
            <div className="forge-pedals">
              <button
                className={`forge-rev ${pedal > 0.95 ? "pressed" : ""}`}
                disabled={!revReady}
                onPointerDown={(e) => hold(e, "throttle")}
                onPointerUp={() => setPedal(0)}
                onPointerCancel={() => setPedal(0)}
                onLostPointerCapture={() => setPedal(0)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setPedal(1);
                }}
                onKeyUp={() => setPedal(0)}
              >
                Hold to rev <span>SPACE</span>
              </button>
              <button
                className={brake ? "pressed" : ""}
                disabled={!revReady}
                onPointerDown={(e) => hold(e, "brake")}
                onPointerUp={() => setBrake(false)}
                onPointerCancel={() => setBrake(false)}
                onLostPointerCapture={() => setBrake(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setBrake(true);
                }}
                onKeyUp={() => setBrake(false)}
              >
                Brake <span>B</span>
              </button>
            </div>
            <div className="forge-audio-row">
              <button
                className="forge-icon"
                aria-label={prefs.masterMuted ? "Unmute" : "Mute"}
                aria-pressed={prefs.masterMuted}
                onClick={() => update({ masterMuted: !prefs.masterMuted })}
              >
                <Icon name="volume" size={18} />
                {prefs.masterMuted && <span className="forge-mute-dot" />}
              </button>
              <input
                aria-label="Master volume"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={prefs.masterVolume}
                onChange={(e) =>
                  update({ masterVolume: Number(e.target.value) })
                }
              />
              <span>{Math.round(prefs.masterVolume * 100)}</span>
              <button
                className="forge-icon"
                aria-label={audio.running ? "Stop engine" : "Start engine"}
                disabled={audio.starting}
                onClick={audio.running ? stop : start}
              >
                <Icon name="power" size={18} />
              </button>
            </div>
            {source === "gps" && (
              <p className="forge-gps-status" role="status">
                {gpsLabel}
                {gps.accuracy !== null
                  ? ` · ±${Math.round(gps.accuracy)} m`
                  : ""}
                {gps.status !== "live" && (
                  <>
                    .{" "}
                    {gps.errorMessage ??
                      "Allow location in the browser, or choose Demo."}
                    <button className="forge-text-button" onClick={gps.start}>
                      Retry GPS
                    </button>
                  </>
                )}
              </p>
            )}
            {audio.error && (
              <p className="forge-error" role="alert">
                Audio: {audio.error}
              </p>
            )}
          </aside>
        </div>
        <section className="forge-scenes-section" aria-label="Scene shortcuts">
          <div className="forge-section-heading">
            <div>
              <span className="forge-eyebrow">SET THE ATMOSPHERE</span>
              <h2>Pick your escape.</h2>
            </div>
            <button
              className="forge-text-button"
              onClick={() => setPanel("scenes")}
            >
              All {SCENES.length} scenes <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="forge-scene-grid">
            {["road-66", "neon-drive", "alpine", "tie-fighter"].map(
              (id, index) => {
                const card = sceneForId(id);
                return (
                  <button
                    key={id}
                    className={`forge-scene-card ${sceneId === id ? "selected" : ""}`}
                    onClick={() => selectScene(id)}
                    style={
                      {
                        "--card-top": card.palette.skyTop,
                        "--card-bottom": card.palette.haze,
                        "--card-accent": card.palette.accent,
                      } as CSSProperties
                    }
                  >
                    <div className={`forge-mini-art art-${card.scene}`}>
                      <span className="forge-mini-sun" />
                      <span className="forge-mini-road" />
                    </div>
                    <div className="forge-scene-card-label">
                      <span>
                        <small>
                          0{index + 1} / {card.scene.toUpperCase()}
                        </small>
                        <strong>{card.name}</strong>
                      </span>
                      <span className="forge-card-arrow">↗</span>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </section>
        <footer className="forge-footer">
          <span>
            <i />
            22 ORIGINAL VOICES · ALL UNLOCKED
          </span>
          <p>Set up while parked. Keep this browser tab open for audio.</p>
          <Link to="/diag">Diagnostics ↗</Link>
        </footer>
      </main>
      {panel && (
        <div className="forge-modal-backdrop" onClick={() => setPanel(null)}>
          <section
            className="forge-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === "scenes"
                ? "Choose a scene"
                : panel === "garage"
                  ? "Engine garage"
                  : panel === "studio"
                    ? "Synth studio"
                    : "Sound and display"
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPanel(null);
              if (e.key === "Tab") {
                const targets = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button:not(:disabled),a[href],input:not(:disabled)",
                  ),
                );
                const first = targets[0],
                  last = targets.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="forge-modal-heading">
              <div>
                <span className="forge-eyebrow">DRIVESYNTH × REVFORGE</span>
                <h2>
                  {panel === "scenes"
                    ? "Find your atmosphere."
                    : panel === "garage"
                      ? "Your engine collection."
                      : panel === "studio"
                        ? "Build your signature sound."
                        : "Make it yours."}
                </h2>
              </div>
              <button
                autoFocus
                className="forge-icon"
                aria-label="Close panel"
                onClick={() => setPanel(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            {panel === "scenes" && (
              <div className="forge-picker-grid">
                {SCENES.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={sceneId === p.id}
                    onClick={() => selectScene(p.id)}
                    style={
                      {
                        "--card-top": p.palette.skyTop,
                        "--card-bottom": p.palette.haze,
                        "--card-accent": p.palette.accent,
                      } as CSSProperties
                    }
                  >
                    <div className={`forge-mini-art art-${p.scene}`}>
                      <span className="forge-mini-sun" />
                      <span className="forge-mini-road" />
                    </div>
                    <strong>{p.name}</strong>
                    <p>{p.tagline}</p>
                  </button>
                ))}
              </div>
            )}
            {panel === "garage" && (
              <div className="forge-garage-list">
                {options.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={audio.engineId === p.id}
                    onClick={() => {
                      onSelectEngine(p);
                      if (p.id.startsWith("revforge-"))
                        setSceneId(p.id.slice(9));
                      setPedal(0);
                      setPanel(null);
                    }}
                  >
                    <span className="forge-engine-monogram">
                      {p.kind === "ice"
                        ? `${p.params.cylinders ?? 8}`
                        : p.kind === "aerospace"
                          ? "JET"
                          : p.kind === "scifi"
                            ? "ION"
                            : "EV"}
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.meta?.blurb}</small>
                    </span>
                    <span>{audio.engineId === p.id ? "●" : "↗"}</span>
                  </button>
                ))}
              </div>
            )}
            {panel === "studio" && patch && (
              <NativeStudio
                patch={patch}
                onChange={(next) => {
                  onSelectEngine(next);
                  setRevision((r) => r + 1);
                }}
                onSave={(next) => {
                  onSavePatch(next);
                  setRevision((r) => r + 1);
                }}
              />
            )}
            {panel === "tune" && (
              <div className="forge-tune">
                <label>
                  Speed units
                  <select
                    value={prefs.speedUnit}
                    onChange={(e) =>
                      update({
                        speedUnit: e.target.value as UiPrefs["speedUnit"],
                      })
                    }
                  >
                    <option value="mph">Miles per hour</option>
                    <option value="kph">Kilometers per hour</option>
                  </select>
                </label>
                <label>
                  Animated environment
                  <input
                    type="checkbox"
                    checked={motion}
                    onChange={(e) => setMotion(e.target.checked)}
                  />
                </label>
                <label>
                  Shift sound
                  <input
                    type="checkbox"
                    checked={prefs.upshiftSfx}
                    onChange={(e) => update({ upshiftSfx: e.target.checked })}
                  />
                </label>
                <label>
                  Ion lock cues
                  <input
                    type="checkbox"
                    checked={prefs.ionTwinLockSfx}
                    onChange={(e) =>
                      update({ ionTwinLockSfx: e.target.checked })
                    }
                  />
                </label>
                <label>
                  Tone / presence
                  <input
                    type="range"
                    aria-label="Tone presence"
                    min="0"
                    max="1"
                    step=".01"
                    value={
                      tone ??
                      Number(audio.getEngine()?.getParams().presence ?? 0.5)
                    }
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setTone(value);
                      audio.getEngine()?.setParams({ presence: value });
                    }}
                    disabled={!audio.ready}
                  />
                </label>
                <p>
                  For custom voices, signal graphs, and saved presets, open the
                  full synth studio.
                </p>
                <button
                  className="forge-studio-link"
                  onClick={() => setPanel("studio")}
                >
                  Open synth studio <Icon name="arrow" />
                </button>
                <Link to="/customize">Cockpit appearance settings ↗</Link>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
