import { UMC500 as P } from '../config/umc500';
import { initialState, writeOffset, type MachineState } from '../engine/machine';
import { findTool, g43Check, idealH, paperState, r3, referenceGap } from '../engine/tools';
import type { Score } from '../store/lessonStore';

/** Lesson spec per interactive-cnc-learning skill: outcomes, initial state, actions (guide), expected end state (assess), hints, errors, scoring. */
/** Guided step: text, control(s) to highlight (comma-separated test ids), optional position to record. */
export interface Step { text: string; target?: string; record?: string; why?: string; expect?: string; /** Action the highlighted control performs (used by tests). */ act?: import('../engine/machine').Action }
export interface Question { id: string; label: string; kind: 'number' | 'choice' | 'multi'; options?: string[] }
export interface Lesson {
  id: string; title: string; outcomes: string[]; objective: string;
  setup: () => MachineState;
  /** Next guided action derived from state (null = all steps done). target = data-testid to highlight. */
  guide: (s: MachineState, a: Record<string, string>) => Step | null;
  group?: string;
  hints: string[]; commonErrors: string[]; questions?: Question[];
  assess: (s: MachineState, a: Record<string, string>) => Score;
}

const PAPER_TOL = 0.15; // accepts paper thickness left in the measurement
const setH = (s: MachineState, n: number, f: 'hGeom' | 'hWear' | 'dGeom', v: number) => writeOffset(s, n, f, v, P, true);
const score = (items: Score['items']): Score => ({ items, total: items.reduce((a, i) => a + i.points, 0), max: items.reduce((a, i) => a + i.max, 0) });
const ideal = (s: MachineState, n: number) => idealH(findTool(s, n)!, P);
const base = (tool = 1) => ({ ...initialState(P), activeTool: tool, check: { h: tool, d: tool, z: 5 }, message: 'Lesson loaded' });
const withDia = (s: MachineState) => s.tools.reduce((st, t) => setH(st, t.number, 'dGeom', t.diameter), s);
const prefilled = (s: MachineState) => withDia(s.tools.reduce((st, t) => setH(st, t.number, 'hGeom', r3(ideal(st, t.number) + 0.1)), s));

/** Shared touch-off guidance for tool n into row n. */
function touchOffGuide(s: MachineState, n: number, measure = true) {
  if (s.prompt) return { text: 'The change exceeds Setting 142. Check the value, then press Y to accept.', target: 'key-Y' };
  if (s.activeTool !== n) return { text: `Load T${n}: press NEXT TOOL (or Load in the tool library).`, target: 'key-NEXT_TOOL' };
  if (s.machine.B !== 0) return { text: 'Return the tilt axis to B0 before touching off.', target: 'jog-B+' };
  const gap = referenceGap(s, P);
  if (gap === null) {
    if (s.jogIncrement !== 1) return { text: 'Select the [.1/100.] increment (1 mm per click) for fast positioning.', target: 'inc-1' };
    return Math.abs(s.machine.X - P.geometry.xAtCentre) > 40
      ? { text: `Jog X to about ${P.geometry.xAtCentre} (part centre).`, target: s.machine.X > P.geometry.xAtCentre ? 'jog-X-' : 'jog-X+' }
      : { text: `Jog Y to about ${P.geometry.yAtCentre} (part centre).`, target: s.machine.Y > P.geometry.yAtCentre ? 'jog-Y-' : 'jog-Y+' };
  }
  const ps = paperState(gap, P);
  if (ps === 'PAPER PINCHED') return { text: 'The paper is pinched. Raise Z slightly with a fine increment.', target: 'jog-Z+' };
  if (ps === 'PAPER FREE') {
    const inc = gap > 25 ? 1 : gap > 2 ? 0.1 : gap > 0.3 ? 0.01 : 0.001;
    if (s.jogIncrement !== inc) return { text: `Gap ≈ ${gap > 25 ? 'large' : 'small'}: select the ${inc} mm increment.`, target: `inc-${inc}` };
    return { text: 'Lower Z (−Z) until the paper drags.', target: 'jog-Z-' };
  }
  if (!measure) return null;
  if (s.screen !== 'OFFSET') return { text: 'Press OFFSET to open the tool offset display.', target: 'key-OFFSET' };
  if (s.cursor.row !== n) return { text: `Move the cursor to tool ${n} (UP/DOWN).`, target: s.cursor.row < n ? 'key-DOWN' : 'key-UP' };
  if (s.cursor.col !== 0) return { text: 'Highlight the H GEOM column (LEFT).', target: 'key-LEFT' };
  return { text: 'Press TOOL OFFSET MEASURE to record the Z machine position.', target: 'key-TOOL_OFFSET_MEASURE' };
}
const safety = (s: MachineState) => ({ label: 'Safe jogging (blocked moves)', points: Math.max(0, 20 - 5 * s.stats.rejected), max: 20, detail: `${s.stats.rejected} blocked/rejected moves` });

