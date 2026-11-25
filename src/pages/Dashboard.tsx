import { useRef, useState } from 'react';
import { go } from '../app/router';
import { breakdown, CATEGORIES, commonMistakes, overall, recommend, type RevisionReason } from '../academy/competency';
import { attemptsCSV, backupJSON, CSV_HEADER, download, parseBackup } from '../academy/exports';
import { MODULES, moduleStatus } from '../academy/modules';
import { useProgress } from '../store/progressStore';
import { useT } from '../i18n';

const fmtTime = (ms: number) => `${Math.floor(ms / 3600000)} h ${Math.round((ms % 3600000) / 60000)} min`;
/** Single-series magnitude bars (one hue, direct labels, title tooltips; the table below is the accessible view). */
function Bars({ rows, testid, fmt = (v) => `${Math.round(v * 100)} %` }: { rows: [string, number | null, string?][]; testid: string; fmt?: (v: number) => string }) {
  const t = useT();
  return (
    <div className="bars" data-testid={testid} role="img" aria-label={rows.map(([k, v]) => `${k} ${v === null ? t('dash.noEvidence') : Math.round(v * 100) + '%'}`).join(', ')}>
      {rows.map(([k, v, note]) => (
        <div key={k} className="barrow" title={`${k}: ${v === null ? note ?? t('dash.noEvidence') : fmt(v)}`}>
          <span className="barlabel">{k}</span>
          <span className="bartrack">{v !== null && <span className="barfill" style={{ width: `${Math.max(1, v * 100)}%` }} />}</span>
          <span className="barval">{v === null ? note ?? '—' : fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const p = useProgress();
  const t = useT();
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const o = overall(p.modules), b = breakdown(p.attempts), mistakes = commonMistakes(p.attempts), rec = recommend(p.modules, p.attempts);
  const attempts = [...p.attempts].reverse();
  /** Recommendation reasons are stored as data so both languages can render them. */
  const reasonText = (r: RevisionReason) => {
    if (r.kind === 'quiz') return t('reason.quiz', { score: r.score, max: r.max });
    if (r.kind === 'practical') return t('reason.practical', { score: r.score, max: r.max });
    if (r.kind === 'category') return t('reason.category', { category: t(`cat.${r.category}`), pct: r.pct });
    return t('reason.mistake', { n: r.n, mistake: t(`mistake.${r.mistake}`, {}, r.mistake) });
  };
  const restore = async (f?: File) => {
    if (!f) return;
    try { const d = parseBackup(await f.text()); p.restore(d); setMsg(t('dash.restored', { n: d.attempts.length })); } catch (e) { setMsg(`${t('dash.restoreFailed')}: ${(e as Error).message}`); }
  };
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <div className="page report" data-testid="dashboard">
      <div className="row between noprint">
        <h2>{t('dash.title')}</h2>
        <span className="row">
          <button data-testid="export-json" onClick={() => download(`hvl-backup-${stamp}.json`, backupJSON({ modules: p.modules, attempts: p.attempts, hints: p.hints, timeMs: p.timeMs }), 'application/json')}>{t('dash.backup')}</button>
          <button data-testid="restore-json" onClick={() => file.current?.click()}>{t('dash.restore')}</button>
          <input ref={file} type="file" accept="application/json,.json" hidden data-testid="restore-file" onChange={(e) => restore(e.target.files?.[0])} />
          <button data-testid="export-csv" onClick={() => download(`hvl-assessments-${stamp}.csv`, attemptsCSV(p.attempts, CSV_HEADER.map((h) => t(`csv.${h}`, {}, h))), 'text/csv;charset=utf-8')}>{t('dash.csv')}</button>
          <button data-testid="print" onClick={() => window.print()}>{t('dash.print')}</button>
        </span>
      </div>
      <h2 className="printonly">{t('dash.reportTitle')} ({stamp})</h2>
      <p className="small">{t('dash.disclaimer')}</p>
      {msg && <div className="small" data-testid="dash-msg">{msg}</div>}
      <div className="tiles">
        <div className="card"><span className="small">{t('dash.overall')}</span><b className="hero" data-testid="dash-overall">{Math.round(o.pct * 100)} %</b></div>
        <div className="card"><span className="small">{t('dash.complete')}</span><b className="hero" data-testid="dash-complete">{o.complete.length} / {o.available}</b></div>
        <div className="card"><span className="small">{t('dash.time')}</span><b className="hero" data-testid="dash-time">{fmtTime(p.timeMs)}</b></div>
        <div className="card"><span className="small">{t('dash.attempts')}</span><b className="hero" data-testid="dash-attempts">{p.attempts.length}</b><span className="small">{t('dash.hintsUsed')} {p.hints}</span></div>
      </div>
      <section><h3>{t('dash.breakdown')}</h3>
        <Bars testid="dash-breakdown" rows={CATEGORIES.map((c) => [t(`cat.${c}`), b[c], c === 'Program verification' ? t('dash.needsP6') : undefined])} />
        <table className="lib"><thead><tr><th>{t('dash.category')}</th><th>{t('dash.score')}</th><th>{t('dash.evidence')}</th></tr></thead><tbody>
          {CATEGORIES.map((c) => <tr key={c}><td>{t(`cat.${c}`)}</td><td>{b[c] === null ? '—' : `${Math.round(b[c]! * 100)} %`}</td>
            <td className="small">{t(c === 'Controller operation' ? 'dash.ev.ops' : c === 'Safety compliance' ? 'dash.ev.safety' : c === 'Program verification' ? 'dash.ev.p6' : 'dash.ev.best')}</td></tr>)}
        </tbody></table></section>
      <section><h3>{t('dash.modules')}</h3><table className="lib" data-testid="dash-modules"><thead><tr><th>{t('dash.module')}</th><th>{t('dash.status')}</th><th>{t('dash.quiz')}</th><th>{t('dash.practical')}</th></tr></thead><tbody>
        {MODULES.map((m) => { const mp = p.modules[m.id]; return <tr key={m.id}><td><a href={`#/academy/${m.id}`}>{m.id} {t(`mod.${m.id}.title`, {}, m.title)}</a></td><td>{t(`status.${moduleStatus(m, mp).status}`)}</td>
          <td>{mp?.quiz ? `${mp.quiz.score}/${mp.quiz.max}` : '—'}</td><td>{mp?.practical ? `${mp.practical.score}/${mp.practical.max}` : '—'}</td></tr>; })}
      </tbody></table></section>
      <section><h3>{t('dash.mistakes')}</h3>{mistakes.length ? <Bars testid="dash-mistakes" rows={mistakes.map(([k, v]) => [t(`mistake.${k}`, {}, k), v / mistakes[0][1]])} fmt={(v) => `${Math.round(v * mistakes[0][1])}×`} /> : <p className="small">{t('dash.none')}</p>}</section>
      <section><h3>{t('dash.revision')}</h3>{rec.length ? <ul data-testid="dash-recommend">{rec.map((r) => <li key={r.id}><a href={`#/academy/${r.id}`}>{r.id} {t(`mod.${r.id}.title`, {}, MODULES.find((m) => m.id === r.id)?.title)}</a> — {reasonText(r.reason)}</li>)}</ul> : <p className="small">{t('dash.noRevision')}</p>}</section>
      <section><h3>{t('dash.history')}</h3>
        <table className="lib" data-testid="dash-history"><thead><tr><th>{t('dash.date')}</th><th>{t('dash.module')}</th><th>{t('dash.exercise')}</th><th>{t('dash.mode')}</th><th>{t('dash.score')}</th><th>{t('dash.timeCol')}</th><th>{t('dash.coll')}</th><th>{t('dash.incorrect')}</th><th>{t('dash.hints')}</th></tr></thead><tbody>
          {attempts.slice(0, 100).map((a, i) => <tr key={i}><td>{new Date(a.at).toLocaleString(t.lang === 'ms' ? 'ms-MY' : 'en-GB')}</td><td>{a.moduleId ?? '—'}</td><td>{a.lessonId}</td><td>{t(`mode.${a.mode}`)}</td>
            <td>{a.score}/{a.max}</td><td>{a.durationMs !== undefined ? `${Math.round(a.durationMs / 1000)} s` : '—'}</td><td>{a.collisions}</td><td>{a.incorrect}</td><td>{a.hints}</td></tr>)}
        </tbody></table></section>
      <div className="noprint"><button data-testid="dash-reset" onClick={() => { if (confirm(t('dash.resetConfirm'))) p.reset(); }}>{t('dash.reset')}</button> <button onClick={() => go('assessment')}>{t('dash.goAssess')}</button></div>
    </div>
  );
}
