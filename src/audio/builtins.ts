import type { EngineKind, EnginePatch, EngineParams, ParamMeta } from './types';

export const V8_DEFAULTS: EngineParams = {
  masterGain: 0.72,
  stereoWidth: 0.4,
  limiterCeiling: 0.95,
  rpmIdle: 52,
  rpmRedline: 255,
  cylinders: 8,
  roughness: 0.48,
  growl: 0.72,
  presence: 0.48,
  intake: 0.52,
  exhaust: 0.62,
  ignitionNoise: 0.28,
  muffling: 0.32,
  rpmCurve: 0.62,
  pulseWidth: 0.38,
  pulseJitter: 0.12,
  exhaustLength: 0.52,
  exhaustFeedback: 0.78,
  crackle: 0.4,
};

export const I4_DEFAULTS: EngineParams = {
  masterGain: 0.68,
  stereoWidth: 0.28,
  limiterCeiling: 0.95,
  rpmIdle: 70,
  rpmRedline: 320,
  cylinders: 4,
  roughness: 0.22,
  growl: 0.28,
  presence: 0.62,
  intake: 0.5,
  exhaust: 0.35,
  ignitionNoise: 0.2,
  muffling: 0.22,
  rpmCurve: 0.48,
  pulseWidth: 0.28,
  pulseJitter: 0.06,
  exhaustLength: 0.32,
  exhaustFeedback: 0.68,
  crackle: 0.22,
};

export const EV_DEFAULTS: EngineParams = {
  masterGain: 0.65,
  stereoWidth: 0.4,
  limiterCeiling: 0.95,
  whinePitch: 180,
  gearSteps: 0.35,
  inverterBuzz: 0.4,
  presence: 0.55,
  muffling: 0.2,
  rpmCurve: 0.4,
};

export const TIE_DEFAULTS: EngineParams = {
  masterGain: 0.7,
  stereoWidth: 0.58,
  limiterCeiling: 0.95,
  corePitch: 110,
  pulseRate: 0.48,
  resonance: 0.68,
  noiseBody: 0.48,
  carrierBite: 0.42,
  doppler: 0.4,
  engineHowl: 0.62,
  afterburn: 0.52,
  hum: 0.4,
  formantHowl: 0.72,
  wetHiss: 0.55,
  formantSpread: 0.58,
};

export const F14_DEFAULTS: EngineParams = {
  masterGain: 0.74,
  stereoWidth: 0.62,
  limiterCeiling: 0.95,
  spoolPitch: 95,
  intakeWhine: 0.58,
  compressor: 0.62,
  turbine: 0.7,
  jetRoar: 0.68,
  afterburn: 0.78,
  jetScream: 0.65,
  idleSpool: 0.55,
  rpmCurve: 0.52,
};

export const BUILTIN_PATCHES: EnginePatch[] = [
  {
    version: 0,
    id: 'v8-rumble',
    name: 'V8 Rumble',
    kind: 'ice',
    topology: 'v8-rumble',
    params: { ...V8_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb:
        'Pulse-train V8: discrete combustion fires → Karplus–Strong exhaust waveguide, cross-plane lope, intake whoosh, overrun crackle.',
      tags: ['ice', 'v8', 'pulse', 'free'],
      author: 'DriveSynth',
    },
  },
  {
    version: 0,
    id: 'i4-zip',
    name: 'I4 Zip',
    kind: 'ice',
    topology: 'i4-zip',
    params: { ...I4_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb: 'Even-fire four: tighter pulses, higher idle, snappier waveguide — all procedural.',
      tags: ['ice', 'i4', 'pulse', 'free'],
      author: 'DriveSynth',
    },
  },
  {
    version: 0,
    id: 'ev-whine',
    name: 'EV Whine',
    kind: 'ev-whine',
    topology: 'ev-whine',
    params: { ...EV_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb: 'Inverter whine stack with subtle gear-step color.',
      tags: ['ev', 'whine', 'free'],
      author: 'DriveSynth',
    },
  },
  {
    version: 0,
    id: 'aerospace-f14',
    name: 'Carrier Jet',
    kind: 'aerospace',
    topology: 'aerospace-f14',
    params: { ...F14_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb:
        'Twin-spool jet: intake whine, compressor/turbine layers, afterburner roar, throttle-linked scream. Original synthesis — no samples.',
      tags: ['aerospace', 'jet', 'twin-spool', 'free'],
      author: 'DriveSynth',
    },
  },
  {
    version: 0,
    id: 'tie-fighter',
    name: 'Ion Twin',
    kind: 'scifi',
    topology: 'tie-fighter',
    params: { ...TIE_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb:
        'Twin-ion pulsed carriers + multi-formant scream + wet-road hiss. Original synthesis only — no samples.',
      tags: ['scifi', 'ion', 'formant', 'free'],
      author: 'DriveSynth',
    },
  },
];

export function defaultsForTopology(topology: string): EngineParams {
  switch (topology) {
    case 'i4-zip':
      return { ...I4_DEFAULTS };
    case 'ev-whine':
      return { ...EV_DEFAULTS };
    case 'tie-fighter':
      return { ...TIE_DEFAULTS };
    case 'aerospace-f14':
      return { ...F14_DEFAULTS };
    case 'v8-rumble':
    default:
      return { ...V8_DEFAULTS };
  }
}

