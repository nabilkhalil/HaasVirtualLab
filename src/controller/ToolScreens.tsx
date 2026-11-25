import { useState } from 'react';
import { OFFSET_COLS, OFFSET_ROWS } from '../config/tools';
import { UMC500 } from '../config/umc500';
import { PAGE2_COLS } from '../engine/machine';
import { HAAS_TYPES } from '../config/tools';
import { WCS, WORK_AXES } from '../config/workholding';
import { g43Check, paperState, referenceGap } from '../engine/tools';
import { useHideTruth } from '../store/lessonStore';
import { useMachine } from '../store/machineStore';

const P1 = ['H GEOM', 'H WEAR', 'D GEOM', 'D WEAR'];
const f3 = (v: number) => v.toFixed(3);

/** NGC-style Work Offset display (S1 F4.44: G Code, X/Y/Z and rotary axis columns; Work Material omitted). */
export function WorkOffsetScreen() {
  const { state: s, dispatch } = useMachine();
  return (
    <div data-testid="work-screen">
      <div className="tabs"><span className="tab off">TOOL (F4)</span><span className="tab on">WORK</span>
        <span className="act">Active: <b data-testid="active-wcs">{s.activeWcs}</b></span></div>
      <table className="off" data-testid="work-table">
        <thead><tr><th>G Code</th>{WORK_AXES.map((a) => <th key={a}>{a} Axis</th>)}</tr></thead>
        <tbody>
          {WCS.map((w, r) => (
            <tr key={w} className={w === s.activeWcs ? 'actT' : ''}>
              <th>{w}</th>
              {WORK_AXES.map((a, c) => (
                <td key={a} data-testid={`work-${w}-${a}`} className={s.workCursor.row === r && s.workCursor.col === c ? 'cur' : ''}
                  onClick={() => dispatch({ type: 'WORK_CURSOR_TO', row: r, col: c })}>{f3(s.work[w][a])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inputline" data-testid="input-line">&gt; {s.input}<span className="caret">_</span></div>
      {s.prompt && <div className="prompt" data-testid="prompt">{s.prompt.text}</div>}
      <div className="hint">F1 set · ENTER add · ORIGIN zero · PART ZERO SET stores machine position (X → Y → Z) · F4 tool tab</div>
    </div>
  );
}

/** NGC-style Tool Offset display (columns per S1 4.16.2). Clicking a cell moves the cursor (simulator convenience). */
export function OffsetScreen() {
  const { state: s, dispatch } = useMachine();
  const page2 = s.cursor.col > 3;
  const first = Math.min(Math.max(1, s.cursor.row - 4), OFFSET_ROWS - 9);
  const rows = Array.from({ length: 10 }, (_, i) => first + i);
  const tool = (n: number) => s.tools.find((t) => t.number === n);
  const cols = page2 ? [...PAGE2_COLS] : P1;
  return (
    <div data-testid="offset-screen">
      <div className="tabs"><span className="tab on">TOOL</span><span className="tab off">WORK (F4)</span>
        <span className="act">Active Tool: <b data-testid="active-tool">{s.activeTool}</b></span></div>
      <table className="off" data-testid="offset-table">
        <thead><tr><th>T</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n} className={n === s.activeTool ? 'actT' : ''}>
              <th>{n}</th>
              {page2
                ? PAGE2_COLS.map((_, i) => (
                    <td key={i} className={s.cursor.row === n && s.cursor.col === 4 + i ? 'cur' : ''} data-testid={`off-${n}-p2-${i}`}
                      onClick={() => dispatch({ type: 'CURSOR_TO', row: n, col: 4 + i })}>
                      {i === 0 ? (tool(n) && HAAS_TYPES.includes(tool(n)!.type) ? tool(n)!.type : 'None') : tool(n)?.pocket ?? '-'}</td>))
                : OFFSET_COLS.map((f, i) => (
                    <td key={f} className={s.cursor.row === n && s.cursor.col === i ? 'cur' : ''} data-testid={`off-${n}-${f}`}
                      onClick={() => dispatch({ type: 'CURSOR_TO', row: n, col: i })}>{f3(s.offsets[n][f])}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inputline" data-testid="input-line">&gt; {s.input}<span className="caret">_</span></div>
      {s.prompt && <div className="prompt" data-testid="prompt">{s.prompt.text}</div>}
      <div className="hint">F1 set · ENTER add · ORIGIN zero · ▶ page {page2 ? 1 : 2} · Setting 40 {UMC500.settings.s40} · 64 {UMC500.settings.s64 ? 'ON' : 'OFF'} · 142 {f3(UMC500.settings.s142)}</div>
    </div>
  );
}

/** Instructor/physical tool setup (truth). Separate from the stored offsets. */
export function ToolLibrary() {
  const { state: s, dispatch } = useMachine();
  const hide = useHideTruth();
  const edit = (number: number, field: 'length' | 'diameter' | 'pocket', v: string) =>
    dispatch({ type: 'EDIT_TOOL', number, patch: { [field]: Number(v) } });
  const num = (t: (typeof s.tools)[0], field: 'length' | 'diameter' | 'pocket', w = 70) => (
    <input key={`${t.number}-${field}-${t[field]}`} defaultValue={t[field]} style={{ width: w }} data-testid={`tool-${t.number}-${field}`}
      disabled={t.number === s.activeTool} onBlur={(e) => edit(t.number, field, e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
  return (
    <div className="tools">
      <div className="label">Tool library — physical tools (simulated tool change retracts Z to 0)</div>
      <table className="lib">
        <thead><tr><th>T</th><th>Tool / holder</th><th>Pkt</th><th>Ø</th><th>L gauge→tip</th><th></th></tr></thead>
        <tbody>
          {s.tools.map((t) => (
            <tr key={t.number} className={t.number === s.activeTool ? 'sel' : ''}>
              <td>T{t.number}</td><td title={t.holder}>{t.name}<div className="small">{t.type} · {t.holder}</div></td>
              <td>{num(t, 'pocket', 38)}</td><td>{num(t, 'diameter', 52)}</td>
              <td>{hide ? <span className="small">hidden</span> : num(t, 'length')}</td>
              <td><button data-testid={`load-T${t.number}`} onClick={() => dispatch({ type: 'TOOL_CHANGE', tool: t.number })}>Load</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Paper touch-off feedback (simulator) and G43 compensation check. */
export function MeasureAndCheck() {
  const { state: s, dispatch } = useMachine();
  const hide = useHideTruth();
  const [z, setZ] = useState(String(s.check.z));
  const gap = referenceGap(s, UMC500);
  const paper = paperState(gap, UMC500);
  const c = g43Check(s, UMC500, s.check.h, s.check.z, s.check.d);
  const sev = (e: number) => (Math.abs(e) < 0.01 ? 'ok' : 'alarm');
  return (
    <div className="tools">
      <div className="label">Touch-off on the part top (reference plane) — paper {UMC500.paperThickness} mm</div>
      <div className="row">
        <span className={'contact ' + paper.replace(/ /g, '')} data-testid="paper">{paper}</span>
        <span className="small">Part centre: X {f3(UMC500.geometry.xAtCentre)} Y {f3(UMC500.geometry.yAtCentre)} · B must be 0</span>
      </div>
      <div className="label">Compensation check: G43 H{s.check.h} Z{f3(s.check.z)} (Z from part top, G54 Z = 0)</div>
      <div className="row">
        <label>H <input data-testid="chk-h" type="number" min={1} max={200} value={s.check.h} onChange={(e) => dispatch({ type: 'SET_CHECK', h: Number(e.target.value) })} /></label>
        <label>D <input data-testid="chk-d" type="number" min={1} max={200} value={s.check.d} onChange={(e) => dispatch({ type: 'SET_CHECK', d: Number(e.target.value) })} /></label>
        <label>Z <input data-testid="chk-z" value={z} onChange={(e) => setZ(e.target.value)} onBlur={() => dispatch({ type: 'SET_CHECK', z: Number(z) })} /></label>
      </div>
      <table className="err" data-testid="err-table">
        <tbody>
          <tr><th>Stored H (geom + wear)</th><td data-testid="chk-stored">{f3(c.storedH)}</td></tr>
          <tr><th>Commanded machine Z</th><td data-testid="chk-machz" className={c.overtravel ? 'alarm' : ''}>{f3(c.machineZ)}{c.overtravel ? ' OVERTRAVEL' : ''}</td></tr>
          <tr><th>Programmed tip (from part top)</th><td>{f3(c.programmedTip)}</td></tr>
          {!hide && <>
            <tr><th>Actual tip (from part top)</th><td data-testid="chk-actual" className={c.collision ? 'alarm' : ''}>{f3(c.actualTip)}</td></tr>
            <tr><th>Length error (stored − true)</th><td data-testid="len-err" className={sev(c.lengthError)}>{f3(c.lengthError)}</td></tr>
            <tr><th>Diameter error (Setting 40 DIA)</th><td data-testid="dia-err" className={sev(c.diameterError)}>{f3(c.diameterError)}</td></tr>
          </>}
        </tbody>
      </table>
      {!hide && <div className="small" data-testid="advice">
        {c.collision && <b className="alarm">COLLISION RISK: tip would be {f3(-c.actualTip)} mm below the part top. </b>}
        {c.lengthError > 0.01 && 'H too long (less negative): tip stops ABOVE programmed Z — cuts shallow / air cut. '}
        {c.lengthError < -0.01 && 'H too short (more negative): tip goes BELOW programmed Z — gouge / crash risk. '}
        {Math.abs(c.lengthError) <= 0.01 && 'H matches this tool. '}
      </div>}
    </div>
  );
}
