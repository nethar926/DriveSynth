import packs from "./revforge-packs.json";
import type { EnginePatch } from "../audio/types";
import type { Drivetrain } from "./simulation";
import {
  ICE_PACK_SCHEDULES,
  mapRevforgeFiringToFamily,
  physicsJitterToWorklet,
  resolveIcePackSchedule,
} from "../audio/engineStateBridge";

export type ScenePack = (typeof packs)[number];
export const SCENES = packs;
export const sceneForId = (id: string) =>
  SCENES.find((p) => p.id === id) ?? SCENES[0];

/** Legacy sakura-gtr scenePatch params — do not add firingFamily / misfire / τ. */
function sakuraLegacyPatch(scene: ScenePack): EnginePatch {
  const p = scene.engine;
  return {
    revforge: { ...p },
    version: 0,
    id: `revforge-${scene.id}`,
    name: scene.name,
    kind: "ice",
    topology: "i6-silk",
    params: {
      masterGain: 0.85,
      stereoWidth: 0.55,
      rpmIdle: (p.idleRpm * Math.max(4, p.cylinders)) / 120,
      rpmRedline: (Math.min(9000, p.redline) * Math.max(4, p.cylinders)) / 120,
      cylinders: Math.max(4, p.cylinders),
      roughness: p.rumble,
      growl: p.growl,
      presence: p.metallic,
      intake: p.air,
      exhaust: p.exhaust,
      muffling: 1 - p.body * 0.65,
      crackle: p.crackle,
      pulseJitter: p.firing === "crossplane" ? 0.14 : 0.045,
      pulseWidth: p.firing === "crossplane" ? 0.44 : 0.25,
      exhaustLength: 0.25 + p.body * 0.55,
      whinePitch: 140 + p.turboPitch * 200,
      inverterBuzz: p.metallic,
      corePitch: 75 + p.metallic * 55,
      formantHowl: p.rasp,
      wetHiss: p.air,
      spoolPitch: 80 + p.turboPitch * 80,
      afterburn: p.growl,
    },
    meta: {
      author: "DriveSynth × RevForge",
      blurb: scene.tagline,
      tags: ["revforge", "ice", scene.scene],
    },
  };
}

/**
 * Per-scene ICE character overrides (Audio Physics control sheet).
 * Keys are scene ids; sakura-gtr must never appear here.
 */
const ICE_SCENE_CHARACTER: Record<
  string,
  {
    pulseWidth: number;
    roughness?: number;
    growl?: number;
    presence?: number;
    intake?: number;
    exhaust?: number;
    muffling?: number;
    exhaustLength?: number;
    exhaustFeedback?: number;
    crackle?: number;
    ignitionNoise?: number;
    stereoWidth?: number;
    masterGain?: number;
  }
> = {
  // Potato crossplane — heavy burble, asymmetric pulse, loft misfire via schedule
  "road-66": {
    pulseWidth: 0.52,
    roughness: 0.78,
    growl: 0.74,
    presence: 0.18,
    intake: 0.42,
    exhaust: 0.82,
    muffling: 0.32,
    exhaustLength: 0.68,
    exhaustFeedback: 0.78,
    crackle: 0.52,
    ignitionNoise: 0.28,
    stereoWidth: 0.58,
  },
  // Metallic even flat rasp
  "apex-v8": {
    pulseWidth: 0.28,
    roughness: 0.38,
    growl: 0.52,
    presence: 0.78,
    intake: 0.55,
    exhaust: 0.48,
    muffling: 0.28,
    exhaustLength: 0.42,
    exhaustFeedback: 0.68,
    crackle: 0.18,
    ignitionNoise: 0.2,
    stereoWidth: 0.48,
  },
  // Thin body, high air / presence — filter-sweep feel via timbre
  "neon-drive": {
    pulseWidth: 0.24,
    roughness: 0.22,
    growl: 0.36,
    presence: 0.85,
    intake: 0.78,
    exhaust: 0.32,
    muffling: 0.18,
    exhaustLength: 0.28,
    exhaustFeedback: 0.62,
    crackle: 0.38,
    ignitionNoise: 0.18,
    stereoWidth: 0.62,
  },
  // Sharper flat NA V8 scream
  italia: {
    pulseWidth: 0.26,
    roughness: 0.32,
    growl: 0.58,
    presence: 0.72,
    intake: 0.62,
    exhaust: 0.55,
    muffling: 0.22,
    exhaustLength: 0.38,
    exhaustFeedback: 0.7,
    crackle: 0.28,
    ignitionNoise: 0.16,
    stereoWidth: 0.5,
  },
  // Deep American crossplane
  miami: {
    pulseWidth: 0.55,
    roughness: 0.86,
    growl: 0.82,
    presence: 0.12,
    intake: 0.4,
    exhaust: 0.9,
    muffling: 0.28,
    exhaustLength: 0.78,
    exhaustFeedback: 0.8,
    crackle: 0.68,
    ignitionNoise: 0.3,
    stereoWidth: 0.6,
  },
  // Refined German even V8
  autobahn: {
    pulseWidth: 0.3,
    roughness: 0.42,
    growl: 0.55,
    presence: 0.42,
    intake: 0.48,
    exhaust: 0.58,
    muffling: 0.3,
    exhaustLength: 0.48,
    exhaustFeedback: 0.72,
    crackle: 0.26,
    ignitionNoise: 0.18,
    stereoWidth: 0.46,
  },
  // Muffled I6 silk — slow gas τ from schedule
  lofi: {
    pulseWidth: 0.4,
    roughness: 0.28,
    growl: 0.22,
    presence: 0.08,
    intake: 0.22,
    exhaust: 0.32,
    muffling: 0.72,
    exhaustLength: 0.62,
    exhaustFeedback: 0.66,
    crackle: 0.04,
    ignitionNoise: 0.08,
    stereoWidth: 0.28,
    masterGain: 0.72,
  },
  // Heavy body dusty crossplane
  "dune-runner": {
    pulseWidth: 0.58,
    roughness: 0.9,
    growl: 0.84,
    presence: 0.14,
    intake: 0.38,
    exhaust: 0.92,
    muffling: 0.24,
    exhaustLength: 0.82,
    exhaustFeedback: 0.82,
    crackle: 0.42,
    ignitionNoise: 0.32,
    stereoWidth: 0.55,
  },
  // Cold straight-six silk
  alpine: {
    pulseWidth: 0.32,
    roughness: 0.2,
    growl: 0.48,
    presence: 0.48,
    intake: 0.65,
    exhaust: 0.48,
    muffling: 0.26,
    exhaustLength: 0.4,
    exhaustFeedback: 0.7,
    crackle: 0.14,
    ignitionNoise: 0.12,
    stereoWidth: 0.36,
  },
};

