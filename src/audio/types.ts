export type EngineId = string;

export type TopologyId = 'v8-rumble' | 'i4-zip' | 'ev-whine' | 'tie-fighter' | 'custom';

export type EngineKind = 'ice' | 'ev-whine' | 'scifi';

export interface DrivingInput {
  /** Normalized vehicle speed 0..1 */
  speed: number;
  /** Accelerator / regen 0..1 (parked Rev when speed≈0) */
  throttle: number;
  /** Load lean -1..1 */
  load?: number;
  reverse?: boolean;
}

export interface EngineParams {
  masterGain: number;
  stereoWidth: number;
  limiterCeiling: number;
  // ICE
  rpmIdle?: number;
  rpmRedline?: number;
  cylinders?: 4 | 6 | 8 | 10 | 12;
  roughness?: number;
  growl?: number;
  presence?: number;
  intake?: number;
  exhaust?: number;
  ignitionNoise?: number;
  muffling?: number;
  rpmCurve?: number;
  // Sci-fi
  corePitch?: number;
  pulseRate?: number;
  resonance?: number;
  noiseBody?: number;
  carrierBite?: number;
  doppler?: number;
  engineHowl?: number;
  afterburn?: number;
  hum?: number;
  // EV
  whinePitch?: number;
  gearSteps?: number;
  inverterBuzz?: number;
  [paramId: string]: number | string | undefined;
}

export interface SynthNodeDesc {
  id: string;
  type:
    | 'osc'
    | 'noise'
    | 'gain'
    | 'biquad'
    | 'waveshaper'
    | 'delay'
    | 'panner'
    | 'merge'
    | 'split'
    | 'constant';
  params: Record<string, number | string>;
  outs: Array<{ to: string; input?: number | string }>;
}

export interface EnginePatch {
  version: 0;
  id: EngineId;
  name: string;
  kind: EngineKind;
  topology: TopologyId;
  params: Record<string, number | string>;
  graph?: SynthNodeDesc[];
  meta?: { author?: string; createdAt?: string; tags?: string[]; blurb?: string };
}

export interface EngineSynth {
  readonly id: EngineId;
  readonly context: AudioContext;
  readonly output: GainNode;

  start(): Promise<void>;
  stop(): void;
  dispose(): void;

  setDriving(d: DrivingInput): void;
  setParams(p: Partial<EngineParams>): void;
  getParams(): EngineParams;

  toPatch(): EnginePatch;
  fromPatch(patch: EnginePatch): void;

  /** Derived HUD values for gauges */
  getHud(): { rpmNorm: number; loadFeel: number; fundamentalHz: number };
}

export interface ParamMeta {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  kind?: 'slider' | 'segmented';
  options?: number[];
}
