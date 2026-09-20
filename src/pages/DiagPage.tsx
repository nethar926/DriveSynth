import { useEffect, useState } from 'react';
import type { useAudioEngine } from '../hooks/useAudioEngine';
import type { useGeolocation } from '../hooks/useGeolocation';

interface Props {
  audio: ReturnType<typeof useAudioEngine>;
  gps: ReturnType<typeof useGeolocation>;
}

interface Snapshot {
  ua: string;
  dpr: number;
  innerW: number;
  innerH: number;
  geoStatus: string;
  geoAccuracy: string;
  geoFixAge: string;
  acState: string;
  sampleRate: string;
  baseLatency: string;
}

function readSnapshot(
  audio: Props['audio'],
  gps: Props['gps'],
): Snapshot {
  const eng = audio.getEngine();
  const ctx = eng?.context ?? audio.context.current;

  let geoFixAge = '—';
  if (gps.timestamp != null) {
    geoFixAge = `${Math.max(0, Date.now() - gps.timestamp)} ms`;
  }

  const baseLatency =
    ctx && typeof ctx.baseLatency === 'number' && Number.isFinite(ctx.baseLatency)
      ? `${(ctx.baseLatency * 1000).toFixed(1)} ms`
      : 'n/a';

  return {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio || 1,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    geoStatus: gps.status,
    geoAccuracy: gps.accuracy != null ? `±${Math.round(gps.accuracy)} m` : '—',
    geoFixAge,
    acState: ctx?.state ?? 'not started',
    sampleRate: ctx ? `${ctx.sampleRate} Hz` : '—',
    baseLatency,
  };
}

export function DiagPage({ audio, gps }: Props) {
  const [snap, setSnap] = useState<Snapshot>(() => readSnapshot(audio, gps));

  useEffect(() => {
    const tick = () => setSnap(readSnapshot(audio, gps));
    tick();
    const id = window.setInterval(tick, 500);
    const onResize = () => tick();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', onResize);
    };
  }, [audio, gps]);

  const rows: Array<{ label: string; value: string }> = [
    { label: 'UA', value: snap.ua },
    { label: 'DPR', value: String(snap.dpr) },
    { label: 'Viewport', value: `${snap.innerW}×${snap.innerH}` },
    { label: 'Geo status', value: snap.geoStatus },
    { label: 'Geo accuracy', value: snap.geoAccuracy },
    { label: 'Geo fix age', value: snap.geoFixAge },
    { label: 'AudioContext.state', value: snap.acState },
    { label: 'sampleRate', value: snap.sampleRate },
    { label: 'baseLatency', value: snap.baseLatency },
  ];

  return (
    <div className="diag-page">
      <h1 className="page-title">Diagnostics</h1>
      <p className="page-blurb">
        Parked Tesla Chromium checks for audio unlock and viewport quirks. Not needed while driving.
      </p>
      <dl className="diag-grid">
        {rows.map((r) => (
          <div key={r.label} className="diag-row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
