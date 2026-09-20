import './ice-v8.css';

interface Props {
  rpmNorm: number;
  speedNorm: number;
  throttle: number;
  loadFeel: number;
}

/** Warm analog ICE plate tokens — secondary chrome behind SPEED. */
export function IceV8Overlay({ rpmNorm, throttle }: Props) {
  const redline = rpmNorm > 0.88;
  return (
    <div
      className={`ice-v8-overlay${redline ? ' redline' : ''}`}
      style={{ ['--ice-rpm' as string]: String(rpmNorm), ['--ice-thr' as string]: String(throttle) }}
      aria-hidden
    >
      <div className="ice-v8-tacho" />
      <div className="ice-v8-satellites" />
    </div>
  );
}
