import { go } from '../app/router';
import { MODULES, moduleStatus } from '../academy/modules';
import { resumeLesson } from '../academy/launch';
import { useProgress } from '../store/progressStore';
import { useT } from '../i18n';

/** [route, planned?] — titles/descriptions come from the translation files (tile.<route>, tile.<route>.d). */
const TILES: [string, boolean][] = [['academy', false], ['simulator', false], ['cases', false], ['assessment', false], ['dashboard', false], ['reference', false], ['guide', false], ['settings', false]];

export default function Home() {
  const p = useProgress();
  const t = useT();
  const avail = MODULES.filter((m) => m.available);
  const done = avail.filter((m) => moduleStatus(m, p.modules[m.id]).status === 'complete').length;
  return (
    <div className="page" data-testid="home">
      <h1>{t('home.title')}</h1>
      <p className="small warn">{t('home.disclaimer')}</p>
      <div className="row">
        <div className="card wide">
          <b>{t('home.progress')}</b>
          <div className="bar"><div style={{ width: `${(100 * done) / avail.length}%` }} /></div>
          <div className="small" data-testid="home-progress">{t('home.modulesComplete', { done, total: avail.length })}</div>
          {p.resume && <button data-testid="resume" onClick={resumeLesson}>{t('home.resume')} {p.resume.moduleId ?? ''} · lesson {p.resume.lessonId} ({p.resume.mode})</button>}
        </div>
      </div>
      <div className="tiles">
        {TILES.map(([r, planned]) => (
          <button key={r} className="tile" data-testid={`tile-${r}`} disabled={planned} onClick={() => go(r)} title={planned ? t('planned') : t(`tile.${r}`)}>
            <b>{t(`tile.${r}`)}</b><span className="small">{t(`tile.${r}.d`)}</span>{planned && <span className="small planned">{t('planned')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
