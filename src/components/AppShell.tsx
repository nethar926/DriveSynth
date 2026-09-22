import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { HamburgerMenu } from './NavBar';
import type { UiPrefs } from '../hooks/useUiPrefs';

interface Props {
  prefs: UiPrefs;
  engineName: string;
  running: boolean;
  onMuteToggle: () => void;
  skinId?: string;
}

export function AppShell({ prefs, engineName, running, onMuteToggle, skinId = 'default' }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const speedScript = skinId === 'ion-twin' ? prefs.ionTwinSpeedScript : undefined;

  return (
    <div
      className={`app-shell density-${prefs.density}`}
      data-skin={skinId}
      data-font={prefs.fontFamily}
      {...(speedScript ? { 'data-speed-script': speedScript } : {})}
    >
      <header className="top-chrome">
        <div className="chrome-leading">
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="revforge-menu"
            onClick={() => setMenuOpen(true)}
          >
            <span className="hamburger-glyph" aria-hidden="true">
              ☰
            </span>
          </button>
          <div className="brand">
            <span className="brand-mark">RF</span>
            <div>
              <div className="brand-name">
                {skinId === 'ion-twin' ? (
                  <>
                    <span className="aurebesh brand-ab">RF</span>
                    <span className="brand-lat">RevForge</span>
                  </>
                ) : (
                  'RevForge'
                )}
              </div>
              <div className="brand-sub">{engineName} · free</div>
            </div>
          </div>
        </div>
        <div className="chrome-actions">
          <button
            type="button"
            className={`icon-btn ${prefs.masterMuted ? 'muted' : ''}`}
            onClick={onMuteToggle}
            aria-label={prefs.masterMuted ? 'Unmute' : 'Mute'}
          >
            {prefs.masterMuted ? 'Muted' : running ? 'Live' : 'Idle'}
          </button>
        </div>
      </header>

      <HamburgerMenu open={menuOpen} onClose={closeMenu} />

      <main className="main-stage">
        <Outlet />
      </main>

      {prefs.showKeepAliveTip && (
        <div className="keepalive-tip" role="note">
          Tesla tip: keep this Browser tab open — backgrounding may pause audio & GPS.
        </div>
      )}
    </div>
  );
}
