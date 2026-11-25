import { describe, expect, it } from 'vitest';
import { UMC500 as P } from '../../src/config/umc500';
import { initialState, reduce, type Action, type Key, type MachineState } from '../../src/engine/machine';
import { g43Check, idealHFor, r3 } from '../../src/engine/tools';
import { blockState, datumLocal, edgeFinder, piece, pieceTop, setupIssues, trueWork } from '../../src/engine/workholding';
import { coords } from '../../src/engine/coords';

const run = (acts: Action[], s: MachineState = initialState(P)) => acts.reduce((st, a) => reduce(st, a, P), s);
const K = (...ks: Key[]): Action[] => ks.map((key) => ({ type: 'KEY', key }));
const g = P.geometry;
/** Jog (1 mm then 0.001 mm) to an absolute machine position. */
function jogTo(s: MachineState, axis: 'X' | 'Y' | 'Z', target: number): MachineState {
  const d = r3(target - s.machine[axis]);
  const whole = Math.trunc(d), frac = Math.round((d - whole) * 1000);
  return run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis, direction: whole < 0 ? -1 : 1, steps: Math.abs(whole) },
    { type: 'SET_INCREMENT', increment: 0.001 }, { type: 'JOG', axis, direction: frac < 0 ? -1 : 1, steps: Math.abs(frac) }], s);
}
const workTab: Action[] = K('OFFSET', 'F4');
const A = (s: MachineState) => piece(s, 'A');

