import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge } from '../components/Gauge';
import { RevPad } from '../components/RevPad';
import { DriveSkinSlot, skinIdForEngine } from '../skins/DriveSkinSlot';
import { getBuiltin, mphToSpeed } from '../audio';
import type { EngineKind } from '../audio';
import type { useAudioEngine } from '../hooks/useAudioEngine';
import type { useGeolocation } from '../hooks/useGeolocation';
import type { UiPrefs } from '../hooks/useUiPrefs';
import {
  ION_LOCK_CHIP,
  type IonLockStage,
} from '../skins/ion-twin/lockLadder';

interface Props {
  audio: ReturnType<typeof useAudioEngine>;
  gps: ReturnType<typeof useGeolocation>;
  prefs: UiPrefs;
  onEnableGps: () => void;
}

const AUREBESH_KEY = 'drivesynth.ionTwin.aurebeshNumerals';
const AUREBESH_HINT_KEY = 'drivesynth.ionTwin.aurebeshHintUsed';

function loadBool(key: string, fallback = false): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true' || v === '1';
  } catch {
    return fallback;
  }
}

function resolveKind(engineId: string): EngineKind {
  const builtin = getBuiltin(engineId);
  if (builtin) return builtin.kind;
  if (engineId.includes('tie') || engineId.includes('scifi')) return 'scifi';
  if (engineId.includes('f14') || engineId.includes('aero')) return 'aerospace';
  if (engineId.includes('ev')) return 'ev-whine';
  return 'ice';
}

/** Glanceable one-word commentary chips — max 3. Prefer Audio driveMood. */
const MOOD_DISPLAY: Record<string, string> = {
  // CoS / future Audio tokens
  IDLE: 'IDLE',
  LOPE: 'LOPE',
  INTAKE: 'INTAKE',
  LOAD: 'LOAD',
  SPOOLING: 'SPOOLING',
  AB: 'AB ARMED',
  'AB ARMED': 'AB ARMED',
  REGEN: 'REGEN',
  LOCK: 'LOCK',
  // Current Audio EngineSynthImpl driveMood strings
  PULL: 'LOAD',
  CRUISE: 'LOAD',
};

function chipsFromDriveMood(mood: unknown): string[] | null {
  if (mood == null) return null;
  const raw: string[] = Array.isArray(mood)
    ? mood.map(String)
    : typeof mood === 'string'
      ? mood.split(/[|,+\s]+/).filter(Boolean)
      : [];
  if (raw.length === 0) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of raw) {
    const key = token.trim().toUpperCase();
    const label = MOOD_DISPLAY[key] ?? (key.length <= 12 ? key : null);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= 3) break;
  }
  return out.length ? out : null;
}

function pickCommentaryChips(opts: {
  kind: EngineKind;
  skinId: string;
  speedNorm: number;
  throttle: number;
  prevThrottle: number;
  rpmNorm: number;
  loadFeel: number;
  driveMood?: unknown;
  lockStage?: IonLockStage;
}): string[] {
  const fromAudio = chipsFromDriveMood(opts.driveMood);
  if (fromAudio) return fromAudio;

  const { kind, skinId, speedNorm, throttle, prevThrottle, rpmNorm, loadFeel, lockStage } = opts;
  const rising = throttle - prevThrottle > 0.02;
  const chips: string[] = [];

  const idle = speedNorm < 0.03 && throttle < 0.12;
  if (idle) chips.push('IDLE');

  if (kind === 'ice') {
    if (!idle && rpmNorm > 0.18 && rpmNorm < 0.55 && Math.abs(loadFeel) < 0.35) chips.push('LOPE');
    if (rising && throttle > 0.2) chips.push(throttle > 0.55 || loadFeel > 0.35 ? 'LOAD' : 'INTAKE');
    else if (!idle && (loadFeel > 0.4 || throttle > 0.6)) chips.push('LOAD');
  } else if (kind === 'aerospace') {
    if (rising || (rpmNorm > 0.25 && rpmNorm < 0.75 && throttle > 0.15 && throttle < 0.7)) {
      chips.push('SPOOLING');
    }
    if (throttle >= 0.72 || rpmNorm >= 0.85) chips.push('AB ARMED');
  } else if (kind === 'ev-whine') {
    if (speedNorm > 0.08 && throttle < 0.18 && !rising) chips.push('REGEN');
    else if (rising) chips.push('LOAD');
  } else if (kind === 'scifi' || skinId === 'ion-twin') {
    const chip = lockStage ? ION_LOCK_CHIP[lockStage] : null;
    if (chip) chips.push(chip);
    else if (rising) chips.push('INTAKE');
  }

  if (chips.length === 0 && !idle) {
    if (rising) chips.push(kind === 'aerospace' ? 'SPOOLING' : 'LOAD');
    else if (throttle > 0.45) chips.push('LOAD');
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chips) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length >= 3) break;
  }
  return out;
}

