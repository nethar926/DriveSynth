export type EngineId = string;

export type TopologyId =
  | 'v8-rumble'
  | 'i4-zip'
  | 'ev-whine'
  | 'tie-fighter'
  | 'aerospace-f14'
  | 'custom';

/** Pack / builder categories. Old kinds map 1:1 (ice, ev-whine, scifi); aerospace is new. */
export type EngineKind = 'ice' | 'ev-whine' | 'aerospace' | 'scifi';

export type IceMode = 'worklet' | 'osc' | 'n/a';

export interface EngineDiag {
  /** AudioContext.state */
  contextState: AudioContextState | string;
  /** ICE synthesis path; 'n/a' for non-ICE packs */
  iceMode: IceMode;
  /** True after start() until stop()/dispose() */
  running: boolean;
  engineId: EngineId;
  /** Present when AudioWorklet load/init failed */
  workletError?: string;
}

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
  /** Pulse width 0..1 (worklet ICE) */
  pulseWidth?: number;
  /** Combustion timing jitter 0..1 */
  pulseJitter?: number;
  /** Exhaust waveguide length 0..1 */
  exhaustLength?: number;
  /** Waveguide feedback 0..1 */
  exhaustFeedback?: number;
  /** Overrun crackle amount 0..1 */
  crackle?: number;
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
  /** Multi-formant howl intensity 0..1 */
  formantHowl?: number;
  /** Wet-road hiss layer 0..1 */
  wetHiss?: number;
  /** Formant sweep rate / spread 0..1 */
  formantSpread?: number;
  // EV
  whinePitch?: number;
  gearSteps?: number;
  inverterBuzz?: number;
  // Aerospace / jet
  /** Spool / N1 base pitch Hz */
  spoolPitch?: number;
  /** Intake whine level 0..1 */
  intakeWhine?: number;
  /** Compressor stage level 0..1 */
  compressor?: number;
  /** Turbine / N2 layer 0..1 */
  turbine?: number;
  /** Jet roar / exhaust noise body 0..1 */
  jetRoar?: number;
  /** Throttle-linked scream 0..1 */
  jetScream?: number;
  /** Idle spool presence at speed≈0 0..1 */
  idleSpool?: number;
  [paramId: string]: number | string | undefined;
}

export type SynthNodeType =
  | 'osc'
  | 'noise'
  | 'gain'
  | 'biquad'
  | 'waveshaper'
  | 'delay'
  | 'panner'
  | 'merge'
  | 'split'
  | 'constant'
  | 'PulseTrain'
  | 'ExhaustWaveguide'
  | 'IntakeNoise'
  | 'Mechanical'
  | 'FormantHowl'
  | 'WetRoadNoise'
  | 'TurbineSpool'
  | 'IntakeWhine'
  | 'Afterburner'
  | 'CompressorStage'
  | 'Filter'
  | 'Gain'
  | 'Mix'
  | 'Osc'
  | 'Noise';

export interface SynthNodeDesc {
  id: string;
  type: SynthNodeType;
  params: Record<string, number | string>;
  outs: Array<{ to: string; input?: number | string }>;
  /** Builder canvas position */
  x?: number;
  y?: number;
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

  /** Map builder node graph onto live params (v1). */
  applyGraphToParams?(graph: SynthNodeDesc[]): void;

  /** Derived HUD values for gauges */
  getHud(): { rpmNorm: number; loadFeel: number; fundamentalHz: number };

  /** Frontend /diag snapshot — field names stable for iceMode consumers */
  getDiag(): EngineDiag;
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
