import { useCallback, useRef } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label?: string;
}

export function RevPad({ value, onChange, disabled, label = 'REV' }: Props) {
  const active = useRef(false);
  const el = useRef<HTMLDivElement>(null);

  const setFromEvent = useCallback(
    (clientY: number) => {
      const node = el.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const y = 1 - (clientY - rect.top) / rect.height;
      onChange(Math.min(1, Math.max(0, y)));
    },
    [onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    active.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromEvent(e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active.current) return;
    setFromEvent(e.clientY);
  };

  const onPointerUp = () => {
    active.current = false;
    onChange(0);
  };

  return (
    <div className="rev-pad-wrap">
      <div className="rev-pad-label">{label}</div>
      <div
        ref={el}
        className={`rev-pad ${disabled ? 'disabled' : ''}`}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-label="Throttle rev pad"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowUp') onChange(Math.min(1, value + 0.05));
          if (e.key === 'ArrowDown') onChange(Math.max(0, value - 0.05));
        }}
      >
        <div className="rev-pad-fill" style={{ height: `${value * 100}%` }} />
        <div className="rev-pad-hint">Hold</div>
      </div>
    </div>
  );
}
