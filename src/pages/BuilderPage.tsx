import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EngineParams, EnginePatch } from '../audio';
import { paramMetaForKind } from '../audio';
import { ParamRail } from '../components/ParamRail';
import type { useAudioEngine } from '../hooks/useAudioEngine';

interface Props {
  audio: ReturnType<typeof useAudioEngine>;
  onSave: (patch: EnginePatch) => void;
}

export function BuilderPage({ audio, onSave }: Props) {
  const [params, setParams] = useState<EngineParams | null>(null);
  const [name, setName] = useState(audio.patchName);
  const [mockSpeed, setMockSpeed] = useState(0.25);
  const [mockThrottle, setMockThrottle] = useState(0.3);
  const [mockLoad, setMockLoad] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');

  const eng = audio.getEngine();
  const kind = useMemo(() => eng?.toPatch().kind ?? 'ice', [eng, params, audio.engineId]);
  const metas = paramMetaForKind(kind);

  useEffect(() => {
    const e = audio.getEngine();
    if (!e) {
      setParams(null);
      return;
    }
    setParams(e.getParams());
    setName(audio.patchName);
  }, [audio, audio.engineId, audio.patchName, audio.running]);

  useEffect(() => {
    audio.setDriving({
      speed: mockSpeed,
      throttle: mockThrottle,
      load: mockLoad,
      reverse,
    });
  }, [audio, mockSpeed, mockThrottle, mockLoad, reverse]);

  const onParam = useCallback(
    (id: string, value: number) => {
      if (!params) return;
      const next = { ...params, [id]: value };
      setParams(next);
      audio.getEngine()?.setParams({ [id]: value });
    },
    [audio, params],
  );

  const saveNamed = () => {
    const live = audio.getEngine();
    if (!live) return;
    const base = live.toPatch();
    const patch: EnginePatch = {
      ...base,
      id: `user-${Date.now().toString(36)}`,
      name: name.trim() || base.name,
      params: { ...live.getParams() } as Record<string, number | string>,
      meta: {
        ...base.meta,
        author: 'You',
        createdAt: new Date().toISOString(),
        tags: ['user', 'free'],
      },
    };
    onSave(patch);
    setMsg(`Saved “${patch.name}”`);
  };

  const exportJson = () => {
    const live = audio.getEngine();
    if (!live) return;
    const patch = {
      ...live.toPatch(),
      name: name.trim() || audio.patchName,
      params: { ...live.getParams() },
    };
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patch.id || 'patch'}.engine.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Exported JSON');
  };

  const importJson = () => {
    try {
      const patch = JSON.parse(importText) as EnginePatch;
      if (!patch || patch.version !== 0 || !patch.topology) {
        throw new Error('Invalid EnginePatch');
      }
      audio.loadPatch(patch);
      setParams(audio.getEngine()?.getParams() ?? (patch.params as EngineParams));
      setName(patch.name);
      setMsg(`Imported “${patch.name}”`);
      setImportText('');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  if (!audio.running || !params) {
    return (
      <div className="page builder-page">
        <h1 className="page-title">Synth builder</h1>
        <p className="page-blurb">Start the engine on Drive first (unlocks audio), then come back to tweak knobs.</p>
      </div>
    );
  }

  return (
    <div className="page builder-page">
      <header className="page-head">
        <h1>Synth Builder</h1>
        <p className="page-sub">Tweak EngineParams · preview · save / export / import</p>
      </header>

      {!audio.running && (
        <button type="button" className="start-btn compact" onClick={() => void audio.start()}>
          Start audio to preview
        </button>
      )}

      <section className="panel preview-driving">
        <h2 className="section-title">Driving preview</h2>
        <label className="slider-block">
          <div className="slider-head">
            <span>Speed</span>
            <span>{mockSpeed.toFixed(2)}</span>
          </div>
          <input
            className="big-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={mockSpeed}
            onChange={(e) => setMockSpeed(Number(e.target.value))}
          />
        </label>
        <label className="slider-block">
          <div className="slider-head">
            <span>Throttle</span>
            <span>{mockThrottle.toFixed(2)}</span>
          </div>
          <input
            className="big-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={mockThrottle}
            onChange={(e) => setMockThrottle(Number(e.target.value))}
          />
        </label>
        <label className="slider-block">
          <div className="slider-head">
            <span>Load</span>
            <span>{mockLoad.toFixed(2)}</span>
          </div>
          <input
            className="big-slider"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={mockLoad}
            onChange={(e) => setMockLoad(Number(e.target.value))}
          />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
          <span>Reverse</span>
        </label>
      </section>

      <section className="panel">
        <h2 className="section-title">Params · {kind}</h2>
        <div className="param-grid">
          {metas.map((m) => (
            <ParamRail
              key={m.id}
              meta={m}
              value={Number(params[m.id] ?? m.min)}
              onChange={onParam}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">Save / Export / Import</h2>
        <label className="field">
          <span>Preset name</span>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My patch"
          />
        </label>
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={saveNamed}>
            Save preset
          </button>
          <button type="button" className="btn-secondary" onClick={exportJson}>
            Export JSON
          </button>
        </div>
        <label className="field mt">
          <span>Import EnginePatch JSON</span>
          <textarea
            className="text-area"
            rows={5}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"version":0,"id":"...","name":"...","kind":"ice","topology":"v8-rumble","params":{...}}'
          />
        </label>
        <button type="button" className="btn-secondary" onClick={importJson} disabled={!importText.trim()}>
          Import
        </button>
        {msg && <p className="toast-msg">{msg}</p>}
      </section>
    </div>
  );
}
