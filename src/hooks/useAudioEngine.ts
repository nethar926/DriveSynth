import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrivingInput, EnginePatch, EngineSynth } from '../audio';
import { createEngineSynth, getBuiltin } from '../audio';

export function useAudioEngine(initialId = 'v8-rumble') {
  const ctxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<EngineSynth | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [engineId, setEngineId] = useState(initialId);
  const [patchName, setPatchName] = useState(() => getBuiltin(initialId)?.name ?? 'Engine');

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (!engineRef.current) {
      const patch = getBuiltin(initialId) ?? getBuiltin('v8-rumble')!;
      engineRef.current = createEngineSynth(ctxRef.current, patch);
      setEngineId(patch.id);
      setPatchName(patch.name);
    }
    return engineRef.current;
  }, [initialId]);

  const start = useCallback(async () => {
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
    const eng = ensure();
    eng.fromPatch(patch);
    setEngineId(patch.id);
    setPatchName(patch.name);
  }, [ensure]);

  const getEngine = useCallback(() => ensure(), [ensure]);

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
