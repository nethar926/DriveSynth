import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useGeolocation } from '../hooks/useGeolocation';
import { usePatches } from '../hooks/usePatches';
import { useUiPrefs } from '../hooks/useUiPrefs';
import { BuilderPage } from '../pages/BuilderPage';
import { CustomizePage } from '../pages/CustomizePage';
import { DiagPage } from '../pages/DiagPage';
import { DrivePage } from '../pages/DrivePage';
import { EnginesPage } from '../pages/EnginesPage';
import type { EnginePatch } from '../audio';
import { getBuiltin } from '../audio';
import { skinIdForEngine } from '../skins/DriveSkinSlot';

export default function App() {
  const { prefs, update, reset } = useUiPrefs();
  const audio = useAudioEngine(prefs.selectedEngineId);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const gps = useGeolocation(gpsEnabled);
  const { userPatches, savePatch, deletePatch } = usePatches();

  useEffect(() => {
    const eng = audio.getEngine();
    if (!eng) return;
    // Mute via output node so patch masterGain stays intact
    const out = eng.output;
    // When running and unmuted, leave gain to EngineSynth.start(); only force 0 when muted.
    const target = prefs.masterMuted ? 0 : audio.running ? 1 : out.gain.value;
    const now = eng.context.currentTime;
    try {
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(target, now, 0.05);
    } catch {
      out.gain.value = target;
    }
  }, [prefs.masterMuted, audio, audio.running]);

  const onSelectEngine = useCallback(
    (patch: EnginePatch) => {
      audio.loadPatch(patch);
      update({ selectedEngineId: patch.id });
    },
    [audio, update],
  );

  const onSavePatch = useCallback(
    (patch: EnginePatch) => {
      savePatch(patch);
      audio.loadPatch(patch);
      update({ selectedEngineId: patch.id });
    },
    [savePatch, audio, update],
  );

  const onDeleteUserPatch = useCallback(
    (id: string) => {
      deletePatch(id);
      if (audio.engineId === id || prefs.selectedEngineId === id) {
        const fallback = getBuiltin('v8-rumble');
        if (fallback) {
          audio.loadPatch(fallback);
          update({ selectedEngineId: fallback.id });
        }
      }
    },
    [deletePatch, audio, prefs.selectedEngineId, update],
  );

  const onMuteToggle = () => update({ masterMuted: !prefs.masterMuted });

  return (
    <Routes>
      <Route
        element={
          <AppShell
            prefs={prefs}
            engineName={audio.patchName}
            running={audio.running}
            onMuteToggle={onMuteToggle}
            skinId={skinIdForEngine(audio.engineId || prefs.selectedEngineId)}
          />
        }
      >
        <Route path="/" element={<Navigate to="/drive" replace />} />
        <Route path="/cockpit" element={<Navigate to="/drive" replace />} />
        <Route
          path="/drive"
          element={
            <DrivePage
              audio={audio}
              gps={gps}
              prefs={prefs}
              update={update}
              onEnableGps={() => setGpsEnabled(true)}
            />
          }
        />
        <Route
          path="/engines"
          element={
            <EnginesPage
              selectedId={audio.engineId}
              userPatches={userPatches}
              onSelect={onSelectEngine}
              onDeleteUserPatch={onDeleteUserPatch}
              audio={audio}
              prefs={prefs}
              update={update}
            />
          }
        />
        <Route
          path="/customize"
          element={<CustomizePage prefs={prefs} update={update} reset={reset} />}
        />
        <Route
          path="/builder"
          element={
            <BuilderPage
              audio={audio}
              onSave={onSavePatch}
              userPatches={userPatches}
              onDeleteUserPatch={onDeleteUserPatch}
            />
          }
        />
        <Route
          path="/diag"
          element={<DiagPage audio={audio} gps={gps} />}
        />
        <Route path="*" element={<Navigate to="/drive" replace />} />
      </Route>
    </Routes>
  );
}