export const LESSONS: Lesson[] = [
  {
    id: 'A', group: 'Tool setup', title: 'A · Measure three cutting tools',
    outcomes: ['Touch off with the paper method', 'Record H with TOOL OFFSET MEASURE', 'Use NEXT TOOL'],
    objective: 'Set Length Geometry (H) for T1, T2 and T3 by touching off on the part top.',
    setup: () => base(1),
    guide: (s) => {
      for (const n of [1, 2, 3]) if (Math.abs(s.offsets[n].hGeom - ideal(s, n)) > PAPER_TOL) return touchOffGuide(s, n);
      return null;
    },
    hints: ['Work at B0.', 'Use 1 mm steps far away, 0.001 mm near the part.', 'Highlight the row of the tool in the spindle before measuring.'],
    commonErrors: ['Measuring into the wrong row', 'Measuring with the paper pinched or in air', 'Jogging into the part'],
    assess: (s) => score([
      ...[1, 2, 3].map((n) => {
        const e = r3(s.offsets[n].hGeom - ideal(s, n));
        return { label: `T${n} H geometry`, points: Math.abs(e) <= PAPER_TOL ? 25 : Math.abs(e) <= 0.5 ? 10 : 0, max: 25, detail: `error ${e.toFixed(3)} mm` };
      }),
      safety(s),
    ]),
  },
  {
    id: 'B', title: 'B · Identify incorrect tool length offsets',
    outcomes: ['Verify H values against a touch-off', 'Recognise sign of offset errors'],
    objective: 'T1–T5 have H values. Some are wrong (> 0.2 mm). Touch off each tool and tick the incorrect ones.',
    setup: () => {
      let s = prefilled(base(1));
      s = setH(s, 2, 'hGeom', r3(ideal(s, 2) - 3)); // too short -> gouge
      s = setH(s, 4, 'hGeom', r3(ideal(s, 4) + 1.5)); // too long -> shallow
      return { ...s, message: 'Lesson loaded' };
    },
    guide: (s, a) => {
      const done = (a.checked ?? '').split(',').filter(Boolean);
      for (const n of [1, 2, 3, 4, 5]) if (!a[`seen${n}`]) {
        const g = touchOffGuide(s, n, false);
        if (g) return g;
        return { text: `Compare POSITION Z (${s.machine.Z.toFixed(3)}) with H GEOM of T${n} (${s.offsets[n].hGeom.toFixed(3)}). Tick T${n} if they differ by more than 0.2, then press "Next tool checked".`, target: 'lesson-seen' };
      }
      return done.length ? null : { text: 'Tick the incorrect tools and submit.', target: 'lesson-submit' };
    },
    hints: ['Do not press TOOL OFFSET MEASURE on the stored rows; compare values instead.', 'Paper leaves about +0.1 mm.'],
    commonErrors: ['Overwriting offsets before checking', 'Ignoring small sign differences'],
    questions: [{ id: 'checked', label: 'Incorrect tools', kind: 'multi', options: ['1', '2', '3', '4', '5'] }],
    assess: (s, a) => {
      const picked = new Set((a.checked ?? '').split(',').filter(Boolean).map(Number));
      return score([1, 2, 3, 4, 5].map((n) => {
        const wrong = Math.abs(s.offsets[n].hGeom + s.offsets[n].hWear - ideal(s, n) - 0.1) > 0.2;
        return { label: `T${n} ${wrong ? 'incorrect' : 'correct'}`, points: picked.has(n) === wrong ? 20 : 0, max: 20 };
      }));
    },
  },
  {
    id: 'C', title: 'C · Correct tool length wear',
    outcomes: ['Use Length Wear for small corrections', 'Choose the correct sign'],
    objective: 'T2 cut a pocket programmed Z−5.000 deep, but it measured 4.940 deep (0.060 shallow). Correct T2 Length Wear; do not change geometry.',
    setup: () => {
      let s = withDia(base(2));
      s = setH(s, 2, 'hGeom', r3(ideal(s, 2) + 0.06));
      return { ...s, message: 'Lesson loaded' };
    },
    guide: (s) => {
      if (Math.abs(s.offsets[2].hWear + 0.06) <= 0.005) return null;
      if (s.screen !== 'OFFSET') return { text: 'Press OFFSET.', target: 'key-OFFSET' };
      if (s.cursor.row !== 2) return { text: 'Move the cursor to tool 2.', target: s.cursor.row < 2 ? 'key-DOWN' : 'key-UP' };
      if (s.cursor.col !== 1) return { text: 'Highlight H WEAR.', target: s.cursor.col < 1 ? 'key-RIGHT' : 'key-LEFT' };
      if (s.input !== '-.06' && s.input !== '-0.06') return { text: 'Shallow cut → tool must go lower → H more negative. Type -.06', target: s.input ? 'key-CANCEL' : 'key--' };
      return { text: 'Press F1 to set the value (ENTER would add it).', target: 'key-F1' };
    },
    hints: ['Shallow cut: real tip too high → reduce H (more negative).'],
    commonErrors: ['Entering +0.06', 'Editing H geometry instead of wear', 'Wrong tool row'],
    assess: (s) => score([
      { label: 'T2 H wear = −0.060', points: Math.abs(s.offsets[2].hWear + 0.06) <= 0.005 ? 60 : 0, max: 60, detail: `wear ${s.offsets[2].hWear.toFixed(3)}` },
      { label: 'T2 geometry unchanged', points: Math.abs(s.offsets[2].hGeom - r3(ideal(s, 2) + 0.06)) < 1e-6 ? 20 : 0, max: 20 },
      { label: 'Other rows unchanged', points: [1, 3, 4, 5].every((n) => s.offsets[n].hWear === 0) ? 20 : 0, max: 20 },
    ]),
  },
  {
    id: 'D', title: 'D · Actual vs programmed tool position',
    outcomes: ['Predict the real tip position from stored and true H', 'Explain G43 sign effects'],
    objective: 'T3 is in the spindle. For "G43 H03 Z2.0", where will the tip actually be above the part top? (In assessment, touch off T3 to find its true H.)',
    setup: () => {
      let s = withDia(base(3));
      s = setH(s, 3, 'hGeom', r3(ideal(s, 3) - 0.8));
      return { ...s, check: { h: 3, d: 3, z: 2 }, message: 'Lesson loaded' };
    },
    guide: (s, a) => {
      if (s.check.h !== 3 || s.check.z !== 2) return { text: 'Set the compensation check to H 3, Z 2.', target: 'chk-z' };
      if (!a.tip) return { text: 'Read "Actual tip" in the compensation check and enter it below.', target: 'lesson-q-tip' };
      if (!a.dir) return { text: 'Is the real tip above or below the programmed Z?', target: 'lesson-q-dir' };
      return null;
    },
    hints: ['Actual tip = programmed Z + (stored H − true H).', 'True H ≈ Z machine position at paper contact − 0.1.'],
    commonErrors: ['Sign error (adding instead of subtracting)', 'Mixing the gauge-line length with the H value'],
    questions: [{ id: 'tip', label: 'Actual tip above part top (mm)', kind: 'number' }, { id: 'dir', label: 'Relative to programmed', kind: 'choice', options: ['above', 'below'] }],
    assess: (s, a) => {
      const c = g43Check(s, P, 3, 2, 3, 3);
      return score([
        { label: 'Actual tip position', points: Math.abs(Number(a.tip) - c.actualTip) <= PAPER_TOL ? 70 : 0, max: 70, detail: `expected ${c.actualTip.toFixed(3)}` },
        { label: 'Direction', points: a.dir === (c.actualTip < 2 ? 'below' : 'above') ? 30 : 0, max: 30 },
      ]);
    },
  },
  {
    id: 'E', title: 'E · Collision from wrong compensation',
    outcomes: ['Detect a crash before it happens', 'Fix the offset by re-measuring'],
    objective: 'T4 (drill) will run "G43 H04 Z5.0". H04 was copied from T1. Will it collide? By how much below the part top? Then re-measure T4 into row 4.',
    setup: () => {
      let s = prefilled(base(4));
      s = setH(s, 4, 'hGeom', s.offsets[1].hGeom);
      return { ...s, check: { h: 4, d: 4, z: 5 }, message: 'Lesson loaded' };
    },
    guide: (s, a) => {
      if (!a.crash) return { text: 'Read the compensation check for H 4, Z 5: is there a collision risk?', target: 'lesson-q-crash' };
      if (!a.depth) return { text: 'Enter how far below the part top the tip would go (mm).', target: 'lesson-q-depth' };
      if (Math.abs(s.offsets[4].hGeom - ideal(s, 4)) > PAPER_TOL) return touchOffGuide(s, 4);
      return null;
    },
    hints: ['A longer tool with a shorter tool\'s H goes deeper than programmed.'],
    commonErrors: ['Fixing with wear instead of re-measuring', 'Measuring T4 into row 1'],
    questions: [{ id: 'crash', label: 'Collision?', kind: 'choice', options: ['yes', 'no'] }, { id: 'depth', label: 'Depth below part top (mm)', kind: 'number' }],
    assess: (s, a) => {
      const orig = r3(ideal(s, 1) + 0.1 - ideal(s, 4) + 5); // actual tip with the copied H
      return score([
        { label: 'Collision identified', points: a.crash === 'yes' ? 30 : 0, max: 30 },
        { label: 'Depth', points: Math.abs(Number(a.depth) + orig) <= 0.5 ? 30 : 0, max: 30, detail: `expected ${(-orig).toFixed(3)}` },
        { label: 'T4 re-measured', points: Math.abs(s.offsets[4].hGeom - ideal(s, 4)) <= PAPER_TOL ? 40 : 0, max: 40, detail: `error ${(s.offsets[4].hGeom - ideal(s, 4)).toFixed(3)}` },
      ]);
    },
  },
];
export const lessonById = (id: string | null) => [...LESSONS, ...WORK_LESSONS_REF.list].find((l) => l.id === id);
/** Filled by workLessons.ts (avoids an import cycle). */
export const WORK_LESSONS_REF: { list: Lesson[] } = { list: [] };
