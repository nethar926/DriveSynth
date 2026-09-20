import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge } from '../components/Gauge';
import { RevPad } from '../components/RevPad';
import { mphToSpeed } from '../audio';
import type { useAudioEngine } from '../hooks/useAudioEngine';
import type { useGeolocation } from '../hooks/useGeolocation';
import type { UiPrefs } from '../hooks/useUiPrefs';

interface Props {
  audio: ReturnType<typeof useAudioEngine>;
  gps: ReturnType<typeof useGeolocation>;
  prefs: UiPrefs;
  onEnableGps: () => void;
}

export function DrivePage({ audio, gps, prefs, onEnableGps }: Props) {
  const [manualSpeed, setManualSpeed] = useState(0);
  const [rev, setRev] = useState(0);
  const [useManual, setUseManual] = useState(false);
  const [hud, setHud] = useState({ rpmNorm: 0, loadFeel: 0, fundamentalHz: 55 });
  const [tabBackgrounded, setTabBackgrounded] = useState(false);
  const prevMph = useRef(0);
  const throttleProxy = useRef(0);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') setTabBackgrounded(true);
      else setTabBackgrounded(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const gpsActive = gps.status === 'live' && !useManual;
  const displayMph = gpsActive ? gps.mph : manualSpeed * 120;

  // Δspeed → throttle proxy when GPS live
  useEffect(() => {
    if (!gpsActive) return;
    const delta = gps.mph - prevMph.current;
    prevMph.current = gps.mph;
    // positive accel bumps throttle; coast decays
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
        if (eng) setHud(eng.getHud());
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio, gps.mph, gpsActive, manualSpeed, rev]);

  const speedLabel = useMemo(() => {
    if (prefs.speedUnit === 'kph') {
      return `${Math.round(displayMph / 0.621371)}`;
    }
    return `${Math.round(displayMph)}`;
  }, [displayMph, prefs.speedUnit]);

  const unit = prefs.speedUnit === 'kph' ? 'km/h' : 'mph';
  const rpmReadout = `${Math.round(800 + hud.rpmNorm * 6200)}`;

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

      <div className="hud-grid">
        <div className="hud-primary">
          <Gauge
            style={prefs.gaugeStyle}
            value={hud.rpmNorm}
            label="REVS"
            readout={rpmReadout}
          />
        </div>
        <div className="hud-side">
          <div className="stat-card">
            <div className="stat-value">{speedLabel}</div>
            <div className="stat-label">{unit}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Math.round(hud.loadFeel * 100)}</div>
            <div className="stat-label">LOAD %</div>
          </div>
          <div className="stat-card dim">
            <div className="stat-value-sm">{Math.round(hud.fundamentalHz)} Hz</div>
            <div className="stat-label">FUND</div>
          </div>
        </div>
        <div className="hud-rev">
          <RevPad value={rev} onChange={setRev} />
        </div>
      </div>

      <div className="drive-controls">
        <label className="slider-block">
          <div className="slider-head">
            <span>Speed {gpsActive && !useManual ? '(GPS)' : '(manual)'}</span>
            <span>{speedLabel} {unit}</span>
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
