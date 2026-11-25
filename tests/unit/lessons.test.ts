import { describe, expect, it } from 'vitest';
import { UMC500 as P, stockTop } from '../../src/config/umc500';
import { reduce, type Action, type Key, type MachineState } from '../../src/engine/machine';
import { idealH } from '../../src/engine/tools';
import { LESSONS, lessonById } from '../../src/lessons/toolLessons';

const run = (s: MachineState, acts: Action[]) => acts.reduce((st, a) => reduce(st, a, P), s);
const K = (...ks: Key[]): Action[] => ks.map((key) => ({ type: 'KEY', key }));
const g = P.geometry;
const L = (s: MachineState, n: number) => s.tools.find((t) => t.number === n)!.length;
/** Touch off tool n (already in spindle at Z0) with the paper gap, then measure into row `row`. */
function touchOff(s: MachineState, n: number, row = n): MachineState {
  const z = Math.round((stockTop(P) + L(s, n) - g.gaugeLineAtZ0 + P.paperThickness) * 1000) / 1000;
  const xy: Action[] = s.machine.X === g.xAtCentre ? [] : [
    { type: 'SET_INCREMENT', increment: 1 },
    { type: 'JOG', axis: 'X', direction: -1, steps: -g.xAtCentre }, { type: 'JOG', axis: 'Y', direction: -1, steps: -g.yAtCentre }];
  return run(s, [...xy, { type: 'SET_INCREMENT', increment: 0.001 }, { type: 'JOG', axis: 'Z', direction: -1, steps: Math.round(-z * 1000) },
    ...K('OFFSET'), { type: 'CURSOR_TO', row, col: 0 }, ...K('TOOL_OFFSET_MEASURE', 'Y')]);
}
const full = (r: { total: number; max: number }) => expect(r.total).toBe(r.max);

describe('lessons', () => {
  it('every lesson starts with guidance and has outcomes, hints and errors', () => {
    for (const l of LESSONS) {
      const s = l.setup();
      expect(l.guide(s, {})).not.toBeNull();
      expect(l.outcomes.length && l.hints.length && l.commonErrors.length).toBeTruthy();
    }
  });

  it('A: measuring T1-T3 with NEXT TOOL scores full; wrong row loses points', () => {
    const A = lessonById('A')!;
    let s = touchOff(A.setup(), 1);
    s = touchOff(run(s, K('NEXT_TOOL')), 2);
    s = touchOff(run(s, K('NEXT_TOOL')), 3);
    expect(A.guide(s, {})).toBeNull();
    full(A.assess(s, {}));
    const bad = touchOff(run(touchOff(A.setup(), 1), K('NEXT_TOOL')), 2, 1); // T2 into row 1
    expect(A.assess(bad, {}).total).toBeLessThan(50);
  });

  it('A: guided steps highlight the expected controls', () => {
    const A = lessonById('A')!;
    expect(A.guide(A.setup(), {})?.target).toBe('inc-1');
    const s = run(A.setup(), [{ type: 'SET_INCREMENT', increment: 1 }]);
    expect(A.guide(s, {})?.target).toBe('jog-X-');
  });

  it('B: picks T2 and T4', () => {
    const B = lessonById('B')!;
    full(B.assess(B.setup(), { checked: '2,4' }));
    expect(B.assess(B.setup(), { checked: '2' }).total).toBe(80);
  });

  it('C: wear -0.060 via keypad scores full; wrong sign does not', () => {
    const C = lessonById('C')!;
    const ok = run(C.setup(), [...K('OFFSET', 'DOWN', 'RIGHT', '-', '.', '0', '6', 'F1')]);
    expect(C.guide(ok, {})).toBeNull();
    full(C.assess(ok, {}));
    const wrong = run(C.setup(), [...K('OFFSET', 'DOWN', 'RIGHT', '.', '0', '6', 'F1')]);
    expect(C.assess(wrong, {}).total).toBe(40);
  });

  it('D: actual tip 1.2 below programmed', () => {
    const D = lessonById('D')!;
    full(D.assess(D.setup(), { tip: '1.2', dir: 'below' }));
    expect(D.assess(D.setup(), { tip: '2.8', dir: 'above' }).total).toBe(0);
  });

  it('E: collision identified, depth, re-measure', () => {
    const E = lessonById('E')!;
    const s0 = E.setup();
    const depth = -(idealH(s0.tools[0], P) + 0.1 - idealH(s0.tools[3], P) + 5);
    expect(depth).toBeGreaterThan(30);
    const fixed = touchOff(s0, 4);
    expect(E.guide(fixed, { crash: 'yes', depth: String(depth) })).toBeNull();
    full(E.assess(fixed, { crash: 'yes', depth: depth.toFixed(3) }));
    expect(E.assess(s0, { crash: 'no', depth: '0' }).total).toBe(0);
  });
});
