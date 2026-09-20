import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineParams, EnginePatch, SynthNodeDesc, SynthNodeType } from '../audio';
import { paramMetaForKind, paramMetaForNodeType } from '../audio';
import { ParamRail } from '../components/ParamRail';
import type { useAudioEngine } from '../hooks/useAudioEngine';

interface Props {
  audio: ReturnType<typeof useAudioEngine>;
  onSave: (patch: EnginePatch) => void;
}

interface GraphNode extends SynthNodeDesc {
  x: number;
  y: number;
}

interface WireDrag {
  fromId: string;
  x: number;
  y: number;
}

const PALETTE: { type: SynthNodeType; label: string; color: string }[] = [
  { type: 'PulseTrain', label: 'PulseTrain', color: '#ff8a5c' },
  { type: 'ExhaustWaveguide', label: 'Exhaust', color: '#ff5c7a' },
  { type: 'IntakeNoise', label: 'Intake', color: '#3dffb5' },
  { type: 'Mechanical', label: 'Mechanical', color: '#c9a227' },
  { type: 'FormantHowl', label: 'FormantHowl', color: '#b388ff' },
  { type: 'WetRoadNoise', label: 'WetRoad', color: '#5c9dff' },
  { type: 'Filter', label: 'Filter', color: '#5cadee' },
  { type: 'Gain', label: 'Gain', color: '#8b97ab' },
  { type: 'Mix', label: 'Mix', color: '#e8eef8' },
  { type: 'Osc', label: 'Osc', color: '#3dffb5' },
  { type: 'Noise', label: 'Noise', color: '#8b97ab' },
];

const NODE_W = 156;
const NODE_H = 72;
const GRID = 20;

function defaultParams(type: SynthNodeType): Record<string, number | string> {
  switch (type) {
    case 'PulseTrain':
      return { cylinders: 8, pulseWidth: 0.38, pulseJitter: 0.12, roughness: 0.45 };
    case 'ExhaustWaveguide':
      return { exhaustLength: 0.5, exhaustFeedback: 0.75, muffling: 0.3, growl: 0.65 };
    case 'IntakeNoise':
      return { intake: 0.5 };
    case 'Mechanical':
      return { roughness: 0.4 };
    case 'FormantHowl':
      return { formantHowl: 0.7, formantSpread: 0.55, resonance: 0.65 };
    case 'WetRoadNoise':
      return { wetHiss: 0.55, doppler: 0.4 };
    case 'Filter':
    case 'biquad':
      return { frequency: 1200, Q: 1.2, gain: 0 };
    case 'Gain':
    case 'gain':
      return { gain: 0.7 };
    case 'Mix':
      return { gain: 1 };
    case 'Osc':
      return { frequency: 110, detune: 0 };
    case 'Noise':
      return { gain: 0.3 };
    default:
      return { gain: 0.5 };
  }
}

function defaultGraphForKind(kind: string): GraphNode[] {
  if (kind === 'scifi') {
    return [
      { id: 'n1', type: 'Osc', params: defaultParams('Osc'), outs: [{ to: 'n3' }], x: 40, y: 40 },
      { id: 'n2', type: 'FormantHowl', params: defaultParams('FormantHowl'), outs: [{ to: 'n4' }], x: 40, y: 140 },
      { id: 'n3', type: 'WetRoadNoise', params: defaultParams('WetRoadNoise'), outs: [{ to: 'n4' }], x: 240, y: 40 },
      { id: 'n4', type: 'Mix', params: defaultParams('Mix'), outs: [{ to: 'n5' }], x: 240, y: 160 },
      { id: 'n5', type: 'Gain', params: defaultParams('Gain'), outs: [], x: 440, y: 100 },
    ];
  }
  if (kind === 'ev-whine') {
    return [
      { id: 'n1', type: 'Osc', params: { frequency: 180, detune: 0 }, outs: [{ to: 'n3' }], x: 40, y: 80 },
      { id: 'n2', type: 'Noise', params: { gain: 0.3 }, outs: [{ to: 'n3' }], x: 40, y: 200 },
      { id: 'n3', type: 'Mix', params: { gain: 1 }, outs: [{ to: 'n4' }], x: 260, y: 130 },
      { id: 'n4', type: 'Gain', params: { gain: 0.65 }, outs: [], x: 460, y: 130 },
    ];
  }
  return [
    { id: 'n1', type: 'PulseTrain', params: defaultParams('PulseTrain'), outs: [{ to: 'n2' }], x: 36, y: 60 },
    { id: 'n2', type: 'ExhaustWaveguide', params: defaultParams('ExhaustWaveguide'), outs: [{ to: 'n5' }], x: 240, y: 40 },
    { id: 'n3', type: 'IntakeNoise', params: defaultParams('IntakeNoise'), outs: [{ to: 'n5' }], x: 240, y: 140 },
    { id: 'n4', type: 'Mechanical', params: defaultParams('Mechanical'), outs: [{ to: 'n5' }], x: 240, y: 240 },
    { id: 'n5', type: 'Mix', params: defaultParams('Mix'), outs: [{ to: 'n6' }], x: 460, y: 140 },
    { id: 'n6', type: 'Gain', params: defaultParams('Gain'), outs: [], x: 640, y: 140 },
  ];
}

