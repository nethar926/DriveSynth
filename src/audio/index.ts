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
  EngineStateBridge,
  estimateNextPulseDt,
  isSlotDisabled,
  nextEventAnglesDeg,
} from './engineStateBridge';
export type {
  EngineStatePackHints,
  EngineStateRawInput,
  WorkletParamPush,
} from './engineStateBridge';
