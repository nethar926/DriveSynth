export function clamp(n: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite smoothstep between edges (clamped). */
export function smoothstep(x: number, edge0: number, edge1: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Ease-in curve controlled by c (0=linear, 1=aggressive) */
export function rpmCurve(speed: number, c = 0.55): number {
  const s = clamp(speed);
  const exp = 1 + c * 1.8;
  return Math.pow(s, exp);
}

export function mphToSpeed(mph: number, maxMph = 120): number {
  if (!Number.isFinite(mph) || mph <= 0) return 0;
  return clamp(mph / maxMph);
}

export function kphToMph(kph: number): number {
  return kph * 0.621371;
}

export function smooth(param: AudioParam, value: number, timeConstant = 0.05, ctx?: AudioContext): void {
  const t = ctx?.currentTime ?? 0;
  try {
    param.cancelScheduledValues(t);
    param.setTargetAtTime(value, t, timeConstant);
  } catch {
    param.value = value;
  }
}

export function createNoiseBuffer(ctx: AudioContext, seconds = 2, pink = false): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (!pink) {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buf;
}

export function makeShaper(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(n);
  const k = Math.max(0.001, amount * 40);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve as Float32Array<ArrayBuffer>;
}
