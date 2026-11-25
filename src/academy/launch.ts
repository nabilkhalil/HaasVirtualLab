import { go } from '../app/router';
import { lessonById } from '../lessons/toolLessons';
import '../lessons/workLessons';
import '../lessons/fiveLessons';
import { useLesson, type LearnMode } from '../store/lessonStore';
import { useMachine } from '../store/machineStore';
import { useProgress } from '../store/progressStore';
import { initialState } from '../engine/machine';
import { UMC500 } from '../config/umc500';
import type { Module } from './modules';
import { makeVariant, withVariant } from '../engine/variant';

/** Start an exercise in the shared simulator (one engine; the Academy only sets the initial state). */
/** Practice and independent assessment use randomised physical parameters; guided exercises stay fixed. */
export function startLesson(lessonId: string, mode: LearnMode, moduleId: string | null, navigate = true, seed?: number) {
  const l = lessonById(lessonId);
  if (!l) return;
  const sd = mode === 'guided' ? null : seed ?? Math.floor(Math.random() * 1e9);
  useMachine.getState().replace(withVariant(sd === null ? null : makeVariant(sd), () => l.setup()));
  useLesson.getState().set({ lessonId, mode, moduleId, answers: {}, result: null, hintsUsed: 0, startedAt: Date.now(), seed: sd });
  if (navigate) go('simulator');
}
export function resumeLesson() {
  const r = useProgress.getState().resume;
  if (!r || !lessonById(r.lessonId)) return;
  useMachine.getState().replace(r.state);
  useLesson.getState().set({ lessonId: r.lessonId, mode: r.mode, moduleId: r.moduleId, answers: r.answers, result: null, hintsUsed: 0, startedAt: Date.now() - 0, seed: null });
  go('simulator');
}
export function openDemo(m: Module) {
  const l = m.demo.lesson ? lessonById(m.demo.lesson) : undefined;
  useMachine.getState().replace(l ? l.setup() : initialState(UMC500));
  useLesson.getState().set({ lessonId: null, moduleId: m.id, result: null });
  go('simulator');
}
