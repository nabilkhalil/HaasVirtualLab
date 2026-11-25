import { useEffect } from 'react';
import { SHORTCUTS } from '../app/shortcuts';
import { useT } from '../i18n';

/** Shortcut list as a modal dialog: Escape or a click on the backdrop closes it. */
export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="overlay" data-testid="help-overlay" role="dialog" aria-modal="true" aria-label={t('help.title')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="overlay-card">
        <div className="row between"><h3>{t('help.title')}</h3><button data-testid="help-close" onClick={onClose}>{t('help.close')}</button></div>
        <table className="lib shortcuts"><thead><tr><th>{t('col.keys')}</th><th>{t('col.action')}</th></tr></thead>
          <tbody>{SHORTCUTS.map((s) => <tr key={s.id}><td><kbd>{s.keys}</kbd></td><td>{t(`short.${s.id}`)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
