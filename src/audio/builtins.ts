import type { EnginePatch, EngineParams, ParamMeta } from './types';

export const V8_DEFAULTS: EngineParams = {
  masterGain: 0.72,
  stereoWidth: 0.35,
  limiterCeiling: 0.95,
  rpmIdle: 55,
  rpmRedline: 240,
  cylinders: 8,
  roughness: 0.38,
  growl: 0.62,
  presence: 0.48,
  intake: 0.42,
  exhaust: 0.55,
  ignitionNoise: 0.28,
  muffling: 0.28,
  rpmCurve: 0.58,
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
  stereoWidth: 0.55,
  limiterCeiling: 0.95,
  corePitch: 110,
  pulseRate: 0.48,
  resonance: 0.62,
  noiseBody: 0.55,
  carrierBite: 0.42,
  doppler: 0.38,
  engineHowl: 0.58,
  afterburn: 0.52,
  hum: 0.42,
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
      blurb: 'Deep cross-plane growl with intake whoosh and exhaust boom.',
      tags: ['ice', 'v8', 'free'],
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
      blurb: 'Lighter four-cylinder zip — higher idle, more presence.',
      tags: ['ice', 'i4', 'free'],
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
    id: 'tie-fighter',
    name: 'Ion Twin',
    kind: 'scifi',
    topology: 'tie-fighter',
    params: { ...TIE_DEFAULTS } as Record<string, number | string>,
    meta: {
      blurb: 'Procedural twin-ion roar + scream. Original synthesis only — no samples.',
      tags: ['scifi', 'ion', 'free'],
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
    case 'v8-rumble':
    default:
      return { ...V8_DEFAULTS };
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

  return [
    ...master,
    { id: 'corePitch', label: 'Core Hz', min: 40, max: 400, step: 1, unit: 'Hz' },
    { id: 'pulseRate', label: 'Pulse', min: 0, max: 1, step: 0.01 },
    { id: 'resonance', label: 'Resonance', min: 0, max: 1, step: 0.01 },
    { id: 'noiseBody', label: 'Noise Body', min: 0, max: 1, step: 0.01 },
    { id: 'carrierBite', label: 'Carrier Bite', min: 0, max: 1, step: 0.01 },
    { id: 'doppler', label: 'Doppler', min: 0, max: 1, step: 0.01 },
    { id: 'engineHowl', label: 'Howl', min: 0, max: 1, step: 0.01 },
    { id: 'afterburn', label: 'Afterburn', min: 0, max: 1, step: 0.01 },
    { id: 'hum', label: 'Idle Hum', min: 0, max: 1, step: 0.01 },
  ];
}

export function getBuiltin(id: string): EnginePatch | undefined {
  return BUILTIN_PATCHES.find((p) => p.id === id);
}
