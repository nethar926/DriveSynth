import packs from "./revforge-packs.json";
import type { EnginePatch } from "../audio/types";
import type { Drivetrain } from "./simulation";

export type ScenePack = (typeof packs)[number];
export const SCENES = packs;
export const sceneForId = (id: string) =>
  SCENES.find((p) => p.id === id) ?? SCENES[0];
export function scenePatch(scene: ScenePack): EnginePatch {
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
export const REVFORGE_PATCHES = SCENES.map(scenePatch);
export function drivetrainFor(
  patch: EnginePatch | undefined,
  scene: ScenePack,
): Drivetrain {
  if (patch?.revforge) {
    const original = patch.revforge;
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
    : scene.engine.idleRpm;
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
