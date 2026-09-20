import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import type { UiPrefs } from '../hooks/useUiPrefs';

interface Props {
  prefs: UiPrefs;
  engineName: string;
  running: boolean;
  onMuteToggle: () => void;
  skinId?: string;
}

export function AppShell({ prefs, engineName, running, onMuteToggle, skinId = 'default' }: Props) {
  return (
    <div className={`app-shell density-${prefs.density}`} data-skin={skinId}>
      <header className="top-chrome">
        <div className="brand">
          <span className="brand-mark">DS</span>
          <div>
            <div className="brand-name">
              {skinId === 'ion-twin' ? (
                <>
                  <span className="aurebesh brand-ab">DS</span>
                  <span className="brand-lat">DriveSynth</span>
                </>
              ) : (
                'DriveSynth'
              )}
            </div>
            <div className="brand-sub">{engineName} · free</div>
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
      <main className="main-stage">
        <Outlet />
      </main>
      <NavBar />
      {prefs.showKeepAliveTip && (
        <div className="keepalive-tip" role="note">
          Tesla tip: keep this Browser tab open — backgrounding may pause audio & GPS.
        </div>
      )}
    </div>
  );
}
