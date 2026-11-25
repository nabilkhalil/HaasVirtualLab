import { useEffect, useRef, useState } from 'react';
import { stepHelp } from '../academy/stepHelp';
import { lessonsOf, MODULES } from '../academy/modules';
import { startLesson } from '../academy/launch';
import { go } from '../app/router';
import { explain } from '../engine/explain';
import { useProgress } from '../store/progressStore';
import { useT } from '../i18n';
import { useLesson, type LearnMode } from '../store/lessonStore';
import { useMachine } from '../store/machineStore';
import { LESSONS, lessonById } from './toolLessons';
import { WORK_LESSONS } from './workLessons';
import { FIVE_LESSONS } from './fiveLessons';

const MODES: LearnMode[] = ['guided', 'practice', 'assessment'];

export function LessonPanel() {
  const l = useLesson();
  const t = useT();
  const { state: s, replace } = useMachine();
  const [open, setOpen] = useState(true);
  const [pick, setPick] = useState('F-A');
  const [hintN, setHintN] = useState(0);
  const lesson = lessonById(l.lessonId);
  const prog = useProgress();
  const start = (id: string) => { setHintN(0); startLesson(id, l.mode, l.lessonId === id ? l.moduleId : null, false); };
  void replace;
  const mod = MODULES.find((m) => m.id === l.moduleId);
  const seq = mod ? lessonsOf(mod) : [];
  const idx = l.lessonId ? seq.indexOf(l.lessonId) : -1;
  const ans = (k: string, v: string) => l.set({ answers: { ...l.answers, [k]: v } });
  const guide = lesson && l.mode === 'guided' && !l.result ? lesson.guide(s, l.answers) : null;
  const locked = l.mode === 'assessment' && !!l.result;
  const help = guide ? { ...stepHelp(guide.target), ...(guide.why ? { why: guide.why } : {}), ...(guide.expect ? { expect: guide.expect } : {}) } : null;
  const why = explain(s.message);
  // Guided exercise completed (state-driven: only when the required practical actions were actually done).
  const guidedDone = !!lesson && l.mode === 'guided' && lesson.guide(s, l.answers) === null;
  useEffect(() => { if (guidedDone && l.moduleId) prog.recordGuided(l.moduleId, lesson!.id); }, [guidedDone, l.moduleId]); // eslint-disable-line
  // Auto-save for "resume previous progress" (debounced).
  const timer = useRef<number | null>(null);
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!lesson || l.result) { pending.current = null; return; }
    const snap = { moduleId: l.moduleId, lessonId: lesson.id, mode: l.mode, answers: l.answers, state: s, at: Date.now() };
    pending.current = () => { prog.saveResume(snap); pending.current = null; };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => pending.current?.(), 1500);
  }, [s, l.answers, lesson, l.mode, l.result]); // eslint-disable-line
  // Flush the pending snapshot when leaving the simulator or the page, so no progress is lost.
  useEffect(() => {
    const flush = () => pending.current?.();
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); if (timer.current) window.clearTimeout(timer.current); flush(); };
  }, []);
  const submit = () => {
    const r = lesson!.assess(s, l.answers), now = Date.now();
    l.set({ result: r });
    prog.addAttempt({ moduleId: l.moduleId, lessonId: lesson!.id, mode: l.mode, score: r.total, max: r.max, at: now, collisions: s.stats.collisions,
      incorrect: s.stats.rejected - s.stats.collisions, hints: l.hintsUsed, durationMs: l.startedAt ? now - l.startedAt : undefined,
      ok: s.stats.ok, alarms: s.stats.alarms, mistakes: s.stats.mistakes, seed: l.seed, items: r.items });
    if (l.mode === 'practice') prog.recordResult(l.moduleId, 'practice', { score: r.total, max: r.max, at: now });
    if (l.mode === 'assessment' && mod?.practical === lesson!.id) prog.recordResult(l.moduleId, 'practical', { score: r.total, max: r.max, at: now }, lesson!.id);
    if (l.mode === 'assessment') prog.saveResume(null);
  };
  if (!open) return <button className="lesson-toggle" data-testid="lesson-open" onClick={() => setOpen(true)}>Lessons</button>;
  return (
    <div className="lesson" data-testid="lesson-panel">
      {guide?.target && <style>{`${guide.target.split(',').map((t) => `[data-testid="${t}"]`).join(',')}{outline:3px solid #ffeb3b;outline-offset:1px;animation:pulse 1s infinite}`}</style>}
      <div className="row between"><b>{mod ? `${mod.id} · ${t(`mod.${mod.id}.title`, {}, mod.title)}` : t('lesson.training')}</b><button onClick={() => setOpen(false)}>–</button></div>
      {mod && <div className="row small" data-testid="lesson-nav">
        <button data-testid="lesson-prev" disabled={idx <= 0} onClick={() => startLesson(seq[idx - 1], l.mode, mod.id)}>{t('lesson.prev')}</button>
        <button data-testid="lesson-module" onClick={() => go(`academy/${mod.id}`)}>{t('lesson.modulePage')}</button>
        <button data-testid="lesson-next" disabled={idx < 0 || idx >= seq.length - 1} onClick={() => startLesson(seq[idx + 1], l.mode, mod.id)}>{t('lesson.next')}</button>
      </div>}
      <div className="row">
        {MODES.map((m) => <button key={m} data-testid={`mode-${m}`} className={l.mode === m ? 'on' : ''} disabled={!!lesson && !l.result && m !== l.mode}
          onClick={() => l.set({ mode: m })}>{t(`mode.${m}`)}</button>)}
      </div>
      <div className="row">
        <select data-testid="lesson-select" value={pick} onChange={(e) => setPick(e.target.value)}>
          <optgroup label="Phase 5 · Five-axis">{FIVE_LESSONS.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>
          <optgroup label="Phase 3 · Work setup">{WORK_LESSONS.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>
          <optgroup label="Phase 2 · Tool setup">{LESSONS.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>
        </select>
        <button data-testid="lesson-start" onClick={() => start(pick)}>{lesson ? t('lesson.restart') : t('lesson.start')}</button>
        {lesson && <button data-testid="lesson-exit" onClick={() => { l.set({ lessonId: null, result: null, moduleId: null }); prog.saveResume(null); }}>{t('lesson.exit')}</button>}
      </div>
      {lesson && <>
        <div className="small"><b>{lesson.title}</b> — {lesson.objective}</div>
        {l.mode === 'guided' && <ul className="small">{lesson.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>}
        {guide && <div className="guide" data-testid="guide">▶ {guide.text}
          {help?.why && <div className="stephelp" data-testid="guide-why">{t('lesson.why')}: {help.why}</div>}
          {help?.expect && <div className="stephelp" data-testid="guide-expect">{t('lesson.expect')}: {help.expect}</div>}</div>}
        {why && l.mode !== 'assessment' && <div className="feedback" data-testid="lesson-feedback">⚠ {s.message} — {why}</div>}
        {guide?.record && <button data-testid="lesson-record" onClick={() => ans(guide.record!, `${s.machine.X},${s.machine.Y},${s.machine.Z}`)}>{t('lesson.record')} ({guide.record})</button>}
        {l.mode === 'practice' && !l.result && <div className="row small"><button data-testid="lesson-hint" onClick={() => { setHintN(hintN + 1); prog.addHint(); l.set({ hintsUsed: l.hintsUsed + 1 }); }}>{t('lesson.hint')}</button>
          {lesson.hints.slice(0, hintN).map((h) => <span key={h}>💡 {h}</span>)}</div>}
        {lesson.id === 'B' && !locked && (() => {
          const n = [1, 2, 3, 4, 5].find((k) => !l.answers[`seen${k}`]);
          return n ? <button data-testid="lesson-seen" onClick={() => ans(`seen${n}`, '1')}>T{n} checked → next</button> : null;
        })()}
        {lesson.questions?.map((q) => (
          <div key={q.id} className="row small" data-testid={`lesson-q-${q.id}`}>
            <span>{q.label}:</span>
            {q.kind === 'number' && <input disabled={locked} value={l.answers[q.id] ?? ''} onChange={(e) => ans(q.id, e.target.value)} />}
            {q.kind === 'choice' && q.options!.map((o) => <button key={o} disabled={locked} className={l.answers[q.id] === o ? 'on' : ''} onClick={() => ans(q.id, o)}>{o}</button>)}
            {q.kind === 'multi' && q.options!.map((o) => {
              const set = new Set((l.answers[q.id] ?? '').split(',').filter(Boolean));
              return <label key={o}><input type="checkbox" disabled={locked} checked={set.has(o)}
                onChange={() => { set.has(o) ? set.delete(o) : set.add(o); ans(q.id, [...set].sort().join(',')); }} />T{o}</label>;
            })}
          </div>
        ))}
        <button data-testid="lesson-submit" disabled={locked} onClick={submit}>
          {l.mode === 'assessment' ? t('lesson.submit') : t('lesson.check')}</button>
        {l.mode === 'guided' && <details className="small"><summary>{t('lesson.hintsErrors')}</summary>
          <ul>{lesson.hints.map((h) => <li key={h}>{h}</li>)}</ul><ul>{lesson.commonErrors.map((h) => <li key={h}>⚠ {h}</li>)}</ul></details>}
        {l.result && (
          <div className="result" data-testid="lesson-result">
            <b>{t('lesson.score')}: {l.result.total} / {l.result.max}</b>
            {(() => { const pct = Math.round((100 * l.result!.total) / l.result!.max); return <div className="small" data-testid="competency">{t('lesson.competency')} {pct}% — {t(pct >= 80 ? 'lvl.competent' : pct >= 60 ? 'lvl.developing' : 'lvl.notyet')}</div>; })()}
            <div className="small" data-testid="result-metrics">{t('lesson.metrics', { ok: s.stats.ok, bad: s.stats.rejected - s.stats.collisions, coll: s.stats.collisions, al: s.stats.alarms, h: l.hintsUsed, t: l.startedAt ? Math.round((Date.now() - l.startedAt) / 1000) : '—' })}{l.seed !== null ? ` · ${t('lesson.variant')} #${l.seed}` : ''}</div>
            <ul className="small">{l.result.items.map((i) => <li key={i.label} className={i.points === i.max ? 'ok' : 'alarm'}>{i.label}: {i.points}/{i.max}{i.detail ? ` (${i.detail})` : ''}</li>)}</ul>
            {l.result.total < l.result.max && <div className="small" data-testid="result-feedback"><b>{t('lesson.feedback')}</b>
              <ul>{Object.entries(s.stats.mistakes).map(([k, v]) => <li key={k}>{v}× {t(`mistake.${k}`, {}, k)}</li>)}
                {lesson.commonErrors.map((e) => <li key={e}>{t('lesson.checkPrefix')}: {e}</li>)}</ul></div>}
          </div>
        )}
      </>}
      <div className="small warn">{t('lesson.simWarn')}</div>
    </div>
  );
}
