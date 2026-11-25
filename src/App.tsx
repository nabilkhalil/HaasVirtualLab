import { lazy, Suspense, useEffect, useState } from 'react';
import { useProgress } from './store/progressStore';
import { useLang, useT } from './i18n';
import { go, useRoute } from './app/router';
import { globalShortcut, toggleFullscreen } from './app/shortcuts';
import { VERSION } from './app/version';
import Home from './pages/Home';
import Academy from './pages/Academy';
import Cases from './pages/Cases';
import Reference from './pages/Reference';
import Guide from './pages/Guide';
import Settings from './pages/Settings';
import HelpOverlay from './components/HelpOverlay';
import { SceneBoundary } from './machine/SceneBoundary';

// The 3D simulator (three.js + R3F) is loaded only when needed.
const SimulatorPage = lazy(() => import('./pages/Simulator'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assessment = lazy(() => import('./pages/Assessment'));
const NAV: [string, string][] = [['', 'nav.home'], ['academy', 'nav.academy'], ['simulator', 'nav.simulator'], ['cases', 'nav.cases'], ['assessment', 'nav.assessment'], ['dashboard', 'nav.dashboard'], ['reference', 'nav.reference'], ['guide', 'nav.guide'], ['settings', 'nav.settings']];

export default function App() {
  const [page = '', sub] = useRoute();
  const t = useT();
  const { lang, setLang } = useLang();
  const [help, setHelp] = useState(false);
  // Global shortcuts: ? opens the shortcut list, F toggles fullscreen (never while typing).
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const s = globalShortcut(e);
      if (s === 'help') { e.preventDefault(); setHelp((v) => !v); }
      if (s === 'fullscreen') { e.preventDefault(); void toggleFullscreen(); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  // Prefetch the 3D simulator chunk while the user reads other pages, so opening it does not wait on the network.
  useEffect(() => {
    if (page === 'simulator') return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const load = () => { void import('./pages/Simulator'); };
    if (w.requestIdleCallback) w.requestIdleCallback(load); else window.setTimeout(load, 1500);
  }, [page]);
  // Time spent learning: counted in 15 s steps while the tab is visible.
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === 'visible') useProgress.getState().addTime(15000); }, 15000); return () => window.clearInterval(id); }, []);
  return (
    <div className="app">
      <header>
        <nav className="row" aria-label="Main">{NAV.map(([r, k]) => <button key={r} className={page === r ? 'on' : ''} data-testid={`nav-${r || 'home'}`} aria-current={page === r ? 'page' : undefined} onClick={() => go(r)}>{t(k)}</button>)}</nav>
        <b>Haas Virtual Lab</b> · Haas UMC-500 <span className="small">{t('app.profile')}</span> <span className="small" data-testid="app-version">v{VERSION}</span>
        <span className="warn">{t('app.disclaimer')}</span>
        <span className="row headertools">
          <button data-testid="help-open" onClick={() => setHelp(true)} title={t('help.title')}>{t('help.open')}</button>
          <button data-testid="fullscreen" onClick={() => { void toggleFullscreen(); }} title={t('app.fullscreen')}>{t('app.fullscreen')}</button>
          <label className="lang">{t('lang.label')}: <select data-testid="lang" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'ms')} aria-label={t('lang.label')}><option value="en">English</option><option value="ms">Bahasa Melayu</option></select></label>
        </span>
      </header>
      {page === 'simulator'
        ? <Suspense fallback={<div className="loading" data-testid="loading" role="status">{t('app.loadingSim')}</div>}><SceneBoundary><SimulatorPage /></SceneBoundary></Suspense>
        : <div className="scroll"><Suspense fallback={<div className="loading" role="status">{t('app.loading')}</div>}>
            {page === 'academy' ? <Academy id={sub} />
              : page === 'dashboard' ? <Dashboard />
              : page === 'assessment' ? <Assessment />
              : page === 'cases' ? <Cases id={sub} />
              : page === 'reference' ? <Reference />
              : page === 'guide' ? <Guide />
              : page === 'settings' ? <Settings />
              : <Home />}
          </Suspense></div>}
      {help && <HelpOverlay onClose={() => setHelp(false)} />}
    </div>
  );
}
