export type {
  DrivingInput,
  EngineDiag,
  EngineStateSnapshot,
  EngineId,
  EngineKind,
  EngineParams,
  EnginePatch,
  EngineSynth,
  IceMode,
  LockStage,
  ParamMeta,
  IonTwinLayerConfig,
  SynthNodeDesc,
  SynthNodeType,
  TopologyId,
} from './types';
export {
  BUILTIN_PATCHES,
  LEGACY_PACK_IDS,
  defaultPatchIdForKind,
  defaultsForKind,
  defaultsForTopology,
  getBuiltin,
  paramMetaForKind,
  paramMetaForNodeType,
  resolveLegacyPackId,
  resolveLegacyTopology,
  migrateEnginePatch,
} from './builtins';
export { createEngineSynth, EngineSynthImpl } from './EngineSynthImpl';
export { nextLockStage, packSupportsLockLadder } from './lockStage';
export { clamp, kphToMph, lerp, mphToSpeed, rpmCurve } from './utils';
export {
  clampIdleBand,
  DEFAULT_IDLE_BAND,
  DEFAULT_IDLE_RPM_MAX,
  DEFAULT_IDLE_RPM_MIN,
  iceFiringHzFromRpm,
  idleRpmToHz,
  readIdleBandFromStorage,
} from './idleBand';
export type { IdleBand } from './idleBand';

export {
  EngineStateBridge,
  ICE_PACK_SCHEDULES,
  crossPlaneBankAAnglesDeg,
  estimateNextPulseDt,
  isSlotDisabled,
  mapRevforgeFiringToFamily,
  nextEventAnglesDeg,
  rotaryEventAnglesDeg,
  physicsJitterToWorklet,
  resolveIcePackSchedule,
  workletJitterToPhysics,
} from './engineStateBridge';
export type {
  EngineStatePackHints,
  EngineStateRawInput,
  IcePackSchedule,
  WorkletParamPush,
} from './engineStateBridge';
export {
  playEngineStarter,
  playEngineShutoff,
  starterDuration,
  shutoffDuration,
} from './engineStartShutdown';
export {
  ION_TWIN_LAYER_IDS,
  applyIonTwinLayersToParams,
  combineIonTwinLayers,
  ionTwinContinuousLayers,
  ionTwinFullStackLayers,
  layerFromParams,
} from './ionTwinLayers';
export type { IonTwinLayerId } from './ionTwinLayers';
export { TIE_FULL_STACK } from './builtins';

