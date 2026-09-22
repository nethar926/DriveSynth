export type {
  DrivingInput,
  EngineDiag,
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
  defaultPatchIdForKind,
  defaultsForKind,
  defaultsForTopology,
  getBuiltin,
  paramMetaForKind,
  paramMetaForNodeType,
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
  ION_TWIN_LAYER_IDS,
  applyIonTwinLayersToParams,
  combineIonTwinLayers,
  ionTwinContinuousLayers,
  ionTwinFullStackLayers,
  layerFromParams,
} from './ionTwinLayers';
export type { IonTwinLayerId } from './ionTwinLayers';
export { TIE_FULL_STACK } from './builtins';

