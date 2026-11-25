import { create } from 'zustand';

export type LearnMode = 'guided' | 'practice' | 'assessment';
export interface Score { items: { label: string; points: number; max: number; detail?: string }[]; total: number; max: number }

interface LessonStore {
  mode: LearnMode; lessonId: string | null; answers: Record<string, string>; result: Score | null;
  /** Academy module the lesson was started from (null = free simulator). */
  moduleId: string | null; hintsUsed: number;
  /** Attempt start time and randomisation seed (null = fixed guided parameters). */
  startedAt: number; seed: number | null;
  set: (p: Partial<Omit<LessonStore, 'set'>>) => void;
}
export const useLesson = create<LessonStore>((set) => ({
  mode: 'guided', lessonId: null, answers: {}, result: null, moduleId: null, hintsUsed: 0, startedAt: 0, seed: null,
  set: (p) => set(p),
}));
/** Physical "truth" (true lengths, actual tip) is hidden during assessments. */
export const useHideTruth = () => useLesson((l) => l.lessonId !== null && l.mode === 'assessment');
