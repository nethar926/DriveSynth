import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrivingInput, EnginePatch, EngineSynth } from '../audio';
import { createEngineSynth, getBuiltin } from '../audio';

export function useAudioEngine(initialId = 'v8-rumble') {
  const ctxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<EngineSynth | null>(null);
  const pendingPatchRef = useRef<EnginePatch | null>(null);
  const selectedIdRef = useRef(initialId);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [engineId, setEngineId] = useState(initialId);
  const [patchName, setPatchName] = useState(() => getBuiltin(initialId)?.name ?? 'Engine');

  selectedIdRef.current = engineId;

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (!engineRef.current) {
      const patch =
        pendingPatchRef.current ??
        getBuiltin(selectedIdRef.current) ??
        getBuiltin('v8-rumble')!;
      pendingPatchRef.current = null;
      engineRef.current = createEngineSynth(ctxRef.current, patch);
      setEngineId(patch.id);
      setPatchName(patch.name);
    }
    return engineRef.current;
  }, []);

  const start = useCallback(async () => {
    // Create AudioContext inside the tap gesture (required on iOS).
    const eng = ensure();
    if (ctxRef.current?.state === 'suspended') {
      await ctxRef.current.resume();
    }
    await eng.start();
    setReady(true);
    setRunning(true);
  }, [ensure]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setRunning(false);
  }, []);

  const setDriving = useCallback((d: DrivingInput) => {
    engineRef.current?.setDriving(d);
  }, []);

  const loadPatch = useCallback((patch: EnginePatch) => {
    setEngineId(patch.id);
    setPatchName(patch.name);
    selectedIdRef.current = patch.id;
    if (!engineRef.current) {
      pendingPatchRef.current = patch;
      return;
    }
    engineRef.current.fromPatch(patch);
  }, []);

  /** Engine exists only after Start — null beforehand (mobile-safe). */
  const getEngine = useCallback(() => engineRef.current, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return {
    start,
    stop,
    setDriving,
    loadPatch,
    getEngine,
    ready,
    running,
    engineId,
    patchName,
    context: ctxRef,
  };
}
