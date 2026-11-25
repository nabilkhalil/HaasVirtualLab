import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MachineState } from '../engine/machine';
import type { LearnMode } from './lessonStore';

/** Learner progress, persisted in LocalStorage (no backend). */
export interface Result { score: number; max: number; at: number }
export interface ModuleProgress { guided: string[]; practice?: Result; quiz?: Result; practical?: Result & { lessonId: string } }
export interface Attempt {
  moduleId: string | null; lessonId: string; mode: LearnMode; score: number; max: number; at: number;
  collisions: number; incorrect: number; hints: number;
  /** Demonstrated-action metrics (absent for quizzes / older records). */
  durationMs?: number; ok?: number; alarms?: number; mistakes?: Record<string, number>; seed?: number | null;
  items?: { label: string; points: number; max: number; detail?: string }[];
}
export interface Resume { moduleId: string | null; lessonId: string; mode: LearnMode; answers: Record<string, string>; state: MachineState; at: number }
interface ProgressState {
  modules: Record<string, ModuleProgress>;
  attempts: Attempt[];
  resume: Resume | null;
  hints: number;
  timeMs: number;
  addTime: (ms: number) => void;
  restore: (d: Pick<ProgressState, 'modules' | 'attempts' | 'hints' | 'timeMs'>) => void;
  recordGuided: (m: string, lessonId: string) => void;
  recordResult: (m: string | null, kind: 'practice' | 'quiz' | 'practical', r: Result, lessonId?: string) => void;
  addAttempt: (a: Attempt) => void;
  saveResume: (r: Resume | null) => void;
  addHint: () => void;
  reset: () => void;
}
const mod = (s: ProgressState, m: string): ModuleProgress => s.modules[m] ?? { guided: [] };
export const PROGRESS_KEY = 'hvl-progress-v1';
export const useProgress = create<ProgressState>()(persist((set) => ({
  modules: {}, attempts: [], resume: null, hints: 0, timeMs: 0,
  addTime: (ms) => set((s) => ({ timeMs: s.timeMs + ms })),
  restore: (d) => set({ modules: d.modules, attempts: d.attempts, hints: d.hints, timeMs: d.timeMs, resume: null }),
  recordGuided: (m, id) => set((s) => { const p = mod(s, m); return p.guided.includes(id) ? s : { modules: { ...s.modules, [m]: { ...p, guided: [...p.guided, id] } } }; }),
  recordResult: (m, kind, r, lessonId) => set((s) => {
    if (!m) return s;
    const p = mod(s, m), prev = p[kind];
    // keep the best result for completion; every attempt is also logged in `attempts`
    const best = !prev || r.score / r.max >= prev.score / prev.max ? { ...r, ...(kind === 'practical' ? { lessonId } : {}) } : prev;
    return { modules: { ...s.modules, [m]: { ...p, [kind]: best } } };
  }),
  addAttempt: (a) => set((s) => ({ attempts: [...s.attempts, a].slice(-500) })),
  saveResume: (resume) => set({ resume }),
  addHint: () => set((s) => ({ hints: s.hints + 1 })),
  reset: () => set({ modules: {}, attempts: [], resume: null, hints: 0, timeMs: 0 }),
}), { name: PROGRESS_KEY, version: 1 }));
