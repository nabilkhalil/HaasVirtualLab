import type { Attempt, ModuleProgress } from '../store/progressStore';
import { MODULES, moduleStatus, PASS } from './modules';

/** Competency categories reported on the dashboard. Program verification needs Phase 6. */
export const CATEGORIES = ['Controller operation', 'Tool offsets', 'Work offsets', 'Workpiece setup', 'Five-axis setup', 'Safety compliance', 'Program verification'] as const;
export type Category = (typeof CATEGORIES)[number];
export function lessonCategory(id: string): Category | null {
  if (/^[A-E]$/.test(id)) return 'Tool offsets';
  if (id === 'W-0') return 'Workpiece setup';
  if (id.startsWith('W-')) return 'Work offsets';
  if (id.startsWith('F-')) return 'Five-axis setup';
  return null;
}
const practical = (a: Attempt[]) => a.filter((x) => x.lessonId !== 'quiz');
const pct = (x: Attempt) => (x.max ? x.score / x.max : 0);

/** Per-category competency (0–1, null = no evidence). Uses the best attempt per lesson, then averages lessons. */
export function breakdown(attempts: Attempt[]): Record<Category, number | null> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, null])) as Record<Category, number | null>;
  const p = practical(attempts);
  for (const c of ['Tool offsets', 'Work offsets', 'Workpiece setup', 'Five-axis setup'] as Category[]) {
    const best = new Map<string, number>();
    for (const a of p) if (lessonCategory(a.lessonId) === c) best.set(a.lessonId, Math.max(best.get(a.lessonId) ?? 0, pct(a)));
    if (best.size) out[c] = [...best.values()].reduce((x, y) => x + y, 0) / best.size;
  }
  const ok = p.reduce((s, a) => s + (a.ok ?? 0), 0), bad = p.reduce((s, a) => s + a.incorrect, 0);
  if (ok + bad > 0) out['Controller operation'] = ok / (ok + bad);
  if (p.length) out['Safety compliance'] = p.filter((a) => a.collisions === 0 && !(a.alarms ?? 0)).length / p.length;
  return out;
}
export function commonMistakes(attempts: Attempt[]): [string, number][] {
  const m: Record<string, number> = {};
  for (const a of attempts) for (const [k, v] of Object.entries(a.mistakes ?? {})) m[k] = (m[k] ?? 0) + v;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
const MISTAKE_MODULE: Record<string, string> = {
  'Collision / contact': 'M03', 'Travel limit': 'M03', 'DWO / TCPC rule': 'M10', 'E-stop / alarm handling': 'M02',
  'Wrong screen, tab or mode': 'M02', 'Invalid entry': 'M02', 'Setup change rule': 'M04', 'Tilt axis not at B0': 'M05', 'Procedure order': 'M09',
};
const CAT_MODULE: Partial<Record<Category, string>> = { 'Tool offsets': 'M05', 'Work offsets': 'M06', 'Workpiece setup': 'M04', 'Five-axis setup': 'M09', 'Controller operation': 'M02', 'Safety compliance': 'M03' };
/** A revision reason as data, so the dashboard can render it in the learner's language. */
export type RevisionReason =
  | { kind: 'quiz'; score: number; max: number }
  | { kind: 'practical'; score: number; max: number }
  | { kind: 'category'; category: Category; pct: number }
  | { kind: 'mistake'; mistake: string; n: number };
export interface Recommendation { id: string; reason: RevisionReason }
/** Revision recommendations with reasons: failed module steps, weak categories, frequent mistakes. */
export function recommend(modules: Record<string, ModuleProgress>, attempts: Attempt[]): Recommendation[] {
  const out = new Map<string, RevisionReason>();
  for (const m of MODULES.filter((x) => x.available)) {
    const p = modules[m.id];
    if (p?.quiz && p.quiz.score / p.quiz.max < PASS) out.set(m.id, { kind: 'quiz', score: p.quiz.score, max: p.quiz.max });
    if (p?.practical && p.practical.score / p.practical.max < PASS) out.set(m.id, { kind: 'practical', score: p.practical.score, max: p.practical.max });
  }
  const b = breakdown(attempts);
  for (const [c, v] of Object.entries(b)) if (v !== null && v < PASS && CAT_MODULE[c as Category] && !out.has(CAT_MODULE[c as Category]!)) out.set(CAT_MODULE[c as Category]!, { kind: 'category', category: c as Category, pct: Math.round(v * 100) });
  for (const [k, n] of commonMistakes(attempts).slice(0, 3)) if (n >= 2 && MISTAKE_MODULE[k] && !out.has(MISTAKE_MODULE[k])) out.set(MISTAKE_MODULE[k], { kind: 'mistake', mistake: k, n });
  return [...out].map(([id, reason]) => ({ id, reason }));
}
export function overall(modules: Record<string, ModuleProgress>) {
  const avail = MODULES.filter((m) => m.available);
  const steps = avail.reduce((s, m) => s + Object.values(moduleStatus(m, modules[m.id]).steps).filter(Boolean).length, 0);
  return { complete: avail.filter((m) => moduleStatus(m, modules[m.id]).status === 'complete').map((m) => m.id), available: avail.length, pct: steps / (avail.length * 4) };
}
