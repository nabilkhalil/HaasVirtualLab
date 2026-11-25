import { describe, expect, it } from 'vitest';
import { UMC500 as P } from '../../src/config/umc500';
import { initialState, reduce, FACES, type Action, type Key, type MachineState } from '../../src/engine/machine';
import { ctrlPivots, estimateMrzp, positionReport, probeSphere, requiredBC, rotate, sphereWorld, tcpcPaths, trueMrzp, truePivots, unrotate, type V3 } from '../../src/engine/fiveaxis';
import { idealHFor, platterToWorld, r3 } from '../../src/engine/tools';
import { trueWork } from '../../src/engine/workholding';

const run = (acts: Action[], s: MachineState = initialState(P)) => acts.reduce((st, a) => reduce(st, a, P), s);
const K = (...ks: Key[]): Action[] => ks.map((key) => ({ type: 'KEY', key }));
const close = (a: number[], b: number[], tol = 1e-6) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(tol));
const g = P.geometry, piv = truePivots(P);

/** G54 at top centre of A, all H measured to A top, pointer T7 loaded. */
function dwoSetup(): MachineState {
  let s = initialState(P);
  s = { ...s, activeTool: 7, check: { h: 7, d: 7, z: 5 }, setup: { ...s.setup, wcsDatum: { ...s.setup.wcsDatum, G54: { type: 'TC', custom: [0, 0, 0] } } } };
  const t = trueWork(s, P, 'G54');
  return run([{ type: 'SET_OFFSET', n: 7, field: 'hGeom', value: idealHFor(s, s.tools[6], P), mode: 'set' }, ...K('Y'),
    { type: 'SET_WORK', wcs: 'G54', axis: 'X', value: t.X }, { type: 'SET_WORK', wcs: 'G54', axis: 'Y', value: t.Y }], s);
}

describe('B/C transformation mathematics', () => {
  it('rotate/unrotate are inverse; hierarchy matches the scene transform', () => {
    const p: V3 = [12, -34, 56];
    close(unrotate(rotate(p, 37, 211, piv), 37, 211, piv), p);
    const s = { ...initialState(P), machine: { ...initialState(P).machine, B: 37, C: 211 } };
    close(rotate(p, 37, 211, piv), platterToWorld(p, s, P), 0.001);
  });
  it('pivot accuracy: points on the B axis and C axis are invariant', () => {
    close(rotate([piv.bx, 77, piv.bz], 90, 0, piv), [piv.bx, 77, piv.bz]);
    close(rotate([piv.cx, piv.cy, 40], 0, 123, piv), [piv.cx, piv.cy, 40]);
  });
  it('B is about Y: +90 maps +Z to +X (sense unverified, documented)', () => {
    close(rotate([0, 0, 100], 90, 0, piv), [100, 0, 0], 1e-9);
  });
  it('MRZP values follow settings 255-257 definition', () => {
    expect(trueMrzp(P)).toEqual({ X: g.xAtCentre, Y: g.yAtCentre, Z: -g.gaugeLineAtZ0 - g.trunnionPivotBelowPlatter });
  });
});

describe('rotary travel, alarms and zero return', () => {
  it('B jog limits -35..+120 (S3)', () => {
    expect(run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'B', direction: -1, steps: 36 }]).machine.B).toBe(0);
    expect(run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'B', direction: -1, steps: 35 }]).machine.B).toBe(-35);
  });
  it('MDI rotation beyond limits raises a rotary limit alarm cleared by RESET', () => {
    const s = run([{ type: 'MDI_ROTATE', B: 130 }]);
    expect(s.alarms[0].code).toBe('SIM-ROTARY-LIMIT');
    expect(run([{ type: 'RESET' }], s).alarms).toHaveLength(0);
  });
  it('ZERO RETURN + ALL / SINGLE', () => {
    let s = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'X', direction: -1, steps: 50 }, { type: 'JOG', axis: 'B', direction: 1, steps: 20 }, { type: 'JOG', axis: 'C', direction: 1, steps: 45 }]);
    expect(run(K('ALL'), s).message).toMatch(/ZERO RETURN/);
    const one = run([{ type: 'SELECT_AXIS', axis: 'C' }, ...K('ZERO_RETURN', 'SINGLE')], s);
    expect(one.machine).toMatchObject({ C: 0, B: 20, X: -50 });
    s = run(K('ZERO_RETURN', 'ALL'), s);
    expect(s.machine).toMatchObject({ X: 0, Y: 0, Z: 0, B: 0, C: 0 });
    expect(run([{ type: 'JOG', axis: 'X', direction: -1 }], s).message).toMatch(/HANDLE JOG/);
    expect(run([...K('HANDLE_JOG'), { type: 'JOG', axis: 'X', direction: -1 }], s).machine.X).toBe(-1);
  });
});