function iceBaseParams(scene: ScenePack): Record<string, number> {
  const p = scene.engine;
  const cyl = Math.max(4, p.cylinders || 8);
  const fam = mapRevforgeFiringToFamily(p.firing, cyl);
  const sched =
    resolveIcePackSchedule(scene.id) ??
    ({
      firingFamily: fam,
      collectorDelayMs: fam === 1 ? 1.8 : fam === 2 ? 0.7 : 0.5,
      tauManifold: 0.1,
      tauExhaust: 0.18,
      pulseJitterFrac: fam === 1 ? 0.02 : 0.009,
      misfireDefault: fam === 1 ? 0.05 : 0.015,
      bankOffsetDeg: cyl >= 8 ? 90 : 0,
    } as const);

  const character = ICE_SCENE_CHARACTER[scene.id] ?? {};
  const jitterW = physicsJitterToWorklet(sched.pulseJitterFrac);

  return {
    masterGain: character.masterGain ?? 0.85,
    stereoWidth: character.stereoWidth ?? (fam === 1 ? 0.55 : 0.48),
    rpmIdle: (p.idleRpm * cyl) / 120,
    rpmRedline: (Math.min(9000, p.redline) * cyl) / 120,
    cylinders: cyl,
    firingFamily: sched.firingFamily,
    firingMask: 0,
    misfire: sched.misfireDefault,
    pulseJitter: jitterW,
    pulseWidth: character.pulseWidth ?? (fam === 1 ? 0.5 : 0.28),
    roughness: character.roughness ?? p.rumble,
    growl: character.growl ?? p.growl,
    presence: character.presence ?? p.metallic,
    intake: character.intake ?? p.air,
    exhaust: character.exhaust ?? p.exhaust,
    muffling: character.muffling ?? 1 - p.body * 0.65,
    crackle: character.crackle ?? p.crackle,
    exhaustLength: character.exhaustLength ?? 0.25 + p.body * 0.55,
    exhaustFeedback: character.exhaustFeedback ?? (fam === 1 ? 0.76 : 0.7),
    ignitionNoise: character.ignitionNoise ?? 0.2,
    // Physics schedule → pack params for Synth / bridge
    collectorDelayMs: sched.collectorDelayMs,
    bankOffsetDeg: sched.bankOffsetDeg,
    tauManifold: sched.tauManifold,
    tauExhaust: sched.tauExhaust,
  };
}

