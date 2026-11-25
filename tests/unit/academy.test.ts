import { describe, expect, it } from 'vitest';
import { UMC500 as P } from '../../src/config/umc500';
import { reduce, type MachineState } from '../../src/engine/machine';
import { MODULES, moduleStatus, scoreQuiz, lessonsOf, moduleOfLesson } from '../../src/academy/modules';
import { stepHelp } from '../../src/academy/stepHelp';
import { lessonById, LESSONS } from '../../src/lessons/toolLessons';
import { WORK_LESSONS } from '../../src/lessons/workLessons';
import { FIVE_LESSONS } from '../../src/lessons/fiveLessons';
import { useProgress } from '../../src/store/progressStore';

describe('Academy modules', () => {
  it('twelve modules M01-M12; unavailable ones state why', () => {
    expect(MODULES.map((m) => m.id)).toEqual(Array.from({ length: 12 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`));
    for (const m of MODULES.filter((x) => !x.available)) expect(m.unavailable).toMatch(/Phase [46]/);
  });
  it('available modules have every component and reference real lessons', () => {
    for (const m of MODULES.filter((x) => x.available)) {
      expect(m.outcomes.length).toBeGreaterThan(0);
      expect(m.theory.length).toBeGreaterThan(80);
      expect(m.quiz.length).toBeGreaterThanOrEqual(4);
      expect(m.guided.length && m.practice && m.practical).toBeTruthy();
      for (const id of lessonsOf(m)) expect(lessonById(id), `${m.id}:${id}`).toBeTruthy();
      for (const q of m.quiz) { expect(q.answer).toBeLessThan(q.options.length); expect(q.src).toMatch(/^(S[123]|SIM)/); }
    }
    expect(moduleOfLesson('W-0')?.id).toBe('M04');
  });
  it('completion requires guided + practice + quiz >= 80% + practical >= 80%', () => {
    const m = MODULES[4];
    expect(moduleStatus(m).status).toBe('not started');
    const p = { guided: m.guided, practice: { score: 10, max: 100, at: 0 }, quiz: { score: 4, max: 4, at: 0 }, practical: { score: 79, max: 100, at: 0, lessonId: 'E' } };
    expect(moduleStatus(m, p).status).toBe('in progress');
    expect(moduleStatus(m, { ...p, practical: { ...p.practical, score: 80 } }).status).toBe('complete');
    expect(moduleStatus(MODULES[6]).status).toBe('unavailable');
  });
  it('quiz scoring', () => {
    const m = MODULES[0];
    expect(scoreQuiz(m, m.quiz.map((q) => q.answer))).toEqual({ score: 4, max: 4 });
    expect(scoreQuiz(m, []).score).toBe(0);
  });
  it('every guided step of every lesson has a why / expected-response explanation', () => {
    for (const l of [...LESSONS, ...WORK_LESSONS, ...FIVE_LESSONS]) {
      const st = l.guide(l.setup(), {});
      if (st?.target) expect(stepHelp(st.target), `${l.id}: ${st.target}`).not.toBeNull();
    }
  });
});

describe('progress store', () => {
  it('records best results, guided completion, attempts and resume', () => {
    const p = useProgress.getState();
    p.reset();
    p.recordGuided('M05', 'A'); p.recordGuided('M05', 'A');
    p.recordResult('M05', 'quiz', { score: 2, max: 4, at: 1 });
    p.recordResult('M05', 'quiz', { score: 4, max: 4, at: 2 });
    p.recordResult('M05', 'quiz', { score: 3, max: 4, at: 3 });
    p.addAttempt({ moduleId: 'M05', lessonId: 'E', mode: 'assessment', score: 50, max: 100, at: 4, collisions: 1, incorrect: 2, hints: 0 });
    const s = useProgress.getState();
    expect(s.modules.M05.guided).toEqual(['A']);
    expect(s.modules.M05.quiz).toMatchObject({ score: 4 });
    expect(s.attempts).toHaveLength(1);
    p.saveResume({ moduleId: 'M05', lessonId: 'A', mode: 'guided', answers: {}, state: lessonById('A')!.setup(), at: 5 });
    expect(useProgress.getState().resume?.lessonId).toBe('A');
  });
});

describe('W-0 workholding exercise (M04)', () => {
  it('guided steps reach full marks; skipping alignment loses points', () => {
    const l = lessonById('W-0')!;
    let s: MachineState = l.setup();
    for (let i = 0; i < 20; i++) { const st = l.guide(s, {}); if (!st) break; s = reduce(s, st.act!, P); }
    expect(l.guide(s, {})).toBeNull();
    const r = l.assess(s, {}); expect(r.total).toBe(r.max);
    const bad = reduce(reduce(l.setup(), { type: 'SET_SETUP', patch: { parallels: true } }, P), { type: 'UPDATE_PIECE', id: 'A', patch: { clamped: true } }, P);
    expect(l.assess(bad, {}).total).toBeLessThan(70);
  });
  it('a clamped part cannot be resized (incorrect action is recorded, guide does not advance)', () => {
    const l = lessonById('W-0')!;
    const s = reduce(reduce(l.setup(), { type: 'UPDATE_PIECE', id: 'A', patch: { clamped: true } }, P), { type: 'UPDATE_PIECE', id: 'A', patch: { size: [120, 80, 40] } }, P);
    expect(s.stats.rejected).toBe(1);
    expect(l.guide(s, {})?.text).toMatch(/Unclamp/);
  });
});