describe('DWO G254 (S2 rules and accuracy)', () => {
  it('compensates a rotated part; without DWO the tip misses', () => {
    let s = run([{ type: 'MDI_ROTATE', C: 90 }, { type: 'MDI_ROTATE', B: 30 }], dwoSetup());
    const off = run([{ type: 'MDI', cmd: 'G43', h: 7 }, { type: 'MDI_MOVE', w: [20, 10, 5] }], s);
    expect(positionReport(off, P, [20, 10, 5]).mag).toBeGreaterThan(5);
    s = run([{ type: 'MDI', cmd: 'G254' }, { type: 'MDI_MOVE', w: [20, 10, 5] }], s);
    expect(s.comp).toBe('G254');
    expect(positionReport(s, P, [20, 10, 5]).mag).toBeLessThanOrEqual(0.002);
  });
  it('restrictions: B work offset must be 0; no rotary motion; HANDLE JOG / RESET cancel', () => {
    expect(run([{ type: 'SET_WORK', wcs: 'G54', axis: 'B', value: 5 }, { type: 'MDI', cmd: 'G254' }]).comp).toBe('G43');
    const d = run([{ type: 'MDI', cmd: 'G254' }]);
    expect(run([{ type: 'MDI_ROTATE', B: 10 }], d).message).toMatch(/G255 before ANY rotary/);
    expect(run(K('HANDLE_JOG'), d).comp).toBe('G43');
    expect(run([{ type: 'RESET' }], d).comp).toBe('G43');
    expect(run([{ type: 'ESTOP_PRESS' }], d).comp).toBe('G43');
    expect(run([{ type: 'MDI', cmd: 'G255' }], d).comp).toBe('G43');
  });
});

describe('TCPC G234 (S2 rules and accuracy)', () => {
  it('needs H on the block, cancels G43, cannot combine with G254', () => {
    expect(run([{ type: 'MDI', cmd: 'G234' }]).comp).toBe('G43');
    const t = run([{ type: 'MDI', cmd: 'G234', h: 7 }]);
    expect(t.comp).toBe('G234');
    expect(run([{ type: 'MDI', cmd: 'G254' }], t).comp).toBe('G234');
    expect(run([{ type: 'MDI', cmd: 'G234', h: 7 }], run([{ type: 'MDI', cmd: 'G254' }])).comp).toBe('G254');
    expect(run([{ type: 'MDI', cmd: 'G43', h: 7 }], t).comp).toBe('G43');
  });
  it('keeps the tool tip on the work point while rotating', () => {
    let s = run([{ type: 'MDI', cmd: 'G234', h: 7 }, { type: 'MDI_MOVE', w: [0, 0, 30] }], dwoSetup());
    s = run([{ type: 'MDI_ROTATE', B: 20 }], s);
    expect(s.machine.B).toBe(20);
    expect(positionReport(s, P, [0, 0, 30]).mag).toBeLessThanOrEqual(0.002);
  });
  it('trajectory: TCPC on follows the programmed line, off deviates', () => {
    const d = tcpcPaths(dwoSetup(), P, { from: [-40, 0, 10], to: [40, 0, 10], B: [0, 30], C: [0, 0] });
    expect(d.devOn).toBeLessThanOrEqual(0.001);
    expect(d.devOff).toBeGreaterThan(10);
  });
});