export function scenePatch(scene: ScenePack): EnginePatch {
  // EXCLUDED: sakura-gtr — leave effective patch identical to pre-rework
  if (scene.id === "sakura-gtr") {
    return sakuraLegacyPatch(scene);
  }

  const p = scene.engine;
  const kind =
    p.voice === "electric"
      ? "ev-whine"
      : p.voice === "starfighter"
        ? "scifi"
        : p.voice === "turbine"
          ? "aerospace"
          : "ice";
  const topology =
    kind === "scifi"
      ? "tie-fighter"
      : kind === "aerospace"
        ? "aerospace-f14"
        : kind === "ev-whine"
          ? "ev-dual-motor"
          : p.cylinders === 6
            ? "i6-silk"
            : p.cylinders === 4
              ? "i4-zip"
              : "v8-rumble";

  if (kind !== "ice") {
    return {
      revforge: { ...p },
      version: 0,
      id: `revforge-${scene.id}`,
      name: scene.name,
      kind,
      topology,
      params: {
        masterGain: 0.85,
        stereoWidth: 0.55,
        rpmIdle: (p.idleRpm * Math.max(4, p.cylinders)) / 120,
        rpmRedline: (Math.min(9000, p.redline) * Math.max(4, p.cylinders)) / 120,
        cylinders: Math.max(4, p.cylinders),
        roughness: p.rumble,
        growl: p.growl,
        presence: p.metallic,
        intake: p.air,
        exhaust: p.exhaust,
        muffling: 1 - p.body * 0.65,
        crackle: p.crackle,
        pulseJitter: p.firing === "crossplane" ? 0.14 : 0.045,
        pulseWidth: p.firing === "crossplane" ? 0.44 : 0.25,
        exhaustLength: 0.25 + p.body * 0.55,
        whinePitch: 140 + p.turboPitch * 200,
        inverterBuzz: p.metallic,
        corePitch: 75 + p.metallic * 55,
        formantHowl: p.rasp,
        wetHiss: p.air,
        spoolPitch: 80 + p.turboPitch * 80,
        afterburn: p.growl,
      },
      meta: {
        author: "DriveSynth × RevForge",
        blurb: scene.tagline,
        tags: ["revforge", kind, scene.scene],
      },
    };
  }

  const iceParams = iceBaseParams(scene);
  // Keep non-ICE keys out of ICE patches; still pass EV/aero placeholders unused
  return {
    revforge: { ...p },
    version: 0,
    id: `revforge-${scene.id}`,
    name: scene.name,
    kind: "ice",
    topology,
    params: {
      ...iceParams,
      // unused on ICE path but harmless for mixed consumers
      whinePitch: 140 + p.turboPitch * 200,
      inverterBuzz: p.metallic,
      corePitch: 75 + p.metallic * 55,
      formantHowl: p.rasp,
      wetHiss: p.air,
      spoolPitch: 80 + p.turboPitch * 80,
      afterburn: p.growl,
    },
    meta: {
      author: "DriveSynth × RevForge",
      blurb: scene.tagline,
      tags: ["revforge", "ice", scene.scene, `fam${iceParams.firingFamily}`],
    },
  };
}

export const REVFORGE_PATCHES = SCENES.map(scenePatch);

/** Expose schedule table for tests / HUD. */
export { ICE_PACK_SCHEDULES, mapRevforgeFiringToFamily };

function baseDrivetrain(
  patch: EnginePatch | undefined,
  _scene: ScenePack,
): Drivetrain {
  if (patch?.revforge) {
    const original = patch.revforge as ScenePack['engine'];
    return {
      idleRpm: original.idleRpm,
      redline: original.redline,
      gears: Math.max(1, original.gears),
      shiftRpm: Math.min(original.shiftRpm, original.redline * 0.95),
      finalDrive: original.finalDrive,
    };
  }
  const cylinders = Number(patch?.params.cylinders ?? 8);
  const ice = patch?.kind === "ice";
  const idleRpm = ice
    ? (Number(patch.params.rpmIdle ?? 55) * 120) / cylinders
    : 650;
  const redline = ice
    ? Math.max(
        idleRpm + 1000,
        (Number(patch.params.rpmRedline ?? 300) * 120) / cylinders,
      )
    : 10000;
  return {
    idleRpm,
    redline,
    gears: ice ? 6 : 1,
    shiftRpm: redline * 0.9,
    finalDrive: 3.31,
  };
}

export function drivetrainFor(
  patch: EnginePatch | undefined,
  scene: ScenePack,
): Drivetrain {
  const c = baseDrivetrain(patch, scene);
  const p = patch?.params ?? {};
  const finite = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;
  const max = Math.max(
    c.idleRpm + 500,
    Math.min(18000, finite(p.maxRpm, c.redline)),
  );
  const top =
    p.topSpeedKph === undefined
      ? undefined
      : Math.max(40, Math.min(500, finite(p.topSpeedKph, 240))) / 3.6;
  return {
    ...c,
    redline: max,
    gears: Math.round(Math.max(1, Math.min(10, finite(p.gearCount, c.gears)))),
    shiftRpm: Math.max(
      c.idleRpm + 100,
      Math.min(max, finite(p.autoShiftRpm, c.shiftRpm)),
    ),
    warningRpm:
      max * Math.max(0.5, Math.min(1, finite(p.redlinePercent, 90) / 100)),
    topSpeedMps: top,
  };
}
