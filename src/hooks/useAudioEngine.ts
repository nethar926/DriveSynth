import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DrivingInput,
  EngineDiag,
  EnginePatch,
  EngineSynth,
  LockStage,
} from "../audio";
import { createEngineSynth, getBuiltin } from "../audio";

export function useAudioEngine(
  initialId = "v8-rumble",
  savedPatches: EnginePatch[] = [],
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<EngineSynth | null>(null);
  const pendingPatchRef = useRef<EnginePatch | null>(
    savedPatches.find((p) => p.id === initialId) ?? null,
  );
  const selectedIdRef = useRef(initialId);
  const wantsRunning = useRef(false);
  const startVersion = useRef(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [engineId, setEngineId] = useState(initialId);
  const [patchName, setPatchName] = useState(
    () =>
      savedPatches.find((p) => p.id === initialId)?.name ??
      getBuiltin(initialId)?.name ??
      "Engine",
  );

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctxRef.current = new AC();
      ctxRef.current.onstatechange = () =>
        setRunning(
          wantsRunning.current &&
            ctxRef.current?.state === "running" &&
            !!engineRef.current?.getDiag().running,
        );
    }
    if (!engineRef.current) {
      const patch =
        pendingPatchRef.current ??
        getBuiltin(selectedIdRef.current) ??
        getBuiltin("v8-rumble")!;
      pendingPatchRef.current = null;
      engineRef.current = createEngineSynth(ctxRef.current, patch);
      setEngineId(patch.id);
      setPatchName(patch.name);
    }
    return engineRef.current;
  }, []);

  const start = useCallback(async () => {
    const version = ++startVersion.current;
    wantsRunning.current = true;
    setStarting(true);
    setError(null);
    try {
      const eng = ensure();
      if (ctxRef.current?.state !== "running") await ctxRef.current?.resume();
      await eng.start();
      if (version !== startVersion.current || !wantsRunning.current) {
        eng.stop();
        return;
      }
      setReady(true);
      setRunning(ctxRef.current?.state === "running");
    } catch (error) {
      wantsRunning.current = false;
      setRunning(false);
      setError(
        error instanceof Error
          ? error.message
          : "Audio could not start. Tap Start to retry.",
      );
    } finally {
      if (version === startVersion.current) setStarting(false);
    }
  }, [ensure]);

  const stop = useCallback(() => {
    wantsRunning.current = false;
    startVersion.current++;
    engineRef.current?.stop();
    setRunning(false);
    setStarting(false);
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
    if (!!engineRef.current.toPatch().revforge !== !!patch.revforge) {
      const version = ++startVersion.current;
      engineRef.current.dispose();
      const next = createEngineSynth(ctxRef.current!, patch);
      engineRef.current = next;
      setRunning(false);
      if (wantsRunning.current) {
        setStarting(true);
        void next
          .start()
          .then(() => {
            if (version !== startVersion.current || !wantsRunning.current) {
              next.stop();
              return;
            }
            setRunning(ctxRef.current?.state === "running");
            setReady(true);
          })
          .catch((error) => {
            if (version === startVersion.current) {
              wantsRunning.current = false;
              setError(String(error));
              setRunning(false);
            }
          })
          .finally(() => {
            if (version === startVersion.current) setStarting(false);
          });
      }
    } else engineRef.current.fromPatch(patch);
  }, []);

  /** Engine exists only after Start — null beforehand (mobile-safe). */
  const getEngine = useCallback(() => engineRef.current, []);
  const getPatch = useCallback(
    () =>
      engineRef.current?.toPatch() ??
      pendingPatchRef.current ??
      getBuiltin(selectedIdRef.current),
    [],
  );

  /** Frontend /diag — stable field names (iceMode, contextState, …). */
  const getDiag = useCallback((): EngineDiag => {
    const eng = engineRef.current;
    if (eng) return eng.getDiag();
    return {
      contextState: ctxRef.current?.state ?? "not started",
      iceMode: "n/a",
      running: false,
      engineId: selectedIdRef.current,
    };
  }, []);

  const getLockStage = useCallback((): LockStage => {
    return engineRef.current?.getLockStage() ?? "none";
  }, []);

  const setLockSfxEnabled = useCallback((enabled: boolean) => {
    engineRef.current?.setLockSfxEnabled(enabled);
  }, []);

  const getLockSfxEnabled = useCallback((): boolean => {
    return engineRef.current?.getLockSfxEnabled() ?? false;
  }, []);

  const setUpshiftSfxEnabled = useCallback((enabled: boolean) => {
    engineRef.current?.setUpshiftSfxEnabled(enabled);
    // Persist even before Start so Customize toggle sticks (engine may not exist yet).
    try {
      if (enabled) localStorage.setItem("ds-upshift-sfx", "1");
      else localStorage.removeItem("ds-upshift-sfx");
    } catch {
      /* ignore */
    }
  }, []);

  const getUpshiftSfxEnabled = useCallback((): boolean => {
    if (engineRef.current) return engineRef.current.getUpshiftSfxEnabled();
    try {
      return localStorage.getItem("ds-upshift-sfx") === "1";
    } catch {
      return false;
    }
  }, []);

  const triggerUiCue = useCallback((cue: "upshift" | string) => {
    engineRef.current?.triggerUiCue?.(cue);
  }, []);

  useEffect(() => {
    return () => {
      wantsRunning.current = false;
      startVersion.current++;
      if (ctxRef.current) ctxRef.current.onstatechange = null;
      engineRef.current?.dispose();
      engineRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return useMemo(
    () => ({
      error,
      starting,
      start,
      stop,
      setDriving,
      loadPatch,
      getEngine,
      getPatch,
      getDiag,
      getLockStage,
      setLockSfxEnabled,
      getLockSfxEnabled,
      setUpshiftSfxEnabled,
      getUpshiftSfxEnabled,
      triggerUiCue,
      ready,
      running,
      engineId,
      patchName,
      context: ctxRef,
    }),
    [
      error,
      starting,
      start,
      stop,
      setDriving,
      loadPatch,
      getEngine,
      getPatch,
      getDiag,
      getLockStage,
      setLockSfxEnabled,
      getLockSfxEnabled,
      setUpshiftSfxEnabled,
      getUpshiftSfxEnabled,
      triggerUiCue,
      ready,
      running,
      engineId,
      patchName,
    ],
  );
}
