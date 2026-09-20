import type { EngineKind, EnginePatch, EngineParams, ParamMeta } from './types';

export const V8_DEFAULTS: EngineParams = {
  masterGain: 0.7,
  stereoWidth: 0.42,
  limiterCeiling: 0.95,
  rpmIdle: 48,
  rpmRedline: 248,
  cylinders: 8,
  roughness: 0.58,
  growl: 0.68,
  presence: 0.42,
  intake: 0.62,
  exhaust: 0.72,
  ignitionNoise: 0.22,
  muffling: 0.38,
  rpmCurve: 0.58,
  pulseWidth: 0.44,
  pulseJitter: 0.16,
  exhaustLength: 0.58,
  exhaustFeedback: 0.74,
  crackle: 0.36,
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
  spoolPitch: 88,
  intakeWhine: 0.48,
  compressor: 0.72,
  turbine: 0.74,
  jetRoar: 0.7,
  afterburn: 0.8,
  jetScream: 0.42,
  idleSpool: 0.58,
  spoolInertia: 0.64,
  airframe: 0.55,
  rpmCurve: 0.52,
};

export const I6_DEFAULTS: EngineParams = {
  masterGain: 0.68,
  stereoWidth: 0.32,
  limiterCeiling: 0.95,
  rpmIdle: 62,
  rpmRedline: 280,
  cylinders: 6,
  roughness: 0.18,
  growl: 0.38,
  presence: 0.52,
  intake: 0.48,
  exhaust: 0.55,
  ignitionNoise: 0.14,
  muffling: 0.28,
  rpmCurve: 0.5,
  pulseWidth: 0.36,
  pulseJitter: 0.05,
  exhaustLength: 0.42,
  exhaustFeedback: 0.7,
  crackle: 0.18,
};

export const EV_CLIMB_DEFAULTS: EngineParams = {
  masterGain: 0.68,
  stereoWidth: 0.38,
  limiterCeiling: 0.95,
  whinePitch: 220,
  gearSteps: 0.55,
  inverterBuzz: 0.48,
  presence: 0.62,
  muffling: 0.18,
  rpmCurve: 0.42,
  gearMesh: 0.55,
};

export const EV_REGEN_DEFAULTS: EngineParams = {
  masterGain: 0.66,
  stereoWidth: 0.36,
  limiterCeiling: 0.95,
  whinePitch: 320,
  gearSteps: 0.2,
  inverterBuzz: 0.28,
  presence: 0.58,
  muffling: 0.22,
  rpmCurve: 0.38,
  regenHowl: 0.78,
};

export const EV_DUAL_DEFAULTS: EngineParams = {
  masterGain: 0.7,
  stereoWidth: 0.72,
  limiterCeiling: 0.95,
  whinePitch: 160,
  gearSteps: 0.4,
  inverterBuzz: 0.42,
  presence: 0.55,
  muffling: 0.2,
  rpmCurve: 0.45,
  dualBeat: 0.68,
  motorRoar: 0.72,
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
        'Organic V8: soft combustion pulses + mechanical bed + intake + exhaust waveguide body. Cross-plane 180/90/180/270 bank lope; throttle opens character, not just pitch.',
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
    id: 'i6-silk',
    name: 'I6 Silk',
    kind: 'ice',
    topology: 'i6-silk',
    params: { ...I6_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb:
        'Straight-six silk: even-fire organic pulses on the V8 path — smoother lope, softer roughness, refined waveguide body.',
      tags: ['ice', 'i6', 'pulse', 'free'],
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
    id: 'ev-inverter-climb',
    name: 'Inverter Climb',
    kind: 'ev-whine',
    topology: 'ev-inverter-climb',
    params: { ...EV_CLIMB_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb:
        'Ascending inverter whine with stepped gear mesh — climbs with speed/throttle. Original procedural EV — no samples.',
      tags: ['ev', 'inverter', 'gear', 'free'],
      author: 'DriveSynth',
    },
  },
  {
    version: 0,
    id: 'ev-regen-howl',
    name: 'Regen Howl',
    kind: 'ev-whine',
    topology: 'ev-regen-howl',
    params: { ...EV_REGEN_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb:
        'High whistle that blooms on decel: speed high + throttle drop opens regen howl. Original procedural EV — no samples.',
      tags: ['ev', 'regen', 'decel', 'free'],
      author: 'DriveSynth',
    },
  },
  {
    version: 0,
    id: 'ev-dual-motor',
    name: 'Dual Motor',
    kind: 'ev-whine',
    topology: 'ev-dual-motor',
    params: { ...EV_DUAL_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb:
        'Split L/R inverter beat under dense mid motor roar — Plaid-class mood, fully original synthesis.',
      tags: ['ev', 'dual-motor', 'roar', 'free'],
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
        'Organic Harrier-class jet: spool/compressor noise + buried whine, dense core roar, wet AB morph, airframe buffet. Spool inertia lags throttle — no laser scream. Original synthesis — no samples.',
      tags: ['aerospace', 'jet', 'twin-spool', 'organic', 'free'],
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
    case 'i6-silk':
      return { ...I6_DEFAULTS };
    case 'ev-whine':
      return { ...EV_DEFAULTS };
    case 'ev-inverter-climb':
      return { ...EV_CLIMB_DEFAULTS };
    case 'ev-regen-howl':
      return { ...EV_REGEN_DEFAULTS };
    case 'ev-dual-motor':
      return { ...EV_DUAL_DEFAULTS };
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
      { id: 'gearMesh', label: 'Gear Mesh', min: 0, max: 1, step: 0.01 },
      { id: 'regenHowl', label: 'Regen Howl', min: 0, max: 1, step: 0.01 },
      { id: 'dualBeat', label: 'Dual Beat', min: 0, max: 1, step: 0.01 },
      { id: 'motorRoar', label: 'Motor Roar', min: 0, max: 1, step: 0.01 },
      { id: 'rpmCurve', label: 'Speed Curve', min: 0, max: 1, step: 0.01 },
    ];
  }

  if (kind === 'aerospace') {
    return [
      ...master,
      { id: 'spoolPitch', label: 'Spool Hz', min: 40, max: 280, step: 1, unit: 'Hz' },
      { id: 'intakeWhine', label: 'Whine', min: 0, max: 1, step: 0.01 },
      { id: 'compressor', label: 'Compressor', min: 0, max: 1, step: 0.01 },
      { id: 'turbine', label: 'Core Roar', min: 0, max: 1, step: 0.01 },
      { id: 'jetRoar', label: 'Exhaust', min: 0, max: 1, step: 0.01 },
      { id: 'afterburn', label: 'Afterburner', min: 0, max: 1, step: 0.01 },
      { id: 'jetScream', label: 'Nozzle Hiss', min: 0, max: 1, step: 0.01 },
      { id: 'idleSpool', label: 'Idle Spool', min: 0, max: 1, step: 0.01 },
      { id: 'spoolInertia', label: 'Spool Inertia', min: 0, max: 1, step: 0.01 },
      { id: 'airframe', label: 'Airframe', min: 0, max: 1, step: 0.01 },
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
        { id: 'jetScream', label: 'Nozzle Hiss', min: 0, max: 1, step: 0.01 },
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