export function defaultsForKind(kind: EngineKind): EngineParams {
  switch (kind) {
    case 'ev-whine':
      return { ...EV_DEFAULTS };
    case 'aerospace':
      return { ...F14_DEFAULTS };
    case 'scifi':
      return { ...TIE_DEFAULTS };
    case 'ice':
    default:
      return { ...V8_DEFAULTS };
  }
}

/** Default builtin id when switching builder category tabs */
export function defaultPatchIdForKind(kind: EngineKind): string {
  switch (kind) {
    case 'ev-whine':
      return 'ev-whine';
    case 'aerospace':
      return 'aerospace-f14';
    case 'scifi':
      return 'tie-fighter';
    case 'ice':
    default:
      return 'v8-rumble';
  }
}

export function paramMetaForKind(kind: EnginePatch['kind']): ParamMeta[] {
  const master: ParamMeta[] = [
    { id: 'masterGain', label: 'Master', min: 0, max: 1, step: 0.01 },
    { id: 'stereoWidth', label: 'Width', min: 0, max: 1, step: 0.01 },
  ];

  if (kind === 'ice') {
    return [
      ...master,
      { id: 'rpmIdle', label: 'Idle Hz', min: 30, max: 120, step: 1, unit: 'Hz' },
      { id: 'rpmRedline', label: 'Redline Hz', min: 120, max: 400, step: 1, unit: 'Hz' },
      {
        id: 'cylinders',
        label: 'Cylinders',
        min: 4,
        max: 12,
        kind: 'segmented',
        options: [4, 6, 8, 10, 12],
      },
      { id: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.01 },
      { id: 'growl', label: 'Growl', min: 0, max: 1, step: 0.01 },
      { id: 'presence', label: 'Presence', min: 0, max: 1, step: 0.01 },
      { id: 'intake', label: 'Intake', min: 0, max: 1, step: 0.01 },
      { id: 'exhaust', label: 'Exhaust', min: 0, max: 1, step: 0.01 },
      { id: 'ignitionNoise', label: 'Ignition', min: 0, max: 1, step: 0.01 },
      { id: 'muffling', label: 'Muffling', min: 0, max: 1, step: 0.01 },
      { id: 'pulseWidth', label: 'Pulse Width', min: 0.05, max: 1, step: 0.01 },
      { id: 'pulseJitter', label: 'Pulse Jitter', min: 0, max: 0.5, step: 0.01 },
      { id: 'exhaustLength', label: 'Pipe Length', min: 0.05, max: 1, step: 0.01 },
      { id: 'exhaustFeedback', label: 'Pipe Feedback', min: 0.1, max: 0.97, step: 0.01 },
      { id: 'crackle', label: 'Crackle', min: 0, max: 1, step: 0.01 },
      { id: 'rpmCurve', label: 'RPM Curve', min: 0, max: 1, step: 0.01 },
    ];
  }

  if (kind === 'ev-whine') {
    return [
      ...master,
      { id: 'whinePitch', label: 'Whine Hz', min: 60, max: 600, step: 1, unit: 'Hz' },
      { id: 'gearSteps', label: 'Gear Steps', min: 0, max: 1, step: 0.01 },
      { id: 'inverterBuzz', label: 'Inverter', min: 0, max: 1, step: 0.01 },
      { id: 'presence', label: 'Presence', min: 0, max: 1, step: 0.01 },
      { id: 'muffling', label: 'Muffling', min: 0, max: 1, step: 0.01 },
      { id: 'rpmCurve', label: 'Speed Curve', min: 0, max: 1, step: 0.01 },
    ];
  }

  if (kind === 'aerospace') {
    return [
      ...master,
      { id: 'spoolPitch', label: 'Spool Hz', min: 40, max: 280, step: 1, unit: 'Hz' },
      { id: 'intakeWhine', label: 'Intake Whine', min: 0, max: 1, step: 0.01 },
      { id: 'compressor', label: 'Compressor', min: 0, max: 1, step: 0.01 },
      { id: 'turbine', label: 'Turbine', min: 0, max: 1, step: 0.01 },
      { id: 'jetRoar', label: 'Jet Roar', min: 0, max: 1, step: 0.01 },
      { id: 'afterburn', label: 'Afterburner', min: 0, max: 1, step: 0.01 },
      { id: 'jetScream', label: 'Scream', min: 0, max: 1, step: 0.01 },
      { id: 'idleSpool', label: 'Idle Spool', min: 0, max: 1, step: 0.01 },
      { id: 'rpmCurve', label: 'Spool Curve', min: 0, max: 1, step: 0.01 },
    ];
  }

  return [
    ...master,
    { id: 'corePitch', label: 'Core Hz', min: 40, max: 400, step: 1, unit: 'Hz' },
    { id: 'pulseRate', label: 'Pulse', min: 0, max: 1, step: 0.01 },
    { id: 'resonance', label: 'Resonance', min: 0, max: 1, step: 0.01 },
    { id: 'noiseBody', label: 'Noise Body', min: 0, max: 1, step: 0.01 },
    { id: 'carrierBite', label: 'Carrier Bite', min: 0, max: 1, step: 0.01 },
    { id: 'doppler', label: 'Doppler', min: 0, max: 1, step: 0.01 },
    { id: 'engineHowl', label: 'Howl', min: 0, max: 1, step: 0.01 },
    { id: 'formantHowl', label: 'Formant Howl', min: 0, max: 1, step: 0.01 },
    { id: 'formantSpread', label: 'Formant Spread', min: 0, max: 1, step: 0.01 },
    { id: 'wetHiss', label: 'Wet Hiss', min: 0, max: 1, step: 0.01 },
    { id: 'afterburn', label: 'Afterburn', min: 0, max: 1, step: 0.01 },
    { id: 'hum', label: 'Idle Hum', min: 0, max: 1, step: 0.01 },
  ];
}

