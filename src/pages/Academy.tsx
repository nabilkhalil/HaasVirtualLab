import { useState } from 'react';
import { go } from '../app/router';
import { MODULES, moduleStatus, PASS, scoreQuiz, type Module } from '../academy/modules';
import { openDemo, startLesson } from '../academy/launch';
import { lessonById } from '../lessons/toolLessons';
import { useProgress } from '../store/progressStore';
import { useT } from '../i18n';


function Quiz({ m }: { m: Module }) {
  const t = useT();
  const [ans, setAns] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const rec = useProgress((p) => p.recordResult);
  const best = useProgress((p) => p.modules[m.id]?.quiz);
  const r = scoreQuiz(m, ans);
  return (
    <div data-testid="quiz">
      {m.quiz.map((q, i) => (
        <fieldset key={i} className="q">
          <legend>{i + 1}. {q.q}</legend>
          {q.options.map((o, j) => (
            <label key={j} className={done ? (j === q.answer ? 'ok' : ans[i] === j ? 'alarm' : '') : ''}>
              <input type="radio" name={`${m.id}-q${i}`} disabled={done} checked={ans[i] === j} data-testid={`quiz-${i}-${j}`}
                onChange={() => { const a = [...ans]; a[i] = j; setAns(a); }} /> {o}
            </label>
          ))}
          {done && <div className="small calc">{q.why} <i>[{q.src}]</i></div>}
        </fieldset>
      ))}
      {!done ? <button data-testid="quiz-submit" disabled={ans.filter((x) => x !== undefined).length < m.quiz.length}
        onClick={() => { setDone(true); rec(m.id, 'quiz', { ...r, at: Date.now() }); useProgress.getState().addAttempt({ moduleId: m.id, lessonId: 'quiz', mode: 'assessment', score: r.score, max: r.max, at: Date.now(), collisions: 0, incorrect: r.max - r.score, hints: 0 }); }}>{t('quiz.submit')}</button>
        : <div data-testid="quiz-result"><b>{r.score} / {r.max}</b> {r.score / r.max >= PASS ? `— ${t('quiz.passed')}` : `— ${t('quiz.needed', { n: Math.ceil(PASS * r.max) })}`} <button onClick={() => { setAns([]); setDone(false); }}>{t('quiz.retake')}</button></div>}
      {best && <div className="small">{t('quiz.best')}: {best.score}/{best.max}</div>}
    </div>
  );
}

function ModulePage({ m }: { m: Module }) {
  const t = useT();
  const p = useProgress((s) => s.modules[m.id]);
  const st = moduleStatus(m, p);
  const i = MODULES.indexOf(m);
  const title = (id: string | null) => (id ? lessonById(id)?.title ?? id : '—');
  const tick = (b: boolean) => (b ? '✔' : '○');
  return (
    <div className="page module" data-testid={`module-${m.id}`}>
      <div className="row between">
        <button onClick={() => go('academy')}>{t('academy.all')}</button>
        <span>
          <button disabled={i === 0} onClick={() => go(`academy/${MODULES[i - 1]?.id}`)}>◀ {MODULES[i - 1]?.id}</button>
          <button disabled={i === MODULES.length - 1} onClick={() => go(`academy/${MODULES[i + 1]?.id}`)} data-testid="module-next">{MODULES[i + 1]?.id} ▶</button>
        </span>
      </div>
      <h2>{m.id} · {t(`mod.${m.id}.title`, {}, m.title)} <span className={`badge ${st.status.replace(' ', '')}`} data-testid="module-status">{t(`status.${st.status}`)}</span></h2>
      {t('content.note') && <p className="small planned">{t('content.note')}</p>}
      {!m.available ? <p className="warn" data-testid="module-unavailable">{m.unavailable}</p> : <>
        <section><h3>{t('sec.outcomes')}</h3><ul>{t.list(`mod.${m.id}.outcomes`, m.outcomes).map((o) => <li key={o}>{o}</li>)}</ul></section>
        <section><h3>{t('sec.theory')}</h3><p data-testid="module-theory">{t(`mod.${m.id}.theory`, {}, m.theory)}</p></section>
        <section><h3>{t('sec.demo')}</h3><p className="small">{m.demo.text}</p><button data-testid="open-demo" onClick={() => openDemo(m)}>{t('btn.openDemo')}</button></section>
        <section><h3>{tick(st.steps.guided)} {t('sec.guided')}</h3>
          {m.guided.map((g) => <button key={g} data-testid={`start-guided-${g}`} onClick={() => startLesson(g, 'guided', m.id)}>{p?.guided.includes(g) ? '✔ ' : ''}{title(g)}</button>)}</section>
        <section><h3>{tick(st.steps.practice)} {t('sec.practice')}</h3><p className="small">{t('practice.note')}</p>
          <button data-testid="start-practice" onClick={() => startLesson(m.practice!, 'practice', m.id)}>{title(m.practice)}</button>{p?.practice && <span className="small"> {t('best')} {p.practice.score}/{p.practice.max}</span>}</section>
        <section><h3>{tick(st.steps.quiz)} {t('sec.quiz')}</h3><Quiz m={m} /></section>
        <section><h3>{tick(st.steps.practical)} {t('sec.practical')}</h3><p className="small">{t('practical.note', { pass: PASS * 100 })}</p>
          <button data-testid="start-practical" onClick={() => startLesson(m.practical!, 'assessment', m.id)}>{title(m.practical)}</button>{p?.practical && <span className="small"> {t('best')} {p.practical.score}/{p.practical.max}</span>}</section>
      </>}
    </div>
  );
}

export default function Academy({ id }: { id?: string }) {
  const p = useProgress((s) => s.modules);
  const t = useT();
  const m = MODULES.find((x) => x.id === id);
  if (m) return <ModulePage m={m} />;
  return (
    <div className="page" data-testid="academy">
      <h2>{t('academy.title')}</h2>
      <p className="small">{t('academy.intro')}</p>
      <div className="tiles">
        {MODULES.map((x) => { const st = moduleStatus(x, p[x.id]); const n = Object.values(st.steps).filter(Boolean).length;
          return <button key={x.id} className={`tile ${x.available ? '' : 'off'}`} data-testid={`mod-${x.id}`} onClick={() => go(`academy/${x.id}`)}>
            <b>{x.id} · {t(`mod.${x.id}.title`, {}, x.title)}</b><span className={`badge ${st.status.replace(' ', '')}`}>{t(`status.${st.status}`)}</span>
            {x.available && <div className="bar"><div style={{ width: `${n * 25}%` }} /></div>}
          </button>; })}
      </div>
    </div>
  );
}
