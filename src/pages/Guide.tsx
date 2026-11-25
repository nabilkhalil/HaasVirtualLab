import { go } from '../app/router';
import { SHORTCUTS } from '../app/shortcuts';
import { useT } from '../i18n';
import { VERSION } from '../app/version';

const SECTIONS = ['start', 'modes', 'academy', 'dashboard', 'cases', 'shortcuts', 'data', 'limits'] as const;

/** In-app user guide. Long-form documentation lives in docs/USER_GUIDE.md. */
export default function Guide() {
  const t = useT();
  return (
    <div className="page guide" data-testid="guide">
      <h2>{t('guide.title')}</h2>
      <p className="small">{t('guide.intro')}</p>
      {SECTIONS.map((s) => (
        <section key={s} data-testid={`guide-${s}`}>
          <h3>{t(`guide.${s}.t`)}</h3>
          <p>{t(`guide.${s}.s`)}</p>
        </section>
      ))}
      <section><h3>{t('guide.shortcutsTitle')}</h3>
        <table className="lib shortcuts" data-testid="guide-shortcuts">
          <thead><tr><th>{t('col.keys')}</th><th>{t('col.action')}</th></tr></thead>
          <tbody>{SHORTCUTS.map((s) => <tr key={s.id}><td className="keycell"><kbd>{s.keys}</kbd></td><td>{t(`short.${s.id}`)}</td></tr>)}</tbody>
        </table>
      </section>
      <p className="row"><button onClick={() => go('cases')}>{t('tile.cases')}</button><button onClick={() => go('reference')}>{t('tile.reference')}</button><button onClick={() => go('settings')}>{t('tile.settings')}</button></p>
      <p className="small" data-testid="guide-version">{t('guide.version')} {VERSION}</p>
    </div>
  );
}
