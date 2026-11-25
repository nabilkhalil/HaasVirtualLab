import { describe, expect, it } from 'vitest';
import { UMC500 as P } from '../../src/config/umc500';
import { initialState, reduce, type Action, type Key, type MachineState } from '../../src/engine/machine';
import { makeVariant, withVariant, getVariant } from '../../src/engine/variant';
import { categorize } from '../../src/engine/explain';
import { trueWork } from '../../src/engine/workholding';
import { lessonById, type Lesson } from '../../src/lessons/toolLessons';
import '../../src/lessons/workLessons';
import '../../src/lessons/fiveLessons';
import { breakdown, commonMistakes, recommend, lessonCategory } from '../../src/academy/competency';
import { attemptsCSV, backupJSON, parseBackup, CSV_HEADER } from '../../src/academy/exports';
import { MISTAKE_CATEGORIES } from '../../src/engine/explain';
import { translate } from '../../src/i18n';
import type { Attempt } from '../../src/store/progressStore';

const run = (s: MachineState, acts: Action[]) => acts.reduce((st, a) => reduce(st, a, P), s);
/** Student simulator: performs the highlighted control of each guided step. */
function follow(l: Lesson, s: MachineState, answers: Record<string, string> = {}) {
  const a = { ...answers };
  for (let i = 0; i < 20000; i++) {
    const st = l.guide(s, a);
    if (!st) return { s, a };
    const t = (st.target ?? '').split(',').pop()!;
    let acts: Action[] = st.act ? [st.act] : [];
    if (!acts.length) {
      if (t.startsWith('inc-')) acts = [{ type: 'SET_INCREMENT', increment: Number(t.slice(4)) }];
      else if (t.startsWith('jog-')) acts = [{ type: 'JOG', axis: t[4] as 'X', direction: t[5] === '+' ? 1 : -1 }];
      else if (t.startsWith('load-T')) acts = [{ type: 'TOOL_CHANGE', tool: Number(t.slice(6)) }];
      else if (t.startsWith('wcs-')) acts = [{ type: 'SET_WCS', wcs: t.slice(4) as 'G55' }];
      else if (t === 'keypad') acts = [...st.text.match(/type (-?[\d.]+)/)![1]].map((c) => ({ type: 'KEY', key: c as Key }));
      else if (t.startsWith('key-')) acts = [{ type: 'KEY', key: t.slice(4) as Key }];
      else if (t === 'lesson-record') { a[st.record!] = `${s.machine.X},${s.machine.Y},${s.machine.Z}`; continue; }
      else throw new Error(`Unhandled ${t}`);
    }
    const before = JSON.stringify(s);
    s = run(s, acts);
    if (JSON.stringify(s) === before) throw new Error(`No progress: ${st.text} — ${s.message}`);
  }
  throw new Error('Guide did not finish');
}

describe('randomised exercise parameters', () => {
  it('variants are deterministic and only active inside withVariant', () => {
    expect(makeVariant(42)).toEqual(makeVariant(42));
    expect(makeVariant(42)).not.toEqual(makeVariant(43));
    const s = withVariant(makeVariant(7), () => initialState(P));
    expect(getVariant()).toBeNull();
    expect(s.tools[0].length).not.toBe(initialState(P).tools[0].length);
    expect(trueWork(s, P, 'G54').X).not.toBe(trueWork(initialState(P), P, 'G54').X);
  });
  const cases: [string, Record<string, string>][] = [['W-A', {}], ['W-C', {}], ['W-E', {}], ['W-D', {}], ['F-B', {}], ['F-H', { setups: '4' }], ['F-I', { safe: 'no' }]];
  for (const seed of [11, 222, 3333]) for (const [id, ans] of cases) {
    it(`${id} seed ${seed}: solvable and scored against the randomised physical truth`, () => {
      const l = lessonById(id)!;
      const { s, a } = follow(l, withVariant(makeVariant(seed), () => l.setup()), ans);
      const r = l.assess(s, a);
      expect(r.total).toBe(r.max);
    });
  }
  it('a fixed-parameter answer fails on a randomised variant (scores reflect demonstrated actions)', () => {
    const l = lessonById('W-A')!;
    const fixed = follow(l, l.setup()).s;
    const variant = withVariant(makeVariant(11), () => l.setup());
    const copied = run(variant, [{ type: 'SET_WORK', wcs: 'G54', axis: 'X', value: fixed.work.G54.X }, { type: 'SET_WORK', wcs: 'G54', axis: 'Y', value: fixed.work.G54.Y }]);
    expect(l.assess(copied, {}).total).toBeLessThan(l.assess(fixed, {}).total);
  });
});

describe('action metrics', () => {
  it('counts correct operations, categorised mistakes and alarms; dry runs are not mistakes', () => {
    let s = run(initialState(P), [{ type: 'KEY', key: 'OFFSET' }, { type: 'KEY', key: 'PART_ZERO_SET' }, { type: 'JOG', axis: 'Z', direction: 1 }]);
    expect(s.stats.ok).toBe(1);
    expect(s.stats.mistakes).toEqual({ 'Wrong screen, tab or mode': 1, 'Travel limit': 1 });
    expect(s.stats.rejected).toBe(2);
    s = run(s, [{ type: 'MDI_ROTATE', B: 150 }]);
    expect(s.stats.alarms).toBe(1);
    const dry = run(initialState(P), [{ type: 'MDI_ROTATE', B: 150, dryRun: true }]);
    expect(dry.stats.rejected + dry.stats.alarms).toBe(0);
    expect(categorize('Sphere centre at B0 C0: X1')).toBeNull();
  });
});

