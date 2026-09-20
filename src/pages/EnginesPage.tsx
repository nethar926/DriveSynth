import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { EnginePatch } from '../audio';
import { BUILTIN_PATCHES } from '../audio';

interface Props {
  selectedId: string;
  userPatches: EnginePatch[];
  onSelect: (patch: EnginePatch) => void;
}

/** Preview WAVs under public/snippets/ (Audio Synth). */
const SNIPPET_BY_ID: Record<string, string> = {
  'v8-rumble': 'snippets/v8-rumble.wav',
  'i4-zip': 'snippets/i4-zip.wav',
  'ev-whine': 'snippets/ev-whine.wav',
  'tie-fighter': 'snippets/ion-twin-tie-fighter.wav',
};

export function EnginesPage({ selectedId, userPatches, onSelect }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSnippet = (src: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.pause();
    a.src = `${import.meta.env.BASE_URL}${src}`;
    void a.play().catch(() => {
      /* autoplay may block until a prior gesture — card tap counts */
    });
  };

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
              snippetSrc={SNIPPET_BY_ID[p.id]}
              onPreview={playSnippet}
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
  snippetSrc,
  onPreview,
}: {
  patch: EnginePatch;
  selected: boolean;
  onSelect: () => void;
  snippetSrc?: string;
  onPreview?: (src: string) => void;
}) {
  return (
    <div className={`engine-card ${selected ? 'selected' : ''}`}>
      <button type="button" className="engine-card-main" onClick={onSelect}>
        <div className="engine-card-top">
          <span className={`kind-pill kind-${patch.kind}`}>{patch.kind}</span>
          <span className="free-pill">FREE</span>
        </div>
        <div className="engine-card-name">{patch.name}</div>
        <div className="engine-card-blurb">{patch.meta?.blurb ?? patch.topology}</div>
        {selected && <div className="engine-card-active">Active</div>}
      </button>
      {snippetSrc && onPreview && (
        <button
          type="button"
          className="engine-preview-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(snippetSrc);
          }}
        >
          Preview
        </button>
      )}
    </div>
  );
}
