import { useRef, useState } from 'react';
import { UMC500 } from '../config/umc500';
import { FACES } from '../engine/machine';
import { ctrlMrzp, ctrlPivots, ctrlTarget, estimateMrzp, machineFor, positionReport, requiredBC, rotate, tcpcPaths, trueMrzp, truePivots, workPoint0, type V3 } from '../engine/fiveaxis';
import { r3 } from '../engine/tools';
import { piece, pieceBottom } from '../engine/workholding';
import { useFive } from '../store/fiveStore';
import { useHideTruth } from '../store/lessonStore';
import { useMachine } from '../store/machineStore';
import { explain } from '../engine/explain';

const f3 = (v: number) => v.toFixed(3);
const V = (v: V3) => v.map(f3).join(' / ');
function NumIn({ id, value, onSet, w = 56 }: { id: string; value: number; onSet: (v: number) => void; w?: number }) {
  return <input key={`${id}-${value}`} data-testid={id} defaultValue={value} style={{ width: w }}
    onBlur={(e) => Number(e.target.value) !== value && Number.isFinite(Number(e.target.value)) && onSet(Number(e.target.value))}
    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

/** Five-axis lab: simulated MDI for G254/G255/G234/G43 and rotary positioning (real MDI parser: Phase 6). */
export function FiveAxisPanel() {
  const { state: s, dispatch } = useMachine();
  const five = useFive();
  const hide = useHideTruth();
  const [rot, setRot] = useState({ B: 0, C: 0 });
  const [h, setH] = useState(s.check.h);
  const timer = useRef<number | null>(null);
  const w = five.point;
  const rep = positionReport(s, UMC500, s.lastPoint ?? w);
  const tm = trueMrzp(UMC500), cm = ctrlMrzp(s, UMC500);
  const est = estimateMrzp(s.mrzpHits);
  const req = requiredBC(FACES[five.face], UMC500);
  // Tool access: Z needed to put the tip 5 mm off the oriented face centre of workpiece A.
  const A = piece(s, 'A');
  const n = FACES[five.face], fc: V3 = [A.pos[0] + n[0] * A.size[0] / 2, A.pos[1] + n[1] * A.size[1] / 2, pieceBottom(s, A) + A.size[2] / 2 + n[2] * A.size[2] / 2];
  const fw = req ? rotate(fc, req.B, req.C, truePivots(UMC500)) : null;
  const accessZ = fw ? machineFor(s, UMC500, [fw[0], fw[1], fw[2] + 5])[2] : null;
  const paths = tcpcPaths(s, UMC500, five.demo);
  const animate = (on: boolean) => {
    if (timer.current) window.clearInterval(timer.current);
    let i = 0; const N = 30, d = five.demo;
    five.set({ showPaths: true });
    timer.current = window.setInterval(() => {
      const st = useMachine.getState().state, t = i / N;
      const B = d.B[0] + (d.B[1] - d.B[0]) * t, C = d.C[0] + (d.C[1] - d.C[0]) * t;
      const q: V3 = d.from.map((v, k) => v + (d.to[k] - v) * t) as V3;
      const stB = { ...st, machine: { ...st.machine, B, C } };
      const tip = on ? ctrlTarget(stB, UMC500, q, 'G234') : workPoint0(stB, UMC500, q);
      const [X, Y, Z] = machineFor(stB, UMC500, tip);
      dispatch({ type: 'INTERP', to: { X, Y, Z, B: r3(B), C: r3(C) } });
      if (++i > N || useMachine.getState().state.message.startsWith('Interpolation stopped')) { window.clearInterval(timer.current!); timer.current = null; }
    }, 60);
  };
  return (
    <div className="tools" data-testid="five-panel">
      <div className="msg" data-testid="five-message">{s.alarms.map((x) => `${x.code} ${x.text}`).join(' | ')} {s.message}</div>
      {explain(s.message) && <div className="why">Why: {explain(s.message)}</div>}
      <div className="small">Machine X {f3(s.machine.X)} Y {f3(s.machine.Y)} Z {f3(s.machine.Z)} · Work X {f3(s.machine.X - s.work[s.activeWcs].X)} Y {f3(s.machine.Y - s.work[s.activeWcs].Y)}</div>
      <div className="label">Status · mode {s.mode} · {s.comp === 'G254' ? 'G254 DWO' : s.comp === 'G234' ? 'G234 TCPC' : 'G43'} H{s.check.h} · {s.activeWcs} · B {f3(s.machine.B)}° C {f3(s.machine.C)}°</div>

      <div className="label">Simulated MDI (Phase 6 adds the real MDI parser)</div>
      <div className="row small">
        B <NumIn id="rot-B" value={rot.B} w={48} onSet={(v) => setRot({ ...rot, B: v })} /> C <NumIn id="rot-C" value={rot.C} w={48} onSet={(v) => setRot({ ...rot, C: v })} />
        <button data-testid="mdi-rotate" onClick={() => dispatch({ type: 'MDI_ROTATE', ...rot })}>G00 B C</button>
        <button data-testid="mdi-rotate-check" onClick={() => dispatch({ type: 'MDI_ROTATE', ...rot, dryRun: true })}>Check sweep</button>
      </div>
      <div className="row small">
        <button data-testid="mdi-g254" className={s.comp === 'G254' ? 'on' : ''} onClick={() => dispatch({ type: 'MDI', cmd: 'G254' })}>G254 DWO</button>
        <button data-testid="mdi-g255" onClick={() => dispatch({ type: 'MDI', cmd: 'G255' })}>G255</button>
        H <NumIn id="mdi-h" value={h} w={40} onSet={setH} />
        <button data-testid="mdi-g234" className={s.comp === 'G234' ? 'on' : ''} onClick={() => dispatch({ type: 'MDI', cmd: 'G234', h })}>G234 H TCPC</button>
        <button data-testid="mdi-g43" onClick={() => dispatch({ type: 'MDI', cmd: 'G43', h })}>G43 H</button>
      </div>
      <div className="row small">
        Point X Y Z {([0, 1, 2] as const).map((i) => <NumIn key={i} id={`pt-${'xyz'[i]}`} value={w[i]} w={52} onSet={(v) => { const p = [...w] as V3; p[i] = v; five.set({ point: p }); }} />)}
        <button data-testid="mdi-move" onClick={() => dispatch({ type: 'MDI_MOVE', w })}>G00 to point</button>
        <button data-testid="mdi-move-check" onClick={() => dispatch({ type: 'MDI_MOVE', w, dryRun: true })}>Check</button>
      </div>
      <table className="err coords" data-testid="five-report"><tbody>
        <tr><th>Programmed (work)</th><td>{V(s.lastPoint ?? w)}</td></tr>
        <tr><th>Controller target (scene)</th><td>{V(rep.target)}</td></tr>
        {!hide && <tr><th>Part point now (truth)</th><td>{V(rep.phys)}</td></tr>}
        {!hide && <tr><th>Tip − part point</th><td data-testid="five-err" className={rep.mag > 0.01 ? 'alarm' : 'ok'}>{V(rep.err)} (|e| {f3(rep.mag)})</td></tr>}
      </tbody></table>
      {!hide && <div className="small calc">{s.comp === 'G43' && (s.machine.B || s.machine.C) ? 'G43 only: the controller ignores the rotation, so programmed coordinates still point to where the part was at B0 C0.' : s.comp === 'G254' ? 'G254: controller rotates the work coordinate system about its MRZP (settings 255–257).' : s.comp === 'G234' ? 'G234: the tool tip follows the table-fixed coordinate system during rotary motion.' : 'At B0 C0 work coordinates are unrotated.'}</div>}

      <div className="label">3+2 positional machining (workpiece A)</div>
      <div className="row small">
        <select data-testid="face-select" value={five.face} onChange={(e) => five.set({ face: e.target.value })}>
          {Object.keys(FACES).map((f) => <option key={f}>{f}</option>)}</select>
        <span data-testid="face-req">{req ? `needs B${req.B} C${req.C}` : 'not reachable within B −35..+120'}</span>
        <span className={accessZ !== null && accessZ >= UMC500.limits.Z.min ? 'ok' : 'alarm'}>tool access {accessZ === null ? '—' : accessZ >= UMC500.limits.Z.min ? 'OK' : 'Z over travel'}</span>
        <button data-testid="face-rotate" disabled={!req} onClick={() => req && dispatch({ type: 'MDI_ROTATE', B: req.B, C: req.C })}>Rotate to face</button>
        <button data-testid="face-confirm" onClick={() => dispatch({ type: 'CONFIRM_FACE', face: five.face })}>Confirm</button>
      </div>
      <div className="small">Done: {s.faceLog.join(', ') || '—'} · 3-axis: one re-fixture + datum per face ({Object.keys(FACES).length} setups, inclined face needs an angle fixture) · 3+2: one setup.</div>

      <div className="label">MRZP (simulated settings 255–257 — never the machine's)</div>
      <table className="err coords"><tbody>
        <tr><th></th><th>255 X</th><th>256 Y</th><th>257 Z</th></tr>
        <tr><th>Controller</th><td data-testid="mrzp-ctrl">{f3(cm.X)}</td><td>{f3(cm.Y)}</td><td>{f3(cm.Z)}</td></tr>
        {!hide && <tr><th>True centre</th><td>{f3(tm.X)}</td><td>{f3(tm.Y)}</td><td>{f3(tm.Z)}</td></tr>}
        <tr><th>Calib. error</th>{(['X', 'Y', 'Z'] as const).map((k) => <td key={k}><NumIn id={`mrzp-err-${k}`} value={s.mrzpError[k]} w={50} onSet={(v) => dispatch({ type: 'SET_MRZP_ERROR', [k]: v })} /></td>)}</tr>
      </tbody></table>
      <div className="row small">
        <label><input type="checkbox" data-testid="sphere-toggle" checked={s.setup.sphere} onChange={(e) => dispatch({ type: 'SET_SETUP', patch: { sphere: e.target.checked } })} />calibration sphere</label>
        <button data-testid="probe-sphere" onClick={() => dispatch({ type: 'PROBE_SPHERE' })}>Probe sphere</button>
        <button data-testid="apply-mrzp" onClick={() => dispatch({ type: 'APPLY_MRZP' })}>Apply estimate</button>
        <button onClick={() => dispatch({ type: 'CLEAR_HITS' })}>Clear</button>
        <label><input type="checkbox" checked={five.showPivots} onChange={(e) => five.set({ showPivots: e.target.checked })} />rotary centres</label>
      </div>
      <ul className="small calc" data-testid="mrzp-hits">{s.mrzpHits.map((h) => <li key={`${h.B}-${h.C}`}>B{h.B} C{h.C}: X{f3(h.X)} Y{f3(h.Y)} Z{f3(h.Z)}</li>)}
        {est && <li data-testid="mrzp-est">Estimate: X{f3(est.X)} Y{f3(est.Y)} Z{f3(est.Z)} (C centre from C0/C180, B centre from B0/B{s.mrzpHits.find((x) => Math.abs(x.B) > 1)?.B})</li>}</ul>

      <div className="label">TCPC trajectory demo (G234 on vs off) — line {V(five.demo.from)} → {V(five.demo.to)}, B {five.demo.B.join('→')}°</div>
      <div className="row small">
        B end <NumIn id="demo-B1" value={five.demo.B[1]} w={44} onSet={(v) => five.set({ demo: { ...five.demo, B: [five.demo.B[0], v] } })} />
        C end <NumIn id="demo-C1" value={five.demo.C[1]} w={44} onSet={(v) => five.set({ demo: { ...five.demo, C: [five.demo.C[0], v] } })} />
        <button data-testid="tcpc-on" onClick={() => animate(true)}>Animate TCPC on</button>
        <button data-testid="tcpc-off" onClick={() => animate(false)}>Animate TCPC off</button>
        <label><input type="checkbox" checked={five.showPaths} onChange={(e) => five.set({ showPaths: e.target.checked })} />paths</label>
      </div>
      {!hide && <div className="small" data-testid="tcpc-dev">Max tip deviation from the programmed line: TCPC on {f3(paths.devOn)} mm · off {f3(paths.devOff)} mm{ctrlPivots(s, UMC500).bx !== truePivots(UMC500).bx ? ' (on ≠ 0 because of the MRZP error)' : ''}</div>}
    </div>
  );
}
