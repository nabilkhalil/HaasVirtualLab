import { describe, expect, it } from 'vitest';
import { UMC500 as P } from '../../src/config/umc500';
import { reduce, type Action, type Key, type MachineState } from '../../src/engine/machine';
import { WORK_LESSONS } from '../../src/lessons/workLessons';
import type { Lesson } from '../../src/lessons/toolLessons';

const run = (s: MachineState, acts: Action[]) => acts.reduce((st, a) => reduce(st, a, P), s);
const byId = (id: string) => WORK_LESSONS.find((l) => l.id === id)!;

/** Follows guided steps by "pressing" the highlighted control, like a student in guided mode. */
function follow(l: Lesson, answers: Record<string, string> = {}, max = 20000) {
  let s = l.setup();
  const a = { ...answers };
  for (let i = 0; i < max; i++) {
    const st = l.guide(s, a);
    if (!st) return { s, a, steps: i };
    const t = (st.target ?? '').split(',').pop()!;
    let act: Action[] = [];
    if (t.startsWith('inc-')) act = [{ type: 'SET_INCREMENT', increment: Number(t.slice(4)) }];
    else if (t.startsWith('jog-')) act = [{ type: 'JOG', axis: t[4] as 'X', direction: t[5] === '+' ? 1 : -1 }];
    else if (t.startsWith('load-T')) act = [{ type: 'TOOL_CHANGE', tool: Number(t.slice(6)) }];
    else if (t.startsWith('wcs-')) act = [{ type: 'SET_WCS', wcs: t.slice(4) as 'G55' }];
    else if (t === 'keypad') act = [...st.text.match(/type (-?[\d.]+)/)![1]].map((c) => ({ type: 'KEY', key: c as Key }));
    else if (t.startsWith('key-')) act = [{ type: 'KEY', key: t.slice(4) as Key }];
    else if (t === 'lesson-record') { a[st.record!] = `${s.machine.X},${s.machine.Y},${s.machine.Z}`; continue; }
    else throw new Error(`Unhandled target ${t}: ${st.text}`);
    const before = JSON.stringify(s.machine) + s.input + JSON.stringify(s.work) + s.activeTool + s.workCursor.row + s.workCursor.col + s.screen + s.offsetTab + s.jogIncrement + !!s.prompt + s.activeWcs;
    s = run(s, act);
    if (before === JSON.stringify(s.machine) + s.input + JSON.stringify(s.work) + s.activeTool + s.workCursor.row + s.workCursor.col + s.screen + s.offsetTab + s.jogIncrement + !!s.prompt + s.activeWcs)
      throw new Error(`No progress at "${st.text}" (${s.message})`);
  }
  throw new Error('Guide did not finish: ' + l.guide(s, a)?.text + ' | ' + s.message + ' | ' + JSON.stringify(s.machine));
}
const full = (r: { total: number; max: number }) => expect(r.total).toBe(r.max);

describe('Phase 3 guided scenarios complete with full score', () => {
  for (const id of ['W-A', 'W-B', 'W-C', 'W-D', 'W-E']) {
    it(`${id} guided flow`, () => {
      const l = byId(id);
      const { s, a } = follow(l);
      full(l.assess(s, a));
      expect(s.stats.collisions).toBe(0);
    });
  }
  it('W-G: diagnosis, prediction and fix', () => {
    const l = byId('W-G');
    const ans = { diag: 'double application', result: 'overtravel / crash' };
    const { s } = follow(l, ans);
    full(l.assess(s, ans));
    expect(l.assess(l.setup(), { diag: 'no error', result: 'correct' }).total).toBe(20);
  });
  it('W-F: wrong offsets are G55, G56, G57', () => {
    const l = byId('W-F');
    full(l.assess(l.setup(), { wrong: 'G55,G56,G57' }));
    expect(l.assess(l.setup(), { wrong: 'G55' }).total).toBeLessThan(l.assess(l.setup(), { wrong: 'G55,G56,G57' }).total);
  });
  it('W-C: forgetting the radius loses accuracy points', () => {
    const l = byId('W-C');
    const s0 = l.setup();
    const t = { X: s0.work.G54.X, Y: s0.work.G54.Y };
    const s = run(s0, [{ type: 'SET_WORK', wcs: 'G54', axis: 'X', value: -358 }, { type: 'SET_WORK', wcs: 'G54', axis: 'Y', value: -246 }]);
    expect(l.assess(s, {}).total).toBeLessThan(60);
    expect(t).toEqual({ X: 0, Y: 0 });
  });
  it('W-D: double application (part-top H1 kept) is penalised', () => {
    const l = byId('W-D');
    const { s } = follow(l);
    const bad = run(s, [{ type: 'SET_OFFSET', n: 1, field: 'hGeom', value: s.work.G54.Z, mode: 'set' }, { type: 'KEY', key: 'Y' }]);
    expect(l.assess(bad, {}).total).toBeLessThan(40);
  });
  it('assessment records collisions and incorrect actions', () => {
    const l = byId('W-A');
    const s = run(l.setup(), [{ type: 'KEY', key: 'PART_ZERO_SET' }, { type: 'ESTOP_PRESS' }, { type: 'JOG', axis: 'X', direction: -1 }]);
    const r = l.assess(s, {});
    expect(r.items.find((i) => i.label === 'Incorrect actions')!.points).toBeLessThan(10);
  });
});
