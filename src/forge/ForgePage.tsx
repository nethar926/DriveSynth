import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BUILTIN_PATCHES, getBuiltin } from "../audio";
import type { EnginePatch } from "../audio";
import type { useAudioEngine } from "../hooks/useAudioEngine";
import type { useGeolocation } from "../hooks/useGeolocation";
import type { UiPrefs } from "../hooks/useUiPrefs";
import { sceneForId, drivetrainFor } from "./catalog";
import { ThemeStage } from "../themes/ThemeStage";
import { ThemePicker } from "../themes/ThemePicker";
import { themeForId, THEMES } from "../themes/catalog";
import type { useThemes } from "../themes/useThemes";
import { useVehicleMedia } from "./useVehicleMedia";
import { NativeStudio } from "./NativeStudio";
import { useDriveSimulation } from "./useDriveSimulation";
import "./forge.css";

interface Props {
  themes: ReturnType<typeof useThemes>;
  audio: ReturnType<typeof useAudioEngine>;
  gps: ReturnType<typeof useGeolocation>;
  prefs: UiPrefs;
  update: (p: Partial<UiPrefs>) => void;
  onSelectEngine: (p: EnginePatch) => void;
  onGpsEnabled: (enabled: boolean) => void;
  onSavePatch: (patch: EnginePatch) => void;
  userPatches: EnginePatch[];
}
function storedFlag(key: string, fallback: boolean) { try { const value=localStorage.getItem(key); return value===null?fallback:value==='true'; } catch { return fallback; } }
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
  themes,
  audio,
  gps,
  prefs,
  update,
  onSelectEngine,
  onGpsEnabled,
  onSavePatch,
  userPatches,
}: Props) {
  const [searchParams] = useSearchParams();
  const theme = themeForId(themes.skinId);
  const [panel, setPanel] = useState<
    "scenes" | "garage" | "tune" | "studio" | null
  >(() => searchParams.get("studio") === "1" ? "studio" : null);
  const [source, setSource] = useState<"demo" | "gps">(() => storedFlag("drivesynth.demo", true) ? "demo" : "gps");
  const [jitterEnabled,setJitterEnabled]=useState(()=>storedFlag("revforge.idleJitter",true));
  const [jitterAmount,setJitterAmount]=useState(()=>{try{return Math.max(0,Math.min(1,Number(localStorage.getItem("revforge.idleJitterAmount")??.25)));}catch{return .25;}});
  useEffect(()=>{try{localStorage.setItem("revforge.idleJitter",String(jitterEnabled));localStorage.setItem("revforge.idleJitterAmount",String(jitterAmount));}catch{/* session only */}},[jitterEnabled,jitterAmount]);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [pedal, setPedal] = useState(0);
  const [brake, setBrake] = useState(false);
  const [motion, setMotion] = useState(() => storedFlag("drivesynth.motion", true));
  const [mediaEnabled,setMediaEnabled] = useState(() => storedFlag("revforge.media.experimental", false));
  const [pauseShifts,setPauseShifts] = useState(() => storedFlag("drivesynth.pauseShifts", true));
  const [mutedBeforeHide, setMutedBeforeHide] = useState(false);
  const [revision, setRevision] = useState(0);
  const patch = useMemo(
    () =>
      audio.getPatch() ??
      userPatches.find((p) => p.id === audio.engineId) ??
      getBuiltin(audio.engineId),
    [audio, userPatches, revision],
  );
  const config = useMemo(() => drivetrainFor(patch, sceneForId("road-66")), [patch]);
  const { simulation, hud, shift, neutral, reset } = useDriveSimulation(
    audio,
    gps,
    config,
    source,
    mode,
    pedal,
    brake,
    jitterEnabled?jitterAmount:0,
  );
  const revReady = audio.running && source === "demo";
  const [tone, setTone] = useState<number | null>(null);
  useEffect(() => {try {localStorage.setItem("drivesynth.demo",String(source==='demo'));localStorage.setItem("drivesynth.motion",String(motion));localStorage.setItem("revforge.media.experimental",String(mediaEnabled));localStorage.setItem("drivesynth.pauseShifts",String(pauseShifts));}catch{/* preferences remain available this session */}},[source,motion,mediaEnabled,pauseShifts]);
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
  const selectScene = (id: string) => { themes.selectSkin(`road-${id}`); setPanel(null); };
  const start = () => {
    setMutedBeforeHide(false);
    media.arm();
    if(source === "gps") onGpsEnabled(true);
    void audio.start();
  };
  const stop = () => {
    setPedal(0);
    setBrake(false);
    audio.stop();
    reset();
  };
  const media = useVehicleMedia({enabled:mediaEnabled,running:audio.running,manual:mode==='manual' && config.gears>1,pauseShifts,name:audio.patchName,start:()=>{void audio.start();if(source==='gps')onGpsEnabled(true);},stop,shift});
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
      style={{ "--forge-accent": theme.accent } as CSSProperties}
    >
      <header className="forge-header">
        <Link to="/drive" className="forge-brand" aria-label="RevForge home">
          <span className="forge-logo">
            <Icon name="wave" size={25} />
          </span>
          <span>
            REVFORGE<small>ENGINE SOUND LAB</small>
          </span>
        </Link>
        <nav className="forge-nav" aria-label="Main navigation">
          <span className="forge-nav-active">Drive</span>
          <button onClick={() => setPanel("garage")}>Garage</button>
          <button onClick={() => setPanel("studio")}>Synth studio</button>
          <Link to="/builder">Builder</Link>
        </nav>
        <div className="forge-header-tools">
          <span className="forge-version">FLIGHT LAB / 03</span>
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
            <ThemeStage theme={theme} state={hud} simulation={simulation} redline={config.redline} unit={prefs.speedUnit} demo={source==='demo'} motion={motion} running={audio.running} gpsLabel={gpsLabel}/>
            <button className="forge-scene-button skin-change-button" onClick={()=>setPanel("scenes")}><Icon name="grid" size={16}/>Change skin</button>
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
            {source === "demo" && <><label className="forge-throttle">
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
                {hud.gear === 0
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
            </>}
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
              Browse {THEMES.length} skins <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="forge-scene-grid">
            {["road-66", "neon-drive", "alpine", "tie-fighter"].map(
              (id, index) => {
                const card = sceneForId(id);
                return (
                  <button
                    key={id}
                    className={`forge-scene-card ${theme.sceneId === id ? "selected" : ""}`}
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
                ? "Choose a skin"
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
                    "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
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
                <span className="forge-eyebrow">REVFORGE</span>
                <h2>
                  {panel === "scenes"
                    ? "Choose your instruments."
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
            {panel === "scenes" && <ThemePicker selected={themes.skinId} onSelect={(id)=>{themes.selectSkin(id);setPanel(null);}}/>}
            {panel === "garage" && (
              <div className="forge-garage-list">
                {options.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={audio.engineId === p.id}
                    onClick={() => {
                      onSelectEngine(p);
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
                <label>Demo mode<input aria-label="Demo mode" type="checkbox" checked={source==='demo'} onChange={e=>sourceChange(e.target.checked?'demo':'gps')}/></label>
                <p className="forge-control-hint">Turn Demo off to use browser GPS. Location permission is required.</p>
                <label>Idle jitter<input aria-label="Idle jitter" type="checkbox" checked={jitterEnabled} onChange={e=>setJitterEnabled(e.target.checked)}/></label><label>Idle jitter intensity · {Math.round(jitterAmount*100)}%<input aria-label="Idle jitter intensity" type="range" min="0" max="1" step=".01" disabled={!jitterEnabled} value={jitterAmount} onChange={e=>setJitterAmount(Number(e.target.value))}/></label><p className="forge-control-hint">Adds subtle RPM wander at idle. Fades out as you accelerate.</p>
                <p className="forge-control-hint">Tesla field test: media-button shifting and background audio did not work. Keep RevForge visible; use touch shifting or Automatic.</p><label>Experimental media-button controls<input type="checkbox" checked={mediaEnabled} onChange={e=>setMediaEnabled(e.target.checked)}/></label>
                <label>Play/pause button upshifts in Manual<input type="checkbox" checked={pauseShifts} onChange={e=>setPauseShifts(e.target.checked)}/></label>
                <p className="forge-control-hint">While playing in Manual: pause → upshift, next → upshift, previous → downshift. In Automatic, pause stops the engine. Touch Stop always stops.</p>
                <div className="compatibility-box"><h3>Tesla input check</h3><dl><dt>Location API</dt><dd>{typeof navigator!=='undefined'&&'geolocation' in navigator?'Available':'Unavailable'}</dd><dt>GPS status</dt><dd>{gps.status}</dd><dt>Position accuracy</dt><dd>{gps.accuracy===null?'No reading':`±${Math.round(gps.accuracy)} m`}</dd><dt>Speed reading</dt><dd>{gps.timestamp===null?'Not received':`${gps.mph.toFixed(1)} mph`}</dd><dt>Media handlers</dt><dd>{media.accepted.length}/4 registered</dd><dt>Media session</dt><dd>{media.carrier}</dd></dl><p className="input-check-log" role="status">{media.lastEvent}</p><button className="forge-text-button" disabled={!mediaEnabled || !audio.running} onClick={media.arm}>Enable controls / recheck</button><p>While parked, start the engine and press your media buttons. An event appearing here confirms delivery to this browser. Button registration alone does not mean Tesla delivers the event. GPS speed requires an actual location reading.</p></div>

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