function portPos(node: GraphNode, which: 'in' | 'out') {
  return {
    x: node.x + (which === 'out' ? NODE_W : 0),
    y: node.y + NODE_H / 2,
  };
}

let idSeq = 1;
function nextId() {
  idSeq += 1;
  return `n${Date.now().toString(36)}${idSeq}`;
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
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [wireDrag, setWireDrag] = useState<WireDrag | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const eng = audio.getEngine();
  const kind = useMemo(() => eng?.toPatch().kind ?? 'ice', [eng, params, audio.engineId]);
  const metas = paramMetaForKind(kind);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const nodeMetas = selected ? paramMetaForNodeType(selected.type) : [];

  useEffect(() => {
    const e = audio.getEngine();
    if (!e) {
      setParams(null);
      return;
    }
    setParams(e.getParams());
    setName(audio.patchName);
    const patch = e.toPatch();
    if (patch.graph?.length) {
      setNodes(
        patch.graph.map((n, i) => ({
          ...n,
          x: n.x ?? 40 + (i % 3) * 200,
          y: n.y ?? 40 + Math.floor(i / 3) * 110,
        })),
      );
    } else {
      setNodes(defaultGraphForKind(patch.kind));
    }
    setSelectedId(null);
  }, [audio, audio.engineId, audio.patchName, audio.running]);

  useEffect(() => {
    audio.setDriving({
      speed: mockSpeed,
      throttle: mockThrottle,
      load: mockLoad,
      reverse,
    });
  }, [audio, mockSpeed, mockThrottle, mockLoad, reverse]);

  const pushGraphLive = useCallback(
    (next: GraphNode[]) => {
      const live = audio.getEngine();
      if (!live) return;
      const desc: SynthNodeDesc[] = next.map(({ id, type, params: p, outs, x, y }) => ({
        id,
        type,
        params: p,
        outs,
        x,
        y,
      }));
      if (live.applyGraphToParams) {
        live.applyGraphToParams(desc);
      }
      setParams(live.getParams());
    },
    [audio],
  );

  const onParam = useCallback(
    (id: string, value: number) => {
      if (!params) return;
      const next = { ...params, [id]: value };
      setParams(next);
      audio.getEngine()?.setParams({ [id]: value });
    },
    [audio, params],
  );

  const onNodeParam = useCallback(
    (id: string, value: number) => {
      if (!selectedId) return;
      setNodes((prev) => {
        const next = prev.map((n) =>
          n.id === selectedId ? { ...n, params: { ...n.params, [id]: value } } : n,
        );
        pushGraphLive(next);
        return next;
      });
    },
    [selectedId, pushGraphLive],
  );

  const addNode = (type: SynthNodeType) => {
    const n: GraphNode = {
      id: nextId(),
      type,
      params: defaultParams(type),
      outs: [],
      x: 48 + (nodes.length % 4) * 48,
      y: 36 + (nodes.length % 5) * 36,
    };
    setNodes((prev) => {
      const next = [...prev, n];
      pushGraphLive(next);
      return next;
    });
    setSelectedId(n.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setNodes((prev) => {
      const next = prev
        .filter((n) => n.id !== selectedId)
        .map((n) => ({ ...n, outs: n.outs.filter((o) => o.to !== selectedId) }));
      pushGraphLive(next);
      return next;
    });
    setSelectedId(null);
  };

  const onPointerDownNode = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setSelectedId(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({
      id,
      ox: e.clientX - rect.left - node.x,
      oy: e.clientY - rect.top - node.y,
    });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragging) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging.id
            ? { ...n, x: Math.max(0, x - dragging.ox), y: Math.max(0, y - dragging.oy) }
            : n,
        ),
      );
    }
    if (wireDrag) {
      setWireDrag({ ...wireDrag, x, y });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (wireDrag) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const target = nodes.find(
          (n) =>
            n.id !== wireDrag.fromId &&
            x >= n.x &&
            x <= n.x + NODE_W &&
            y >= n.y &&
            y <= n.y + NODE_H,
        );
        if (target) {
          setNodes((prev) => {
            const next = prev.map((n) => {
              if (n.id !== wireDrag.fromId) return n;
              if (n.outs.some((o) => o.to === target.id)) return n;
              return { ...n, outs: [...n.outs, { to: target.id }] };
            });
            pushGraphLive(next);
            return next;
          });
        }
      }
      setWireDrag(null);
    }
    if (dragging) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging.id
            ? {
                ...n,
                x: Math.round(n.x / GRID) * GRID,
                y: Math.round(n.y / GRID) * GRID,
              }
            : n,
        ),
      );
    }
    setDragging(null);
  };

  const startWire = (e: React.PointerEvent, fromId: string) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = nodes.find((n) => n.id === fromId);
    if (!node) return;
    const p = portPos(node, 'out');
    setWireDrag({ fromId, x: p.x, y: p.y });
    setSelectedId(fromId);
  };

  const compileAndApply = () => {
    pushGraphLive(nodes);
    setMsg('Graph applied to live engine params');
  };

  const saveNamed = () => {
    const live = audio.getEngine();
    if (!live) return;
    pushGraphLive(nodes);
    const base = live.toPatch();
    const patch: EnginePatch = {
      ...base,
      id: `user-${Date.now().toString(36)}`,
      name: name.trim() || base.name,
      params: { ...live.getParams() } as Record<string, number | string>,
      graph: nodes.map(({ id, type, params: p, outs, x, y }) => ({ id, type, params: p, outs, x, y })),
      meta: {
        ...base.meta,
        author: 'You',
        createdAt: new Date().toISOString(),
        tags: ['user', 'free', 'graph'],
      },
    };
    onSave(patch);
    setMsg(`Saved “${patch.name}”`);
  };

  const exportJson = () => {
    const live = audio.getEngine();
    if (!live) return;
    pushGraphLive(nodes);
    const patch = {
      ...live.toPatch(),
      name: name.trim() || audio.patchName,
      params: { ...live.getParams() },
      graph: nodes.map(({ id, type, params: p, outs, x, y }) => ({ id, type, params: p, outs, x, y })),
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
      if (patch.graph?.length) {
        setNodes(
          patch.graph.map((n, i) => ({
            ...n,
            x: n.x ?? 40 + (i % 3) * 200,
            y: n.y ?? 40 + Math.floor(i / 3) * 110,
          })),
        );
      }
      setMsg(`Imported “${patch.name}”`);
      setImportText('');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  const colorFor = (type: string) => PALETTE.find((p) => p.type === type)?.color ?? '#8b97ab';

  if (!audio.running || !params) {
    return (
      <div className="page builder-page">
        <h1 className="page-title">Synth builder</h1>
        <p className="page-blurb">
          Start the engine on Drive first (unlocks audio), then come back to build node graphs and tweak knobs.
        </p>
      </div>
    );
  }

  return (
    <div className="page builder-page">
      <header className="page-head">
        <h1>Synth Builder</h1>
        <p className="page-sub">Node graph · EngineParams · preview · save / export / import</p>
      </header>

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

      <section className="panel graph-panel">
        <h2 className="section-title">Node graph · {kind}</h2>
        <div className="palette-row">
          {PALETTE.map((p) => (
            <button
              key={p.type}
              type="button"
              className="palette-btn"
              style={{ borderColor: p.color }}
              onClick={() => addNode(p.type)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          className="graph-canvas"
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={() => setSelectedId(null)}
        >
          <svg className="graph-wires" width="100%" height="100%">
            {nodes.flatMap((n) =>
              n.outs.map((o) => {
                const tgt = nodes.find((t) => t.id === o.to);
                if (!tgt) return null;
                const a = portPos(n, 'out');
                const b = portPos(tgt, 'in');
                const mx = (a.x + b.x) / 2;
                return (
                  <path
                    key={`${n.id}-${o.to}`}
                    d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                    className="wire-path"
                  />
                );
              }),
            )}
            {wireDrag &&
              (() => {
                const from = nodes.find((n) => n.id === wireDrag.fromId);
                if (!from) return null;
                const a = portPos(from, 'out');
                const mx = (a.x + wireDrag.x) / 2;
                return (
                  <path
                    d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${wireDrag.y}, ${wireDrag.x} ${wireDrag.y}`}
                    className="wire-path preview"
                  />
                );
              })()}
          </svg>

          {nodes.map((n) => (
            <div
              key={n.id}
              className={`graph-node ${selectedId === n.id ? 'selected' : ''}`}
              style={{
                left: n.x,
                top: n.y,
                width: NODE_W,
                borderColor: colorFor(n.type),
              }}
              onPointerDown={(e) => onPointerDownNode(e, n.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="graph-node-title">{n.type}</div>
              <div className="graph-node-sub">{n.id}</div>
              <button
                type="button"
                className="port port-in"
                aria-label="input"
                onPointerDown={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="port port-out"
                aria-label="output"
                onPointerDown={(e) => startWire(e, n.id)}
              />
            </div>
          ))}
        </div>

        <p className="graph-hint">Drag nodes · drag the right port to wire · tap Apply graph. Large targets for Tesla touch.</p>

        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={compileAndApply}>
            Apply graph
          </button>
          <button type="button" className="btn-secondary" onClick={removeSelected} disabled={!selectedId}>
            Delete node
          </button>
        </div>

        {selected && (
          <div className="node-param-rail">
            <h3 className="section-title">Node · {selected.type}</h3>
            <div className="param-grid">
              {nodeMetas.map((m) => (
                <ParamRail
                  key={m.id}
                  meta={m}
                  value={Number(selected.params[m.id] ?? m.min)}
                  onChange={onNodeParam}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">Engine params · {kind}</h2>
        <div className="param-grid">
          {metas.map((m) => (
            <ParamRail key={m.id} meta={m} value={Number(params[m.id] ?? m.min)} onChange={onParam} />
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
            placeholder='{"version":0,"id":"...","name":"...","kind":"ice","topology":"v8-rumble","params":{...},"graph":[...]}'
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
