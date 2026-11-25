import { MODULES } from '../academy/modules';
import { startLesson } from '../academy/launch';
import { lessonById } from '../lessons/toolLessons';
import { useProgress } from '../store/progressStore';
import { go } from '../app/router';
import { useT } from '../i18n';

/** Competency assessment hub: practice, guided assessment and independent (randomised) assessment per module. */
export default function Assessment() {
  const attempts = useProgress((p) => p.attempts);
  const t = useT();
  return (
    <div className="page" data-testid="assessment">
      <h2>{t('assess.title')}</h2>
      <p className="small">{t('assess.intro')}</p>
      <table className="lib"><thead><tr><th>{t('dash.module')}</th><th>{t('assess.exercise')}</th><th>{t('assess.practice')}</th><th>{t('assess.guided')}</th><th>{t('assess.indep')}</th><th>{t('assess.best')}</th><th>{t('assess.attempts')}</th></tr></thead><tbody>
        {MODULES.map((m) => {
          const own = attempts.filter((a) => a.moduleId === m.id && a.lessonId !== 'quiz');
          const best = own.reduce((b, a) => Math.max(b, a.max ? a.score / a.max : 0), 0);
          return <tr key={m.id} className={m.available ? '' : 'dim'}>
            <td><a href={`#/academy/${m.id}`}>{m.id} {t(`mod.${m.id}.title`, {}, m.title)}</a></td>
            {m.available && m.practical ? <>
              <td>{lessonById(m.practical)?.title}</td>
              <td><button data-testid={`as-practice-${m.id}`} onClick={() => startLesson(m.practice!, 'practice', m.id)}>{t('assess.practice')}</button></td>
              <td><button data-testid={`as-guided-${m.id}`} onClick={() => startLesson(m.practical!, 'guided', m.id)}>{t('assess.btnGuided')}</button></td>
              <td><button data-testid={`as-indep-${m.id}`} onClick={() => startLesson(m.practical!, 'assessment', m.id)}>{t('assess.btnStart')}</button></td>
              <td>{own.length ? `${Math.round(best * 100)} %` : '—'}</td><td>{own.length}</td>
            </> : <td colSpan={6} className="small">{m.unavailable}</td>}
          </tr>;
        })}
      </tbody></table>
      <button onClick={() => go('dashboard')}>{t('assess.openDash')}</button>
    </div>
  );
}