describe('work offset display keys (S1)', () => {
  it('F4 toggles tabs; F1 sets; ENTER adds; ORIGIN zeroes; cursor clamps', () => {
    let s = run([...workTab, ...K('-', '2', '.', '5', 'F1')]);
    expect(s.offsetTab).toBe('WORK');
    expect(s.work.G54.X).toBe(-2.5);
    s = run(K('RIGHT', '-', '1', 'ENTER', 'ENTER'), s); // second ENTER with empty input does nothing
    expect(s.work.G54.Y).toBe(-1);
    s = run(K('-', '3', 'ENTER'), s);
    expect(s.work.G54.Y).toBe(-4);
    s = run(K('ORIGIN', 'DOWN', 'DOWN', 'PAGE_DOWN', 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT'), s);
    expect(s.work.G54.Y).toBe(0);
    expect(s.workCursor).toEqual({ row: 5, col: 4 });
    expect(run(K('F4'), s).offsetTab).toBe('TOOL');
  });
  it('PART ZERO SET stores machine position X then Y then Z (with caution)', () => {
    let s = jogTo(jogTo(initialState(P), 'X', -355), 'Y', -243);
    s = run([...workTab, ...K('PART_ZERO_SET', 'Y', 'PART_ZERO_SET', 'Y')], s);
    expect(s.work.G54).toMatchObject({ X: -355, Y: -243, Z: 0 });
    expect(s.workCursor.col).toBe(2);
    s = run(K('PART_ZERO_SET'), s);
    expect(s.message).toMatch(/CAUTION/);
    expect(run(K('PART_ZERO_SET'), initialState(P)).message).toMatch(/WORK offset tab/);
  });
  it('Setting 142 prompt on work offsets; N keeps old value', () => {
    const s = run([...workTab, ...K('-', '1', '0', '0', 'F1')]);
    expect(s.prompt?.kind).toBe('work');
    expect(run(K('N'), s).work.G54.X).toBe(0);
  });
  it('G54-G59 switching changes WORK coordinates', () => {
    let s = run([{ type: 'SET_WORK', wcs: 'G54', axis: 'X', value: -300 }, { type: 'SET_WORK', wcs: 'G55', axis: 'X', value: -200 }]);
    s = jogTo(s, 'X', -250);
    expect(coords(s, P).work.X).toBe(50);
    s = run([{ type: 'SET_WCS', wcs: 'G55' }], s);
    expect(coords(s, P).work.X).toBe(-50);
    expect(s.machine.X).toBe(-250);
  });
  it('positive and negative work offset values accepted within range', () => {
    const s = run([{ type: 'SET_WORK', wcs: 'G56', axis: 'X', value: 12.5 }, { type: 'SET_WORK', wcs: 'G56', axis: 'Y', value: -12.5 }]);
    expect(s.work.G56).toMatchObject({ X: 12.5, Y: -12.5 });
    expect(run([{ type: 'SET_WORK', wcs: 'G56', axis: 'X', value: 5000 }]).work.G56.X).toBe(0);
  });
});

describe('workholding and datums', () => {
  it('default datum TFL of A: machine X/Y and top height', () => {
    const t = trueWork(initialState(P), P, 'G54');
    expect(t).toMatchObject({ X: -50 + g.xAtCentre, Y: -40 + g.yAtCentre, datumZ: 110 });
  });
  it('datum selection: TFR, TC, BC, custom', () => {
    const set = (d: string, custom = [0, 0, 0]) => {
      const s = initialState(P);
      return datumLocal(s, A(s), { type: d as never, custom: custom as never });
    };
    expect(set('TFR')).toEqual([50, -40, 110]);
    expect(set('TC')).toEqual([0, 0, 110]);
    expect(set('BC')).toEqual([0, 0, 60]);
    expect(set('CUSTOM', [10, 5, -2])).toEqual([-40, -35, 108]);
  });
  it('moving/resizing requires unclamping; parallels change top; interference rejected', () => {
    expect(run([{ type: 'UPDATE_PIECE', id: 'A', patch: { pos: [10, 0] } }]).message).toMatch(/Unclamp/);
    let s = run([{ type: 'UPDATE_PIECE', id: 'A', patch: { clamped: false } }, { type: 'UPDATE_PIECE', id: 'A', patch: { pos: [10, 0], size: [100, 80, 40] } }]);
    expect(A(s).pos).toEqual([10, 0]);
    s = run([{ type: 'SET_SETUP', patch: { parallels: false } }], s);
    expect(pieceTop(s, A(s))).toBe(80);
    expect(setupIssues(s).join()).toMatch(/above the jaws/);
    const bad = run([{ type: 'UPDATE_PIECE', id: 'B', patch: { clamped: false } }, { type: 'UPDATE_PIECE', id: 'B', patch: { pos: [0, -80] } }]);
    expect(bad.message).toMatch(/interferes|overhangs/);
    expect(piece(bad, 'B').pos).toEqual([0, -150]);
  });
  it('misalignment is reported and moves the datum', () => {
    const s = run([{ type: 'UPDATE_PIECE', id: 'A', patch: { clamped: false } }, { type: 'UPDATE_PIECE', id: 'A', patch: { yaw: 0.5 } }]);
    expect(setupIssues(s).join()).toMatch(/misaligned/);
    expect(trueWork(s, P, 'G54').X).not.toBe(-355);
  });
});

describe('edge finder radius correction', () => {
  const ef = (s: MachineState) => run([{ type: 'TOOL_CHANGE', tool: 6 }], s);
  const tipZ = (s: MachineState, above: number) => r3(above - 5 + 85 - g.gaugeLineAtZ0); // tip 5 mm below `above`
  it('X: kick at edge - r; datum = Xm + r via PART ZERO SET then ENTER', () => {
    let s = ef(initialState(P));
    s = jogTo(jogTo(s, 'Y', -203), 'X', -355 - 10);
    s = jogTo(s, 'Z', tipZ(s, 110));
    expect(edgeFinder(s, P).state).toBe('RUNNING TRUE');
    s = jogTo(s, 'X', -355 - 3);
    expect(edgeFinder(s, P).state).toBe('KICKED');
    s = run([...workTab, ...K('PART_ZERO_SET', 'Y', 'LEFT', '3', 'ENTER')], s);
    expect(s.work.G54.X).toBe(-355);
    s = jogTo(s, 'X', -355 - 2.5);
    expect(edgeFinder(s, P).state).toBe('OVER-TRAVELLED');
    const hit = jogTo(s, 'X', -355 - 1.5);
    expect(hit.machine.X).toBe(-357.5);
    expect(hit.stats.collisions).toBe(1);
  });
  it('Y front face above the moving jaw', () => {
    let s = ef(initialState(P));
    s = jogTo(jogTo(s, 'X', -305), 'Y', -243 - 10);
    s = jogTo(s, 'Z', tipZ(s, 110));
    s = jogTo(s, 'Y', -243 - 3);
    expect(edgeFinder(s, P).state).toBe('KICKED');
  });
  it('unclamped workpiece cannot be touched', () => {
    let s = ef(run([{ type: 'UPDATE_PIECE', id: 'A', patch: { clamped: false } }]));
    s = jogTo(jogTo(s, 'Y', -203), 'X', -365);
    s = jogTo(s, 'Z', tipZ(s, 110));
    const t = jogTo(s, 'X', -356.5);
    expect(t.message).toMatch(/not clamped/);
    expect(t.stats.collisions).toBeGreaterThan(0);
  });
});

describe('Z setting: gauge block, reference tool, double application', () => {
  const T1 = () => initialState(P).tools[0];
  it('gauge block states and thickness correction', () => {
    expect(blockState(25.005, 25)).toBe('BLOCK DRAGS');
    expect(blockState(25.5, 25)).toBe('BLOCK PASSES');
    expect(blockState(24.9, 25)).toBe("BLOCK WON'T FIT");
    let s = run([{ type: 'SET_SETUP', patch: { touch: 'block', gaugeBlock: 25 } }]);
    s = jogTo(jogTo(s, 'X', -305), 'Y', -203);
    const zm = r3(110 + 25 + T1().length - g.gaugeLineAtZ0);
    s = jogTo(s, 'Z', zm);
    // reference tool method: G54 Z = Zm - block, H1 = 0
    s = run([...workTab, { type: 'KEY', key: 'RIGHT' }, { type: 'KEY', key: 'RIGHT' }, ...K('PART_ZERO_SET', 'Y', '-', '2', '5', 'ENTER', 'Y')], s);
    expect(s.work.G54.Z).toBe(r3(zm - 25));
    const c = g43Check(s, P, 1, 5);
    expect(c.combinedError).toBe(0);
    expect(c.doubleApplied).toBe(false);
  });
  it('double application: part-top H plus nonzero work Z is flagged and deep', () => {
    let s = run([{ type: 'SET_OFFSET', n: 1, field: 'hGeom', value: idealHFor(initialState(P), T1(), P), mode: 'set' }, ...K('Y')]);
    s = run([{ type: 'SET_WORK', wcs: 'G54', axis: 'Z', value: idealHFor(s, T1(), P) }], s);
    const c = g43Check(s, P, 1, 5);
    expect(c.doubleApplied).toBe(true);
    expect(c.combinedError).toBeLessThan(-200);
    expect(c.collision).toBe(true);
  });
  it('combined tool + work offsets: Haas convention (H to top, work Z 0) gives zero error', () => {
    const s = run([{ type: 'SET_OFFSET', n: 1, field: 'hGeom', value: idealHFor(initialState(P), T1(), P), mode: 'set' }, ...K('Y')]);
    expect(g43Check(s, P, 1, 5).combinedError).toBe(0);
  });
  it('bottom-centre datum needs work Z = -height with part-top H', () => {
    let s = run([{ type: 'SET_OFFSET', n: 1, field: 'hGeom', value: idealHFor(initialState(P), T1(), P), mode: 'set' }, ...K('Y')]);
    s = { ...s, setup: { ...s.setup, wcsDatum: { ...s.setup.wcsDatum, G54: { type: 'BC', custom: [0, 0, 0] } } } };
    s = run([{ type: 'SET_WORK', wcs: 'G54', axis: 'Z', value: -50 }], s);
    expect(g43Check(s, P, 1, 5).combinedError).toBe(0);
  });
});

describe('coordinate displays', () => {
  it('machine, work, programmed (G43) and actual tip agree when offsets are correct', () => {
    let s = run([{ type: 'SET_OFFSET', n: 1, field: 'hGeom', value: idealHFor(initialState(P), initialState(P).tools[0], P), mode: 'set' }, ...K('Y'),
      { type: 'SET_WORK', wcs: 'G54', axis: 'X', value: -355 }, { type: 'SET_WORK', wcs: 'G54', axis: 'Y', value: -243 }]);
    s = jogTo(jogTo(jogTo(s, 'X', -335), 'Y', -233), 'Z', -150);
    const c = coords(s, P);
    expect(c.work).toMatchObject({ X: 20, Y: 10, Z: -150 });
    expect(c.programmed.Z).toBe(r3(c.tip.Z));
    expect(c.tip).toMatchObject({ X: 20, Y: 10 });
    expect(c.breakdown.length).toBeGreaterThan(2);
  });
});

describe('explanations for incorrect actions', () => {
  it('collision, travel, clamping and key misuse are explained', async () => {
    const { explain } = await import('../../src/engine/explain');
    expect(run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'Z', direction: 1 }]).message).toMatch(/Travel limit/);
    expect(explain('Travel limit: Z -406 to 0')).toMatch(/travel limit/);
    expect(explain('Move rejected: Tool would hit the vice jaw')).toMatch(/full length/);
    expect(explain('Workpiece A is not clamped — it would move. Clamp it first')).toMatch(/unclamped/);
    expect(explain(run(K('PART_ZERO_SET')).message)).toMatch(/F4/);
    expect(explain('Alarms cleared')).toBeNull();
  });
});
