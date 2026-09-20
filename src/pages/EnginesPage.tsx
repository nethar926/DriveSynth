import { Link } from 'react-router-dom';
import type { EnginePatch } from '../audio';
import { BUILTIN_PATCHES } from '../audio';

interface Props {
  selectedId: string;
  userPatches: EnginePatch[];
  onSelect: (patch: EnginePatch) => void;
}

export function EnginesPage({ selectedId, userPatches, onSelect }: Props) {
  return (
    <div className="page engines-page">
      <header className="page-head">
        <h1>Engines</h1>
        <p className="page-sub">All packs unlocked · free forever · original synthesis</p>
      </header>

      <section>
        <h2 className="section-title">Built-in</h2>
        <div className="engine-grid">
          {BUILTIN_PATCHES.map((p) => (
            <EngineCard
              key={p.id}
              patch={p}
              selected={selectedId === p.id}
              onSelect={() => onSelect(p)}
            />
          ))}
        </div>
      </section>

      {userPatches.length > 0 && (
        <section>
          <h2 className="section-title">Your presets</h2>
          <div className="engine-grid">
            {userPatches.map((p) => (
              <EngineCard
                key={p.id}
                patch={p}
                selected={selectedId === p.id}
                onSelect={() => onSelect(p)}
              />
            ))}
          </div>
        </section>
      )}

      <Link to="/builder" className="cta-link">
        Open Synth Builder →
      </Link>
    </div>
  );
}

function EngineCard({
  patch,
  selected,
  onSelect,
}: {
  patch: EnginePatch;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`engine-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="engine-card-top">
        <span className={`kind-pill kind-${patch.kind}`}>{patch.kind}</span>
        <span className="free-pill">FREE</span>
      </div>
      <div className="engine-card-name">{patch.name}</div>
      <div className="engine-card-blurb">{patch.meta?.blurb ?? patch.topology}</div>
      {selected && <div className="engine-card-active">Active</div>}
    </button>
  );
}
