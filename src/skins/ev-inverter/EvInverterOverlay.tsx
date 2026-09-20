import './ev-inverter.css';

interface Props {
  rpmNorm: number;
  speedNorm: number;
  throttle: number;
  loadFeel: number;
}

/** EV inverter bay plate — regen mint when coasting. */
export function EvInverterOverlay({ rpmNorm, throttle, speedNorm }: Props) {
  const regen = speedNorm > 0.08 && throttle < 0.12;
  return (
    <div
      className={`ev-inverter-overlay${regen ? ' regen' : ''}`}
      style={{ ['--ev-rpm' as string]: String(rpmNorm), ['--ev-thr' as string]: String(throttle) }}
      aria-hidden
    >
      <div className="ev-bus" />
      <div className="ev-phases" />
    </div>
  );
}