const att = (lessonId: string, score: number, extra: Partial<Attempt> = {}): Attempt => ({ moduleId: 'M05', lessonId, mode: 'assessment', score, max: 100, at: 1, collisions: 0, incorrect: 0, hints: 0, ok: 10, ...extra });
describe('competency engine', () => {
  it('breakdown uses best attempt per exercise, operations and safety evidence', () => {
    const b = breakdown([att('A', 40), att('A', 90), att('E', 70, { collisions: 1, incorrect: 5, ok: 15 }), att('W-0', 100), att('quiz', 4, { max: 4 })]);
    expect(b['Tool offsets']).toBeCloseTo(0.8);
    expect(b['Workpiece setup']).toBe(1);
    expect(b['Controller operation']).toBeCloseTo(45 / 50);
    expect(b['Safety compliance']).toBeCloseTo(3 / 4);
    expect(b['Program verification']).toBeNull();
    expect(lessonCategory('F-D')).toBe('Five-axis setup');
  });
  it('common mistakes and recommendations', () => {
    const a = [att('E', 50, { mistakes: { 'Travel limit': 2, 'DWO / TCPC rule': 3 } })];
    expect(commonMistakes(a)[0]).toEqual(['DWO / TCPC rule', 3]);
    const r = recommend({ M05: { guided: [], quiz: { score: 2, max: 4, at: 0 } } }, a).map((x) => x.id);
    expect(r).toEqual(expect.arrayContaining(['M05', 'M10', 'M03']));
  });
  it('recommendation reasons are data, renderable in either language', () => {
    const rec = recommend({ M05: { guided: [], quiz: { score: 2, max: 4, at: 0 } } }, [att('E', 50, { mistakes: { 'Travel limit': 2 } })]);
    const kinds = rec.map((x) => `${x.id}:${x.reason.kind}`);
    expect(kinds).toContain('M05:quiz');
    expect(kinds).toContain('M03:mistake');
    const m03 = rec.find((x) => x.id === 'M03')!;
    expect(m03.reason).toEqual({ kind: 'mistake', mistake: 'Travel limit', n: 2 });
    if (m03.reason.kind !== 'mistake') throw new Error('expected a mistake reason');
    const r3 = m03.reason;
    expect(translate('en', 'reason.mistake', { n: r3.n, mistake: r3.mistake })).toBe('2× Travel limit');
    expect(translate('ms', 'reason.mistake', { n: r3.n, mistake: translate('ms', `mistake.${r3.mistake}`) })).toBe('2× Had perjalanan');
    const m05 = rec.find((x) => x.id === 'M05')!;
    if (m05.reason.kind !== 'quiz') throw new Error('expected a quiz reason');
    expect(translate('ms', 'reason.quiz', { score: m05.reason.score, max: m05.reason.max })).toBe('2/4 dalam kuiz pengetahuan');
  });
  it('every engine mistake category has a label in both languages', () => {
    for (const c of MISTAKE_CATEGORIES) {
      expect(translate('en', `mistake.${c}`, {}, '')).toBe(c);
      expect(translate('ms', `mistake.${c}`, {}, '')).not.toBe('');
      expect(translate('ms', `mistake.${c}`)).not.toBe(c);
    }
  });
});

describe('exports', () => {
  it('CSV has a header and escapes commas, quotes and newlines', () => {
    const csv = attemptsCSV([att('A', 80, { mistakes: { 'Wrong screen, tab or mode': 1 }, items: [{ label: 'T1 "H" geometry', points: 25, max: 25 }] })]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(lines[1]).toContain('"Wrong screen, tab or mode:1"');
    expect(lines[1]).toContain('"T1 ""H"" geometry 25/25"');
  });
  it('CSV header follows the UI language while values stay canonical', () => {
    const ms = CSV_HEADER.map((h) => translate('ms', `csv.${h}`, {}, h));
    expect(ms.slice(0, 3)).toEqual(['tarikh', 'modul', 'latihan']);
    const csv = attemptsCSV([att('A', 80, { mistakes: { 'Travel limit': 1 } })], ms);
    expect(csv.split('\r\n')[0]).toBe(ms.join(','));
    expect(csv).toContain('Travel limit:1');
  });
  it('JSON backup round-trips and invalid files are rejected', () => {
    const d = { modules: { M05: { guided: ['A'] } }, attempts: [att('A', 80)], hints: 3, timeMs: 60000 };
    expect(parseBackup(backupJSON(d))).toEqual(d);
    expect(() => parseBackup('nope')).toThrow(/JSON/);
    expect(() => parseBackup('{"app":"other","version":1,"data":{}}')).toThrow(/Not a Haas/);
    expect(() => parseBackup(JSON.stringify({ app: 'haas-virtual-lab', version: 1, data: { modules: {}, attempts: [{ lessonId: 1 }] } }))).toThrow(/invalid attempt/);
  });
});
