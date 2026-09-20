import { useState } from "react";
import { Link } from "react-router-dom";
import type { EnginePatch } from "../audio";
import type { RevForgeVoiceConfig } from "./voiceTypes";
import architectures from "./architectures.json";
import { sceneForId, scenePatch } from "./catalog";

const controls: [keyof RevForgeVoiceConfig, string, number, number, number][] =
  [
    ["idleRpm", "Idle RPM", 400, 2000, 25],
    ["redline", "Redline", 4000, 18000, 100],
    ["rumble", "Rumble", 0, 1, 0.01],
    ["growl", "Growl", 0, 1, 0.01],
    ["metallic", "Metallic", 0, 1, 0.01],
    ["air", "Air / intake", 0, 1, 0.01],
    ["exhaust", "Exhaust", 0, 1, 0.01],
    ["rasp", "Rasp", 0, 1, 0.01],
    ["body", "Body", 0, 1, 0.01],
    ["turbo", "Turbo", 0, 1, 0.01],
    ["turboPitch", "Turbo pitch", 0, 1, 0.01],
    ["blowoff", "Blow-off", 0, 1, 0.01],
    ["crackle", "Crackle", 0, 1, 0.01],
    ["distortion", "Drive / grit", 0, 1, 0.01],
    ["gears", "Gears", 1, 8, 1],
    ["shiftRpm", "Shift RPM", 2500, 17000, 100],
    ["finalDrive", "Final drive", 2, 6, 0.05],
  ];
export function NativeStudio({
  patch,
  onChange,
  onSave,
}: {
  patch: EnginePatch;
  onChange: (patch: EnginePatch) => void;
  onSave: (patch: EnginePatch) => void;
}) {
  const [name, setName] = useState(patch.name);
  const [message, setMessage] = useState("");
  if (!patch.revforge)
    return (
      <div className="forge-tune">
        <p>
          This is a DriveSynth voice. Its full node editor is available in the
          signal builder.
        </p>
        <Link className="forge-studio-link" to="/builder">
          Open signal builder →
        </Link>
      </div>
    );
  const voice = patch.revforge;
  const update = (changes: Partial<RevForgeVoiceConfig>) => {
    const engine = { ...voice, ...changes };
    engine.shiftRpm = Math.min(engine.shiftRpm, engine.redline * 0.97);
    const converted = scenePatch({ ...sceneForId("road-66"), engine });
    onChange({
      ...patch,
      kind: converted.kind,
      topology: converted.topology,
      params: converted.params,
      revforge: engine,
    });
    setMessage("");
  };
  const save = () => {
    const saved = {
      ...patch,
      id: `user-${crypto.randomUUID()}`,
      name: name.trim() || patch.name,
      meta: {
        ...patch.meta,
        author: "You",
        createdAt: new Date().toISOString(),
      },
    };
    onSave(saved);
    setMessage(`Saved ${saved.name}. Available in your garage.`);
  };
  const exportPreset = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { ...patch, name: name.trim() || patch.name },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "revforge-voice.engine.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="forge-native-studio">
      <p className="forge-studio-description">
        RevForge synthesis. Shape the voice live, then save a personal preset.
      </p>
      <label className="forge-name-label">
        PRESET NAME
        <input
          aria-label="Preset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <span className="forge-label">ARCHITECTURE</span>
      <div className="forge-architecture-grid">
        {architectures.map((a) => (
          <button key={a.id} onClick={() => update(a.patch)}>
            {a.name}
          </button>
        ))}
      </div>
      <div className="forge-studio-knobs">
        {controls.map(([key, label, min, max, step]) => (
          <label key={key}>
            <span>
              {label}
              <b>
                {max === 1
                  ? `${Math.round(Number(voice[key]) * 100)}%`
                  : Number(voice[key]).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
              </b>
            </span>
            <input
              aria-label={label}
              type="range"
              min={min}
              max={
                key === "shiftRpm" ? Math.min(max, voice.redline * 0.97) : max
              }
              step={step}
              value={Number(voice[key])}
              onChange={(e) => update({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <label className="forge-music-toggle">
        Lo-fi music layer
        <input
          type="checkbox"
          checked={voice.hasMusic}
          onChange={(e) => update({ hasMusic: e.target.checked })}
        />
      </label>
      <div className="forge-studio-actions">
        <button onClick={exportPreset}>Export preset</button>
        <button onClick={save}>Save custom voice ↗</button>
      </div>
      {message && (
        <p role="status" className="forge-save-message">
          {message}
        </p>
      )}
      <Link to="/builder" className="forge-builder-link">
        Advanced signal builder ↗
      </Link>
    </div>
  );
}