export function getBuiltin(id: string): EnginePatch | undefined {
  return BUILTIN_PATCHES.find((p) => p.id === id);
}

/** Param metas for builder graph node types */
export function paramMetaForNodeType(type: string): ParamMeta[] {
  switch (type) {
    case 'PulseTrain':
      return [
        { id: 'cylinders', label: 'Cylinders', min: 4, max: 12, kind: 'segmented', options: [4, 6, 8, 10, 12] },
        { id: 'pulseWidth', label: 'Width', min: 0.05, max: 1, step: 0.01 },
        { id: 'pulseJitter', label: 'Jitter', min: 0, max: 0.5, step: 0.01 },
        { id: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.01 },
      ];
    case 'ExhaustWaveguide':
      return [
        { id: 'exhaustLength', label: 'Length', min: 0.05, max: 1, step: 0.01 },
        { id: 'exhaustFeedback', label: 'Feedback', min: 0.1, max: 0.97, step: 0.01 },
        { id: 'muffling', label: 'Muffler', min: 0, max: 1, step: 0.01 },
        { id: 'growl', label: 'Growl', min: 0, max: 1, step: 0.01 },
      ];
    case 'IntakeNoise':
      return [{ id: 'intake', label: 'Amount', min: 0, max: 1, step: 0.01 }];
    case 'Mechanical':
      return [{ id: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.01 }];
    case 'FormantHowl':
      return [
        { id: 'formantHowl', label: 'Amount', min: 0, max: 1, step: 0.01 },
        { id: 'formantSpread', label: 'Spread', min: 0, max: 1, step: 0.01 },
        { id: 'resonance', label: 'Q', min: 0, max: 1, step: 0.01 },
      ];
    case 'WetRoadNoise':
      return [
        { id: 'wetHiss', label: 'Amount', min: 0, max: 1, step: 0.01 },
        { id: 'doppler', label: 'Smear', min: 0, max: 1, step: 0.01 },
      ];
    case 'TurbineSpool':
      return [
        { id: 'spoolPitch', label: 'Spool Hz', min: 40, max: 280, step: 1, unit: 'Hz' },
        { id: 'turbine', label: 'Turbine', min: 0, max: 1, step: 0.01 },
        { id: 'idleSpool', label: 'Idle', min: 0, max: 1, step: 0.01 },
      ];
    case 'IntakeWhine':
      return [{ id: 'intakeWhine', label: 'Amount', min: 0, max: 1, step: 0.01 }];
    case 'Afterburner':
      return [
        { id: 'afterburn', label: 'Afterburn', min: 0, max: 1, step: 0.01 },
        { id: 'jetScream', label: 'Scream', min: 0, max: 1, step: 0.01 },
      ];
    case 'CompressorStage':
      return [
        { id: 'compressor', label: 'Compressor', min: 0, max: 1, step: 0.01 },
        { id: 'jetRoar', label: 'Roar', min: 0, max: 1, step: 0.01 },
      ];
    case 'Filter':
    case 'biquad':
      return [
        { id: 'frequency', label: 'Freq', min: 80, max: 8000, step: 1, unit: 'Hz' },
        { id: 'Q', label: 'Q', min: 0.1, max: 18, step: 0.1 },
        { id: 'gain', label: 'Gain dB', min: -24, max: 24, step: 0.5 },
      ];
    case 'Gain':
    case 'gain':
      return [{ id: 'gain', label: 'Gain', min: 0, max: 2, step: 0.01 }];
    case 'Mix':
    case 'merge':
      return [{ id: 'gain', label: 'Mix', min: 0, max: 1, step: 0.01 }];
    case 'Osc':
    case 'osc':
      return [
        { id: 'frequency', label: 'Freq', min: 20, max: 2000, step: 1, unit: 'Hz' },
        { id: 'detune', label: 'Detune', min: -100, max: 100, step: 1 },
      ];
    case 'Noise':
    case 'noise':
      return [{ id: 'gain', label: 'Level', min: 0, max: 1, step: 0.01 }];
    default:
      return [{ id: 'gain', label: 'Gain', min: 0, max: 1, step: 0.01 }];
  }
}
