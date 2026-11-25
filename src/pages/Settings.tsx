import { go } from '../app/router';
import { toggleFullscreen } from '../app/shortcuts';
import { MAX_PANEL, MIN_PANEL, useUi } from '../store/uiStore';
import { useProgress } from '../store/progressStore';
import { useLang, useT } from '../i18n';
import { VERSION } from '../app/version';

/** Display and data settings: everything persisted in this browser, no account. */
export default function Settings() {
  const t = useT();
  const { lang, setLang } = useLang();
  const panelPct = useUi((s) => s.panelPct);
  const keysJog = useUi((s) => s.keysJog);
  const attempts = useProgress((s) => s.attempts.length);
  return (
    <div className="page" data-testid="settings">
      <h2>{t('settings.title')}</h2>
      <section><h3>{t('settings.display')}</h3>
        <p className="row"><label>{t('lang.label')}: <select data-testid="settings-lang" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'ms')}><option value="en">English</option><option value="ms">Bahasa Melayu</option></select></label>
          <button data-testid="settings-fullscreen" onClick={() => { void toggleFullscreen(); }}>{t('app.fullscreen')}</button></p>
        <p className="row"><label htmlFor="panel-range">{t('settings.panel')}: <b data-testid="settings-panel-value">{panelPct}%</b></label>
          <input id="panel-range" data-testid="settings-panel" type="range" min={MIN_PANEL} max={MAX_PANEL} step={1} value={panelPct}
            onChange={(e) => useUi.getState().setPanel(Number(e.target.value))} aria-describedby="panel-hint" /></p>
        <p className="small" id="panel-hint">{t('settings.panelHint')}</p>
        <label className="check"><input data-testid="settings-keys" type="checkbox" checked={keysJog} onChange={(e) => useUi.getState().setKeysJog(e.target.checked)} /> <span>{t('settings.keys')}</span></label>
      </section>
      <section><h3>{t('settings.data')}</h3>
        <p className="small" data-testid="settings-storage">{t('settings.storage')} ({attempts} attempts)</p>
        <p className="small">{t('settings.resetHint')}</p>
        <p className="row"><button onClick={() => go('dashboard')}>{t('settings.export')}</button>
          <button className="danger" data-testid="settings-reset" onClick={() => { if (confirm(t('dash.resetConfirm'))) useProgress.getState().reset(); }}>{t('dash.reset')}</button></p>
      </section>
      <p className="small" data-testid="settings-version">{t('app.version')} {VERSION}</p>
    </div>
  );
}