describe('MRZP error propagation and simulated calibration', () => {
  it('controller MRZP error shifts DWO positioning when rotated, not at B0 C0', () => {
    const s = run([{ type: 'SET_MRZP_ERROR', X: 0.5, Z: -0.3 }], dwoSetup());
    expect(ctrlPivots(s, P)).toMatchObject({ bx: 0.5, bz: -0.3 });
    const at0 = run([{ type: 'MDI', cmd: 'G254' }, { type: 'MDI_MOVE', w: [0, 0, 5] }], s);
    expect(positionReport(at0, P, [0, 0, 5]).mag).toBeLessThanOrEqual(0.002);
    const rot = run([{ type: 'MDI_ROTATE', B: 45 }, { type: 'MDI', cmd: 'G254' }, { type: 'MDI_MOVE', w: [0, 0, 5] }], s);
    expect(rot.alarms).toHaveLength(0);
    const e = positionReport(rot, P, [0, 0, 5]).mag;
    expect(e).toBeCloseTo(2 * Math.sin(Math.PI / 8) * Math.hypot(0.5, 0.3), 2);
    expect(run([{ type: 'MDI_ROTATE', B: 90 }, { type: 'MDI', cmd: 'G254' }, { type: 'MDI_MOVE', w: [0, 0, 5] }], s).alarms[0]?.code).toBe('SIM-OVERTRAVEL');
  });
  it('sphere measurements recover the true MRZP; APPLY corrects the simulated settings', () => {
    let s = { ...run([{ type: 'SET_MRZP_ERROR', X: 0.4, Y: -0.2, Z: 0.3 }]), activeTool: 5, setup: { ...initialState(P).setup, sphere: true } };
    for (const [B, C] of [[0, 0], [0, 180], [90, 0]]) {
      const st = { ...s, machine: { ...s.machine, B, C } };
      const c = sphereWorld(st, P);
      st.machine = { ...st.machine, X: r3(c[0] + g.xAtCentre), Y: r3(c[1] + g.yAtCentre), Z: r3(c[2] + 12.7 + 8 - 3 + 120 - g.gaugeLineAtZ0) };
      expect(typeof probeSphere(st, P)).toBe('object');
      s = run([{ type: 'PROBE_SPHERE' }], st);
    }
    const est = estimateMrzp(s.mrzpHits)!;
    expect(est.X).toBeCloseTo(trueMrzp(P).X, 3);
    expect(est.Z).toBeCloseTo(trueMrzp(P).Z, 3);
    expect(est.Y).toBeCloseTo(trueMrzp(P).Y, 3);
    s = run([{ type: 'APPLY_MRZP' }], s);
    expect(s.mrzpError).toEqual({ X: 0, Y: 0, Z: 0 });
  });
});

describe('3+2 faces and swept collisions', () => {
  it('required B/C bring each face normal to the spindle axis within limits', () => {
    for (const [name, n] of Object.entries(FACES)) {
      const r = requiredBC(n, P)!;
      expect(r).not.toBeNull();
      close(rotate(n, r.B, r.C, { bx: 0, bz: 0, cx: 0, cy: 0 }), [0, 0, 1], 1e-6);
      expect(r.B).toBeGreaterThanOrEqual(-35); expect(r.B).toBeLessThanOrEqual(120);
      void name;
    }
    expect(requiredBC(FACES.Inclined, P)!.B).toBe(-30);
    expect(requiredBC([-1, 0, 0], P)!.B).toBe(90); // -X face: via C180 then B90
  });
  it('CONFIRM_FACE only when oriented', () => {
    const r = requiredBC(FACES.Front, P)!;
    expect(run([{ type: 'CONFIRM_FACE', face: 'Front' }]).faceLog).toEqual([]);
    expect(run([{ type: 'MDI_ROTATE', B: r.B, C: r.C }, { type: 'CONFIRM_FACE', face: 'Front' }]).faceLog).toEqual(['Front']);
  });
  it('rotating the part into a low tool is detected mid-sweep (swept, not end-point)', () => {
    let s = run([{ type: 'TOOL_CHANGE', tool: 4 }, { type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'X', direction: -1, steps: -g.xAtCentre + 140 },
      { type: 'JOG', axis: 'Y', direction: -1, steps: -g.yAtCentre }, { type: 'JOG', axis: 'Z', direction: -1, steps: 250 }]);
    expect(s.message).toBe('');
    const chk = run([{ type: 'MDI_ROTATE', B: 90, dryRun: true }], s);
    expect(chk.message).toMatch(/check: .*would hit/);
    expect(chk.machine.B).toBe(0);
    s = run([{ type: 'JOG', axis: 'B', direction: 1, steps: 90 }], s);
    expect(s.machine.B).toBe(0);
    expect(s.stats.collisions).toBe(1);
  });
});
