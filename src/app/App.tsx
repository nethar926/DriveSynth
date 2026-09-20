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

export default function App() {
  const { prefs, update, reset } = useUiPrefs();
  const audio = useAudioEngine(prefs.selectedEngineId);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const gps = useGeolocation(gpsEnabled);
  const { userPatches, savePatch } = usePatches();

  useEffect(() => {
    const eng = audio.getEngine();
    // Mute via output node so patch masterGain stays intact
    const out = eng.output;
    const target = prefs.masterMuted ? 0 : 1;
    const t = eng.context.currentTime;
    try {
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(target, t, 0.05);
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
          />
        }
      >
        <Route
          path="/"
          element={
            <DrivePage
              audio={audio}
              gps={gps}
              prefs={prefs}
              onEnableGps={() => setGpsEnabled(true)}
            />
          }
        />
        <Route
          path="/drive"
          element={
            <DrivePage
              audio={audio}
              gps={gps}
              prefs={prefs}
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
            />
          }
        />
        <Route
          path="/customize"
          element={<CustomizePage prefs={prefs} update={update} reset={reset} />}
        />
        <Route path="/builder" element={<BuilderPage audio={audio} onSave={onSavePatch} />} />
        <Route
          path="/diag"
          element={<DiagPage audio={audio} gps={gps} />}
        />
        <Route path="*" element={<Navigate to="/drive" replace />} />
      </Route>
    </Routes>
  );
}
