import { go } from '../app/router';
import { startLesson } from '../academy/launch';
import { CASES, caseById } from '../content/cases';
import { MODULES, moduleStatus } from '../academy/modules';
import { useProgress } from '../store/progressStore';
import { useT } from '../i18n';

/** Case studies: synthetic jobs that chain the existing lessons; nothing here needs Phase 4/6. */
export default function Cases({ id }: { id?: string }) {
  const t = useT();
  const m = caseById(id);
  const progress = useProgress((s) => s.modules);
  if (id && !m) return <div className="page" data-testid="cases"><p>{t('cases.notFound')}</p><button onClick={() => go('cases')}>{t('cases.all')}</button></div>;
  if (m) {
    const i = CASES.indexOf(m);
    return (
      <div className="page case" data-testid={`case-${m.id}`}>
        <div className="row between">
          <button onClick={() => go('cases')}>{t('cases.all')}</button>
          <span>
            <button disabled={i === 0} onClick={() => go(`cases/${CASES[i - 1]?.id}`)}>◀ {CASES[i - 1]?.id}</button>
            <button disabled={i === CASES.length - 1} onClick={() => go(`cases/${CASES[i + 1]?.id}`)}>{CASES[i + 1]?.id} ▶</button>
          </span>
        </div>
        <h2>{m.id} · {t(`case.${m.id}.title`, {}, m.title)}</h2>
        <p className="row small">
          <span className={`badge level-${m.level}`} data-testid="case-level">{t(`cases.level.${m.level}`)}</span>
          <span>{t('cases.minutes', { n: m.minutes })}</span>
          <span>{t('cases.sources')}: {m.sources.join(', ')}</span>
        </p>
        <p data-testid="case-scenario">{t(`case.${m.id}.scenario`, {}, m.scenario)}</p>
        <section><h3>{t('cases.objectives')}</h3>
          <ul data-testid="case-objectives">{t.list(`case.${m.id}.objectives`, m.objectives).map((o) => <li key={o}>{o}</li>)}</ul>
        </section>
        <section><h3>{t('cases.procedure')}</h3>
          <ol className="steps" data-testid="case-steps">{m.steps.map((s, k) => (
            <li key={k}><span>{s.text}</span>
              {s.lesson && <button data-testid={`case-step-lesson-${k}`} onClick={() => startLesson(s.lesson!, 'guided', s.module ?? null)}>▶ {t('cases.lesson', { id: s.lesson })}</button>}
            </li>))}</ol>
          <p className="small">{t('cases.contentNote')}</p>
        </section>
        <section><h3>{t('cases.checks')}</h3>
          <ul data-testid="case-checks">{m.checks.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
        <section><h3>{t('cases.pitfalls')}</h3>
          <ul className="alarm" data-testid="case-pitfalls">{m.pitfalls.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
        <section><h3>{t('cases.related')}</h3>
          <p className="row">{m.modules.map((mid) => {
            const mod = MODULES.find((x) => x.id === mid);
            const st = mod ? moduleStatus(mod, progress[mid]).status : 'unavailable';
            return <button key={mid} data-testid={`case-mod-${mid}`} onClick={() => go(`academy/${mid}`)}>{mid} {t(`mod.${mid}.title`, {}, mod?.title)} <span className={`badge ${st.replace(' ', '')}`}>{t(`status.${st}`)}</span></button>;
          })}</p>
        </section>
      </div>
    );
  }
  return (
    <div className="page" data-testid="cases">
      <h2>{t('cases.title')}</h2>
      <p className="small">{t('cases.intro')}</p>
      <div className="tiles cases">
        {CASES.map((c) => (
          <button key={c.id} className="tile case-tile" data-testid={`case-tile-${c.id}`} onClick={() => go(`cases/${c.id}`)}>
            <b>{c.id} · {t(`case.${c.id}.title`, {}, c.title)}</b>
            <span className="small">{t(`case.${c.id}.scenario`, {}, c.scenario)}</span>
            <span className="row small"><span className={`badge level-${c.level}`}>{t(`cases.level.${c.level}`)}</span>{t('cases.minutes', { n: c.minutes })}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
