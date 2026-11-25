/**
 * Randomised exercise parameters for practice/assessment. A variant perturbs the PHYSICAL setup
 * (tool lengths, workpiece X positions) before a lesson's setup runs, so every derived value
 * (ideal H, true datum) stays consistent and scoring still uses the physical truth.
 */
export interface Variant { seed: number; toolDelta: Record<number, number>; aShiftX: number; bShiftX: number }
let current: Variant | null = null;
export const setVariant = (v: Variant | null) => { current = v; };
export const getVariant = () => current;

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function makeVariant(seed: number): Variant {
  const r = rng(seed), between = (lo: number, hi: number) => lo + (hi - lo) * r();
  const toolDelta: Record<number, number> = {};
  for (let n = 1; n <= 7; n++) toolDelta[n] = Math.round(between(-8, 8) * 1000) / 1000;
  return { seed, toolDelta, aShiftX: Math.round(between(-15, 15)), bShiftX: Math.round(between(-20, 20)) };
}
/** Run `fn` with a variant active (used to build a lesson's initial state). */
export function withVariant<T>(v: Variant | null, fn: () => T): T {
  const prev = current; current = v;
  try { return fn(); } finally { current = prev; }
}