export function DrivePage({ audio, gps, prefs, onEnableGps }: Props) {
  const [manualSpeed, setManualSpeed] = useState(0);
  const [rev, setRev] = useState(0);
  const [useManual, setUseManual] = useState(false);
  const [hud, setHud] = useState({
    rpmNorm: 0,
    loadFeel: 0,
    fundamentalHz: 55,
    driveMood: undefined as unknown,
  });
  const [tabBackgrounded, setTabBackgrounded] = useState(false);
  const [gearMode, setGearMode] = useState<'auto' | 'manual'>('auto');
  const [accelFeel, setAccelFeel] = useState(0);
  const [chips, setChips] = useState<string[]>(['IDLE']);
  const [aurebeshOn, setAurebeshOn] = useState(() => loadBool(AUREBESH_KEY));
  const [hintUsed, setHintUsed] = useState(() => loadBool(AUREBESH_HINT_KEY));
  const prevMph = useRef(0);
  const throttleProxy = useRef(0);
  const prevThrottleRef = useRef(0);
  const lockStageRef = useRef<IonLockStage>('none');
  const [lockStage, setLockStage] = useState<IonLockStage>('none');
  const longPressTimer = useRef<number | null>(null);

  const skinId = skinIdForEngine(audio.engineId || prefs.selectedEngineId || 'v8-rumble');
  const isIonTwin = skinId === 'ion-twin';
  const useAurebesh = isIonTwin && aurebeshOn;

  useEffect(() => {
    audio.setLockSfxEnabled(!!prefs.ionTwinLockSfx);
  }, [audio, prefs.ionTwinLockSfx]);

  useEffect(() => {
    audio.setUpshiftSfxEnabled(!!prefs.upshiftSfx);
  }, [audio, prefs.upshiftSfx]);

  const numeralClass = useAurebesh ? 'aurebesh' : undefined;

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') setTabBackgrounded(true);
      else setTabBackgrounded(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Force Latin when leaving ion-twin; reset lock ladder off-skin
  useEffect(() => {
    if (!isIonTwin) {
      lockStageRef.current = 'none';
      setLockStage('none');
    }
  }, [isIonTwin]);

  const gpsActive = gps.status === 'live' && !useManual;
  const displayMph = gpsActive ? gps.mph : manualSpeed * 120;

  useEffect(() => {
    if (!gpsActive) return;
    const delta = gps.mph - prevMph.current;
    prevMph.current = gps.mph;
    const bump = Math.max(0, delta * 0.35);
    throttleProxy.current = Math.min(
      1,
      Math.max(0, throttleProxy.current * 0.82 + bump + (gps.mph > 1 ? 0.08 : 0)),
    );
  }, [gps.mph, gpsActive]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const speed = gpsActive ? mphToSpeed(gps.mph) : manualSpeed;
      const parked = speed < 0.03;
      const throttle = parked
        ? rev
        : Math.max(rev, gpsActive ? throttleProxy.current : rev);

      if (audio.running) {
        audio.setDriving({
          speed,
          throttle,
          load: throttle * 0.4 - 0.1,
          reverse: false,
        });
        const eng = audio.getEngine();
        let rpmNorm = 0;
        let loadFeel = 0;
        let driveMood: unknown;
        if (eng) {
          const h = eng.getHud() as {
            rpmNorm: number;
            loadFeel: number;
            fundamentalHz: number;
            driveMood?: unknown;
          };
          setHud({
            rpmNorm: h.rpmNorm,
            loadFeel: h.loadFeel,
            fundamentalHz: h.fundamentalHz,
            driveMood: h.driveMood,
          });
          rpmNorm = h.rpmNorm;
          loadFeel = h.loadFeel;
          driveMood = h.driveMood;
        }
        setAccelFeel(throttle);
        const engId = audio.engineId || 'v8-rumble';
        const frameSkin = skinIdForEngine(engId);
        // Soft-cue: poll getHud().lockStage (Audio owns hysteresis + optional lock chirp).
        let stage: IonLockStage = 'none';
        if (frameSkin === 'ion-twin' && eng) {
          const hLock = (eng.getHud() as { lockStage?: IonLockStage }).lockStage
            ?? eng.getLockStage?.()
            ?? 'none';
          stage = hLock;
          if (stage !== lockStageRef.current) {
            lockStageRef.current = stage;
            setLockStage(stage);
          }
        } else if (lockStageRef.current !== 'none') {
          lockStageRef.current = 'none';
          setLockStage('none');
        }
        const kind = resolveKind(engId);
        setChips(
          pickCommentaryChips({
            kind,
            skinId: frameSkin,
            speedNorm: speed,
            throttle,
            prevThrottle: prevThrottleRef.current,
            rpmNorm,
            loadFeel,
            driveMood,
            lockStage: frameSkin === 'ion-twin' ? stage : undefined,
          }),
        );
        prevThrottleRef.current = throttle;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio, gps.mph, gpsActive, manualSpeed, rev, prefs.ionTwinLockSfx]);

  const speedLabel = useMemo(() => {
    if (prefs.speedUnit === 'kph') {
      return `${Math.round(displayMph / 0.621371)}`;
    }
    return `${Math.round(displayMph)}`;
  }, [displayMph, prefs.speedUnit]);

  const unit = prefs.speedUnit === 'kph' ? 'km/h' : 'mph';
  const rpmReadout = `${Math.round(800 + hud.rpmNorm * 6200)}`;

  const flipAurebesh = () => {
    if (!isIonTwin) return;
    setAurebeshOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUREBESH_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    if (!hintUsed) {
      setHintUsed(true);
      try {
        localStorage.setItem(AUREBESH_HINT_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  };

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onSpeedPointerDown = () => {
    if (!isIonTwin) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      flipAurebesh();
    }, 550);
  };

  return (
    <div className="drive-page">
      {!audio.running && (
        <div className="audio-gate">
          <button
            type="button"
            className="start-btn"
            onClick={() => {
              void audio.start();
              onEnableGps();
            }}
          >
            Start / Resume Engine
          </button>
          <p className="gate-hint">Tap to unlock audio, then drag REV or raise Speed (turn off silent mode on iPhone).</p>
        </div>
      )}

      <div className="gps-strip">
        <GpsBadge status={gps.status} accuracy={gps.accuracy} onEnable={onEnableGps} />
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={useManual}
            onChange={(e) => setUseManual(e.target.checked)}
          />
          <span>Manual speed</span>
        </label>
      </div>

      {tabBackgrounded && (
        <div className="tab-warn" role="status">
          Tab was backgrounded — audio/GPS may have paused. Keep DriveSynth in the foreground.
        </div>
      )}

      <div className="hud-stage">
        <DriveSkinSlot
          engineId={audio.engineId || 'v8-rumble'}
          rpmNorm={hud.rpmNorm}
          speedNorm={gpsActive ? mphToSpeed(gps.mph) : manualSpeed}
          loadFeel={hud.loadFeel}
          throttle={accelFeel}
          lockStage={isIonTwin ? lockStage : undefined}
          lockSfxEnabled={prefs.ionTwinLockSfx}
        />
        <div className="gear-pills" role="group" aria-label="Gearbox">
          <button
            type="button"
            className={`gear-pill ${gearMode === 'auto' ? 'active' : ''}`}
            onClick={() => setGearMode('auto')}
          >
            AUTO
          </button>
          <button
            type="button"
            className={`gear-pill ${gearMode === 'manual' ? 'active' : ''}`}
            onClick={() => setGearMode('manual')}
          >
            MANUAL
          </button>
        </div>
        <div className="speed-hero">
          <div
            className={`speed-hero-value${numeralClass ? ` ${numeralClass}` : ''}`}
            onPointerDown={onSpeedPointerDown}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerCancel={clearLongPress}
            role={isIonTwin ? 'button' : undefined}
            aria-label={isIonTwin ? 'Speed — hold to flip Aurebesh numerals' : undefined}
          >
            {speedLabel}
          </div>
          <div className="speed-hero-unit">{unit}</div>
          {isIonTwin && !hintUsed && (
            <p className="aurebesh-hint">hold speed to flip glyphs</p>
          )}
          {isIonTwin && (
            <button
              type="button"
              className="aurebesh-toggle"
              onClick={flipAurebesh}
              aria-pressed={aurebeshOn}
              title="Toggle Aurebesh numerals"
            >
              {aurebeshOn ? 'AB' : '123'}
            </button>
          )}
        </div>

        {chips.length > 0 && (
          <div className="commentary-chips" aria-live="polite">
            {chips.map((c) => (
              <span key={c} className="commentary-chip glass">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="telemetry-strip">
          <div className="tele-cell">
            <div className={`tele-value${numeralClass ? ` ${numeralClass}` : ''}`}>
              {Math.round(hud.loadFeel * 100)}
            </div>
            <div className="tele-label">LOAD %</div>
          </div>
          <div className="tele-cell">
            <div className={`tele-value${numeralClass ? ` ${numeralClass}` : ''}`}>{rpmReadout}</div>
            <div className="tele-label">REVS</div>
          </div>
          <div className="tele-cell">
            <div className={`tele-value${numeralClass ? ` ${numeralClass}` : ''}`}>
              {Math.round(accelFeel * 100)}
            </div>
            <div className="tele-label">ACCEL</div>
          </div>
        </div>
        <div className="hud-secondary">
          <div className={useAurebesh ? 'aurebesh' : undefined}>
            <Gauge
              style={prefs.gaugeStyle}
              value={hud.rpmNorm}
              label="REVS"
              readout={rpmReadout}
            />
          </div>
          <div className="hud-rev">
            <RevPad value={rev} onChange={setRev} />
          </div>
        </div>
      </div>

      <div className="drive-controls">
        <label className="slider-block">
          <div className="slider-head">
            <span>Speed {gpsActive && !useManual ? '(GPS)' : '(manual)'}</span>
            <span>
              {speedLabel} {unit}
            </span>
          </div>
          <input
            className="big-slider"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={gpsActive && !useManual ? mphToSpeed(gps.mph) : manualSpeed}
            disabled={gpsActive && !useManual}
            onChange={(e) => {
              setUseManual(true);
              setManualSpeed(Number(e.target.value));
            }}
          />
        </label>
        <p className="safety-note">
          Entertainment only. Don&apos;t handle the screen while driving. GPS speed ≠ speedometer.
        </p>
      </div>
    </div>
  );
}

function GpsBadge({
  status,
  accuracy,
  onEnable,
}: {
  status: string;
  accuracy: number | null;
  onEnable: () => void;
}) {
  const map: Record<string, string> = {
    idle: 'GPS off',
    requesting: 'Requesting GPS…',
    waiting: 'Waiting for GPS…',
    live: accuracy != null ? `GPS live · ±${Math.round(accuracy)} m` : 'GPS live',
    denied: 'GPS denied — use manual',
    unavailable: 'GPS unavailable',
    error: 'GPS error',
  };
  return (
    <button type="button" className={`gps-badge status-${status}`} onClick={onEnable}>
      <span className="gps-dot" />
      {map[status] ?? status}
    </button>
  );
}
