import { describe, expect, it } from 'vitest';
import { UMC500 as P } from '../../src/config/umc500';
import { reduce, type Action, type Key, type MachineState } from '../../src/engine/machine';
import { positionReport, tcpcPaths } from '../../src/engine/fiveaxis';
import { FIVE_LESSONS } from '../../src/lessons/fiveLessons';
import { WORK_LESSONS } from '../../src/lessons/workLessons';
import { DEFAULT_DEMO } from '../../src/store/fiveStore';
import type { Lesson } from '../../src/lessons/toolLessons';

const byId = (id: string) => FIVE_LESSONS.find((l) => l.id === id)!;
/** Plays guided steps: uses step.act when given, else maps the highlighted control to an action. */
function follow(l: Lesson, answers: Record<string, string>, max = 20000) {
  let s = l.setup();
  for (let i = 0; i < max; i++) {
    const st = l.guide(s, answers);
    if (!st) return s;
    const t = (st.target ?? '').split(',').pop()!;
    let act: Action | undefined = st.act;
    if (!act) {
      if (t.startsWith('inc-')) act = { type: 'SET_INCREMENT', increment: Number(t.slice(4)) };
      else if (t.startsWith('jog-')) act = { type: 'JOG', axis: t[4] as 'X', direction: t[5] === '+' ? 1 : -1 };
      else if (t.startsWith('key-')) act = { type: 'KEY', key: t.slice(4) as Key };
      else throw new Error(`Unhandled ${t}: ${st.text}`);
    }
    const before = JSON.stringify([s.machine, s.mode, s.comp, s.mrzpHits.length, s.mrzpError, s.faceLog, s.selectedAxis, s.jogIncrement]);
    s = reduce(s, act, P);
    if (before === JSON.stringify([s.machine, s.mode, s.comp, s.mrzpHits.length, s.mrzpError, s.faceLog, s.selectedAxis, s.jogIncrement]))
      throw new Error(`No progress at "${st.text}" — ${s.message}`);
  }
  throw new Error('Guide did not finish');
}
const full = (r: { total: number; max: number }) => expect(r.total).toBe(r.max);

describe('Phase 5 lessons: guided flows reach full marks', () => {
  const cases: [string, Record<string, string>][] = [
    ['F-A', { tilt: 'B', rot: 'C', range: '-35 to +120' }],
    ['F-B', {}],
    ['F-D', { set: '255-257' }],
    ['F-H', { setups: '4' }],
    ['F-I', { safe: 'no' }],
  ];
  for (const [id, ans] of cases) it(id, () => {
    const l = byId(id), s = follow(l, ans);
    full(l.assess(s, ans));
    expect(s.stats.collisions).toBe(0);
  });
  it('F-C: answers from the physics', () => {
    const l = byId('F-C');
    const s = follow(l, { work: 'no', over: 'no', dist: '1' });
    const r = l.assess(s, { work: 'no', over: 'no', dist: '0' });
    const want = Number(r.items.find((i) => i.label === 'Corner displacement')!.detail!.split(' ')[1]);
    full(l.assess(s, { work: 'no', over: 'no', dist: String(want) }));
    expect(want).toBeGreaterThan(50);
  });
  it('F-E: measured miss, wrong settings 255+257, fixed', () => {
    const l = byId('F-E'), s0 = l.setup();
    const miss = positionReport(s0, P, [0, 0, 5]).mag;
    const ans = { miss: String(miss), which: '255,257' };
    full(l.assess(follow(l, ans), ans));
  });
  it('F-F: miss without DWO, then accurate with G254', () => {
    const l = byId('F-F');
    let s = reduce(l.setup(), { type: 'MDI_MOVE', w: [0, 0, 10] }, P);
    const miss = positionReport(s, P, [0, 0, 10]).mag;
    const ans = { miss: String(miss), cancel: 'G255' };
    s = follow(l, ans);
    expect(s.comp).toBe('G254');
    full(l.assess(s, ans));
  });
  it('F-G: deviation answer from the TCPC model', () => {
    const l = byId('F-G'), s = l.setup();
    const ans = { dev: String(tcpcPaths(s, P, DEFAULT_DEMO).devOff), keeps: 'TCPC on', combo: 'not allowed' };
    full(l.assess(s, ans));
  });
  it('F-I: rotating without retracting is a recorded collision', () => {
    const l = byId('F-I');
    const s = reduce(l.setup(), { type: 'MDI_ROTATE', B: 90 }, P);
    expect(s.stats.collisions).toBe(1);
    expect(l.assess(s, { safe: 'no' }).total).toBeLessThan(60);
  });
  it('lesson groups stay separate', () => {
    expect(WORK_LESSONS.every((l) => l.id.startsWith('W-'))).toBe(true);
  });
});
