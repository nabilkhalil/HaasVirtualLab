import { useState } from 'react';
import { UMC500 } from '../config/umc500';
import { DATUM_LABEL, WCS, type DatumType, type PieceId, type Workpiece } from '../config/workholding';
import { coords } from '../engine/coords';
import { g43Check, paperState, referenceGap } from '../engine/tools';
import { blockState, edgeFinder, setupIssues } from '../engine/workholding';
import { useHideTruth, useLesson } from '../store/lessonStore';
import { useMachine } from '../store/machineStore';

const f3 = (v: number) => v.toFixed(3);

function Num({ id, value, onSet, disabled, w = 58 }: { id: string; value: number; onSet: (v: number) => void; disabled?: boolean; w?: number }) {
  return <input key={`${id}-${value}`} data-testid={id} defaultValue={value} disabled={disabled} style={{ width: w }}
    onBlur={(e) => Number(e.target.value) !== value && onSet(Number(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

/** Physical workholding setup (simulator; not a controller screen). */
export function WorkholdingPanel() {
  const { state: s, dispatch } = useMachine();
  const up = (id: PieceId, patch: Partial<Workpiece>) => dispatch({ type: 'UPDATE_PIECE', id, patch });
  const st = s.setup;
  return (
    <div className="tools" data-testid="setup-panel">
      <div className="label">Workholding (unclamp before moving or resizing)</div>
      {st.pieces.map((w) => (
        <div key={w.id} className="piece">
          <div className="row">
            <b>Workpiece {w.id}</b>
            <select data-testid={`mount-${w.id}`} value={w.mount} disabled={w.clamped} onChange={(e) => up(w.id, { mount: e.target.value as Workpiece['mount'] })}>
              <option value="vice">precision vice</option><option value="platter">direct on platter (clamps)</option>
            </select>
            <label><input type="checkbox" checked={w.present} disabled={w.clamped} onChange={(e) => up(w.id, { present: e.target.checked })} />present</label>
            <button data-testid={`clamp-${w.id}`} className={w.clamped ? 'on' : ''} onClick={() => up(w.id, { clamped: !w.clamped })}>{w.clamped ? 'Clamped' : 'Unclamped'}</button>
            <button data-testid={`align-${w.id}`} disabled={w.clamped || w.yaw === 0} onClick={() => up(w.id, { yaw: 0 })}>Align</button>
          </div>
          <div className="row small">
            L×W×H {(['L', 'W', 'H'] as const).map((k, i) => <Num key={k} id={`size-${w.id}-${k}`} value={w.size[i]} disabled={w.clamped} w={46}
              onSet={(v) => { const n = [...w.size] as Workpiece['size']; n[i] = v; up(w.id, { size: n }); }} />)}
            pos X <Num id={`pos-${w.id}-x`} value={w.pos[0]} disabled={w.clamped} w={46} onSet={(v) => up(w.id, { pos: [v, w.pos[1]] })} />
            Y <Num id={`pos-${w.id}-y`} value={w.pos[1]} disabled={w.clamped || w.mount === 'vice'} w={46} onSet={(v) => up(w.id, { pos: [w.pos[0], v] })} />
            yaw° <Num id={`yaw-${w.id}`} value={w.yaw} disabled={w.clamped} w={40} onSet={(v) => up(w.id, { yaw: v })} />
          </div>
        </div>
      ))}
      <div className="row small">
        <label><input type="checkbox" data-testid="parallels" checked={st.parallels} onChange={(e) => dispatch({ type: 'SET_SETUP', patch: { parallels: e.target.checked } })} />parallels in vice</label>
        Z touch: <label><input type="radio" data-testid="touch-paper" checked={st.touch === 'paper'} onChange={() => dispatch({ type: 'SET_SETUP', patch: { touch: 'paper' } })} />paper</label>
        <label><input type="radio" data-testid="touch-block" checked={st.touch === 'block'} onChange={() => dispatch({ type: 'SET_SETUP', patch: { touch: 'block' } })} />gauge block</label>
        t <Num id="gauge-t" value={st.gaugeBlock} w={50} onSet={(v) => dispatch({ type: 'SET_SETUP', patch: { gaugeBlock: v } })} />
      </div>
      <div className="label">Datum selection per work offset (physical datum the offset should point to)</div>
      <table className="lib"><tbody>
        {WCS.map((g) => { const d = st.wcsDatum[g]; const setD = (n: Partial<typeof d>) => dispatch({ type: 'SET_SETUP', patch: { wcsDatum: { ...st.wcsDatum, [g]: { ...d, ...n } } } });
          return <tr key={g}><td>{g}</td>
            <td><select data-testid={`wcspiece-${g}`} value={st.wcsPiece[g]} onChange={(e) => dispatch({ type: 'SET_SETUP', patch: { wcsPiece: { ...st.wcsPiece, [g]: e.target.value as PieceId } } })}>
              <option value="A">Workpiece A</option><option value="B">Workpiece B</option></select></td>
            <td><select data-testid={`datum-${g}`} value={d.type} onChange={(e) => setD({ type: e.target.value as DatumType })}>
              {(Object.keys(DATUM_LABEL) as DatumType[]).map((k) => <option key={k} value={k}>{DATUM_LABEL[k]}</option>)}</select>
              {d.type === 'CUSTOM' && (['dx', 'dy', 'dz'] as const).map((k, i) => <span key={k} className="small"> {k}<Num id={`custom-${g}-${k}`} value={d.custom[i]} w={40}
                onSet={(v) => { const n = [...d.custom] as typeof d.custom; n[i] = v; setD({ custom: n }); }} /></span>)}</td></tr>; })}
      </tbody></table>
      <div className="small">Edge finder tip Ø = T6 diameter in the tool library. Click a workpiece in 3D for quick move/clamp.</div>
      <ul className="small issues" data-testid="setup-issues">{setupIssues(s).map((i) => <li key={i}>⚠ {i}</li>)}</ul>
    </div>
  );
}

/** Coordinate systems, measurement feedback and datum warnings. */
export function CoordPanel() {
  const { state: s } = useMachine();
  const hide = useHideTruth();
  const guided = useLesson((l) => l.lessonId !== null && l.mode === 'guided');
  const [calc, setCalc] = useState(false);
  const c = coords(s, UMC500);
  const w = s.work[s.activeWcs];
  const chk = g43Check(s, UMC500, s.check.h, s.check.z, s.check.d);
  const gap = referenceGap(s, UMC500);
  const touch = s.setup.touch === 'block' ? blockState(gap, s.setup.gaugeBlock) : paperState(gap, UMC500);
  const ef = edgeFinder(s, UMC500);
  const warn: string[] = [];
  if (w.X > 0 || w.Y > 0) warn.push(`${s.activeWcs} X/Y should be negative from machine zero (S1)`);
  if (chk.doubleApplied) warn.push(`${s.activeWcs} Z is nonzero while H${s.check.h} is a part-top length: tool offset applied twice (S1 caution)`);
  if (!hide) for (const a of ['X', 'Y'] as const) {
    const d = w[a] - c.truth[a];
    if (Math.abs(d) > 0.05) warn.push(`${s.activeWcs} ${a} differs from the physical datum (${c.truth.piece.id}) by ${f3(d)}`);
  }
  if (!hide && Math.abs(chk.combinedError) > 0.05) warn.push(`Z: tip would be ${f3(chk.combinedError)} from programmed (work Z + H)`);
  const rows: [string, { X: number; Y: number; Z: number }, string][] = [
    ['Machine', c.machine, 'mach'], [`Work ${s.activeWcs}`, c.work, 'work'], [`Programmed (G43 H${s.check.h})`, c.programmed, 'prog'],
    ...(hide ? [] : [['Actual tip vs datum', c.tip, 'tip'] as [string, { X: number; Y: number; Z: number }, string]]),
  ];
  return (
    <div className="tools" data-testid="coord-panel">
      <div className="row">
        <span className={'contact ' + touch.replace(/[ ']/g, '')} data-testid="touch-state">{touch}</span>
        {ef.state !== 'NOT AN EDGE FINDER' && <span className={'contact EF' + ef.state.replace(/[ -]/g, '')} data-testid="edge-state">EDGE FINDER: {ef.state}</span>}
        <label className="small"><input type="checkbox" checked={calc || guided} onChange={(e) => setCalc(e.target.checked)} />calculations</label>
      </div>
      <table className="err coords">
        <thead><tr><th></th><th>X</th><th>Y</th><th>Z</th></tr></thead>
        <tbody>{rows.map(([n, v, id]) => <tr key={id}><th>{n}</th>{(['X', 'Y', 'Z'] as const).map((a) => <td key={a} data-testid={`c-${id}-${a}`}>{f3(v[a])}</td>)}</tr>)}</tbody>
      </table>
      {(calc || guided) && <ul className="small calc" data-testid="calc">{c.breakdown.slice(0, hide ? 3 : 5).map((b) => <li key={b}>{b}</li>)}
        {ef.state === 'KICKED' && <li>Edge = contact position ± tip radius {f3(ef.r!)} (add radius when approaching from −X/−Y)</li>}
        {s.setup.touch === 'block' && <li>Z at part top = Z at block contact − block {f3(s.setup.gaugeBlock)}</li>}</ul>}
      {warn.length > 0 && <ul className="small issues" data-testid="datum-warnings">{warn.map((x) => <li key={x}>⚠ {x}</li>)}</ul>}
    </div>
  );
}
