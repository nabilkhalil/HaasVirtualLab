import { UMC500 as P } from '../config/umc500';
import { WCS, type Wcs } from '../config/workholding';
import { initialState, writeOffset, writeWork, type MachineState } from '../engine/machine';
import { findTool, g43Check, idealHFor, r3 } from '../engine/tools';
import { edgeFinder, piece, pieceTop, setupIssues, trueWork } from '../engine/workholding';
import type { Score } from '../store/lessonStore';
import { WORK_LESSONS_REF, type Lesson, type Step } from './toolLessons';

const g = P.geometry;
const f3 = (v: number) => v.toFixed(3);
const score = (items: Score['items']): Score => ({ items, total: items.reduce((a, i) => a + i.points, 0), max: items.reduce((a, i) => a + i.max, 0) });
const L = (s: MachineState) => findTool(s, s.activeTool)?.length ?? 0;
/** Machine Z that puts the active tool tip at scene height h (B = 0). */
const zFor = (s: MachineState, h: number) => r3(h + L(s) - g.gaugeLineAtZ0);
const tipZ = (s: MachineState) => s.machine.Z + g.gaugeLineAtZ0 - L(s);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/** Recorded incorrect actions and collision events (assessment requirement). */
export const conduct = (s: MachineState): Score['items'] => [
  { label: 'Collision events', points: Math.max(0, 10 - 10 * s.stats.collisions), max: 10, detail: `${s.stats.collisions}` },
  { label: 'Incorrect actions', points: Math.max(0, 10 - 2 * (s.stats.rejected - s.stats.collisions)), max: 10, detail: `${s.stats.rejected - s.stats.collisions}` },
];
export const acc = (label: string, err: number, tol: number, pts: number) => ({ label, points: Math.abs(err) <= tol ? pts : Math.abs(err) <= tol * 10 ? Math.round(pts / 3) : 0, max: pts, detail: `error ${f3(err)}` });

function base(tool: number, wcsPatch: Partial<MachineState['setup']> = {}): MachineState {
  let s = initialState(P);
  s = { ...s, activeTool: tool, check: { h: tool, d: tool, z: 5 }, setup: { ...s.setup, ...wcsPatch } };
  for (const t of s.tools) s = writeOffset(s, t.number, 'hGeom', idealHFor(s, t, P), P, true); // Haas convention: H to part top A
  return { ...s, message: 'Lesson loaded' };
}

export const INC = (d: number) => (Math.abs(d) >= 5 ? 1 : Math.abs(d) >= 0.5 ? 0.1 : Math.abs(d) >= 0.05 ? 0.01 : 0.001);
export function move(s: MachineState, axis: 'X' | 'Y' | 'Z', target: number, tol: number, why: string): Step | null {
  const d = r3(target - s.machine[axis]);
  if (Math.abs(d) <= tol) return null;
  const inc = INC(d);
  if (s.jogIncrement !== inc) return { text: `${why}: select the ${inc} mm increment (${axis} is ${f3(Math.abs(d))} mm from ${f3(target)}).`, target: `inc-${inc}` };
  return { text: `${why}: jog ${axis}${d > 0 ? '+' : '−'} to ${f3(target)} (remaining ${f3(d)}).`, target: `jog-${axis}${d > 0 ? '+' : '-'}` };
}
/** Move XY with the tool raised above all workpieces first. */
export function travel(s: MachineState, x: number, y: number, why: string): Step | null {
  if (near(s.machine.X, x, 0.5) && near(s.machine.Y, y, 0.5)) return null;
  const clear = Math.max(...s.setup.pieces.map((w) => pieceTop(s, w))) + 15;
  if (tipZ(s) < clear - 1) return move(s, 'Z', Math.min(0, zFor(s, clear)), 1, 'Raise Z clear of the parts');
  return move(s, 'X', x, 0.5, why) ?? move(s, 'Y', y, 0.5, why);
}
export const load = (s: MachineState, n: number): Step | null => s.activeTool === n ? null : { text: `Open SETUP and Load T${n} (${findTool(s, n)?.name}).`, target: `tab-SETUP,load-T${n}` };
export function cell(s: MachineState, row: number, col: number): Step | null {
  if (s.prompt) return { text: 'Setting 142 prompt: check the value, then press Y.', target: 'key-Y' };
  if (s.screen !== 'OFFSET') return { text: 'Press OFFSET.', target: 'key-OFFSET' };
  if (s.offsetTab !== 'WORK') return { text: 'Press F4 for the WORK offset tab.', target: 'key-F4' };
  if (s.workCursor.row !== row) return { text: `Move the cursor to ${WCS[row]}.`, target: s.workCursor.row < row ? 'key-DOWN' : 'key-UP' };
  if (s.workCursor.col !== col) return { text: `Move the cursor to the ${'XYZBC'[col]} column.`, target: s.workCursor.col < col ? 'key-RIGHT' : 'key-LEFT' };
  return null;
}
export function typeValue(s: MachineState, v: number, key: 'F1' | 'ENTER', why: string): Step {
  if (s.input !== '' && near(Number(s.input), v, 0.0005)) return { text: `${why}: press ${key}${key === 'F1' ? ' (set)' : ' (add)'}.`, target: `key-${key}` };
  return { text: `${why}: type ${f3(v)} on the keypad${s.input ? ' (CANCEL to correct)' : ''}.`, target: s.input ? 'key-CANCEL' : 'keypad' };
}

/** Pointer method (S1 "Set a Work Offset"): datum of `wcs` into row by PART ZERO SET X then Y. */
function pointerFlow(s: MachineState, wcs: Wcs): Step | null {
  const row = WCS.indexOf(wcs), t = trueWork(s, P, wcs), w = s.work[wcs];
  if (near(w.X, t.X, 0.05) && near(w.Y, t.Y, 0.05)) return null;
  const l = load(s, 7); if (l) return l;
  const tr = travel(s, t.X, t.Y, `Move the pointer over the ${wcs} datum`); if (tr) return tr;
  const z = move(s, 'Z', zFor(s, t.datumZ + 1), 0.5, 'Lower the pointer to about 1 mm above the corner'); if (z) return z;
  const fine = move(s, 'X', t.X, 0.02, 'Line the pointer up with the corner') ?? move(s, 'Y', t.Y, 0.02, 'Line the pointer up with the corner'); if (fine) return fine;
  const c = cell(s, row, near(w.X, t.X, 0.05) ? 1 : 0); if (c) return c;
  return { text: `Press PART ZERO SET to store the machine ${'XYZ'[s.workCursor.col]} position in ${wcs}.`, target: 'key-PART_ZERO_SET' };
}

type Face = 'left' | 'right' | 'front';
/** Edge finder approach to a face of workpiece A; returns the contact machine coordinate. */
function edgeTarget(s: MachineState, face: Face) {
  const w = piece(s, 'A'), r = (findTool(s, 6)?.diameter ?? 6) / 2;
  const cx = w.pos[0] + g.xAtCentre, cy = w.pos[1] + g.yAtCentre;
  const ex = face === 'left' ? cx - w.size[0] / 2 : cx + w.size[0] / 2, ey = cy - w.size[1] / 2;
  if (face === 'front') return { axis: 'Y' as const, edge: r3(ey), contact: r3(ey - r), pre: [cx, ey - r - 5], r, top: pieceTop(s, w) };
  const sg = face === 'left' ? -1 : 1;
  return { axis: 'X' as const, edge: r3(ex), contact: r3(ex + sg * r), pre: [ex + sg * (r + 5), cy], r, top: pieceTop(s, w) };
}
function edgeFlow(s: MachineState, face: Face): Step | null {
  const l = load(s, 6); if (l) return l;
  const e = edgeTarget(s, face);
  const perp = e.axis === 'X' ? 'Y' : 'X', perpT = e.axis === 'X' ? e.pre[1] : e.pre[0], preA = e.axis === 'X' ? e.pre[0] : e.pre[1];
  const along = s.machine[e.axis];
  const inLane = near(s.machine[perp], perpT, 0.5) && along >= Math.min(preA, e.contact) - 0.6 && along <= Math.max(preA, e.contact) + 0.6;
  const tr = inLane ? null : travel(s, e.pre[0], e.pre[1], `Position the edge finder beside the ${face} face`); if (tr) return tr;
  const z = tipZ(s) > e.top - 4.5 ? move(s, 'Z', zFor(s, e.top - 5), 0.5, 'Lower the edge finder tip about 5 mm below the part top') : null; if (z) return z;
  if (edgeFinder(s, P).state === 'KICKED') return null;
  return move(s, e.axis, e.contact, 0.004, `Approach the ${face} face slowly until the tip kicks`) ?? { text: 'Back off slightly until the tip just kicks.', target: `jog-${e.axis}${face === 'right' ? '+' : '-'}` };
}

export const WORK_LESSONS: Lesson[] = [
  {
    id: 'W-0', group: 'Work setup', title: '0 · Prepare and clamp workpiece A',
    outcomes: ['Change stock size and parallels while unclamped', 'Square the part to the axes', 'Clamp before measuring'],
    objective: 'Prepare a 120 × 80 × 40 mm block in the vice: fit parallels, set the size, align it square (0°) and clamp it.',
    setup: () => {
      const s = initialState(P);
      const pieces = s.setup.pieces.map((w) => (w.id === 'A' ? { ...w, clamped: false, yaw: 0.6 } : w));
      return { ...s, setup: { ...s.setup, pieces, parallels: false }, message: 'Lesson loaded' };
    },
    guide: (s) => {
      const A = piece(s, 'A');
      if (A.clamped && (!s.setup.parallels || A.size.join() !== '120,80,40' || A.yaw !== 0)) return { text: 'Unclamp workpiece A first — clamped parts cannot be changed.', target: 'tab-SETUP,clamp-A', act: { type: 'UPDATE_PIECE', id: 'A', patch: { clamped: false } } };
      if (!s.setup.parallels) return { text: 'Fit the parallels so the part stands above the jaws.', target: 'tab-SETUP,parallels', act: { type: 'SET_SETUP', patch: { parallels: true } } };
      if (A.size.join() !== '120,80,40') return { text: 'Set the stock size to L 120, W 80, H 40.', target: 'tab-SETUP,size-A-L', act: { type: 'UPDATE_PIECE', id: 'A', patch: { size: [120, 80, 40] } } };
      if (A.yaw !== 0) return { text: `The part is ${A.yaw}° out of square. Press Align (tap it square against the fixed jaw).`, target: 'tab-SETUP,align-A', act: { type: 'UPDATE_PIECE', id: 'A', patch: { yaw: 0 } } };
      if (!A.clamped) return { text: 'Clamp the vice.', target: 'tab-SETUP,clamp-A', act: { type: 'UPDATE_PIECE', id: 'A', patch: { clamped: true } } };
      return null;
    },
    hints: ['Parallels change the part top height; datums must be measured after clamping.'],
    commonErrors: ['Trying to resize a clamped part', 'Leaving the part out of square', 'No parallels: part below the jaw tops'],
    assess: (s) => {
      const A = piece(s, 'A');
      return score([
        { label: 'Stock 120 × 80 × 40', points: A.size.join() === '120,80,40' ? 20 : 0, max: 20 },
        { label: 'Parallels fitted', points: s.setup.parallels ? 15 : 0, max: 15 },
        { label: 'Aligned (0°)', points: A.yaw === 0 ? 15 : 0, max: 15, detail: `${A.yaw}°` },
        { label: 'Clamped', points: A.clamped ? 15 : 0, max: 15 },
        { label: 'No setup issues', points: setupIssues(s).length === 0 ? 15 : 0, max: 15, detail: setupIssues(s).join('; ') || 'none' },
        ...conduct(s),
      ]);
    },
  },
  {
    id: 'W-A', group: 'Work setup', title: 'A · G54 at the top corner (pointer)',
    outcomes: ['Use HANDLE JOG and increments', 'Record X/Y with PART ZERO SET (S1 procedure)', 'Leave Z work offset at 0 with part-top H'],
    objective: 'Set G54 X/Y at the top front-left corner of workpiece A with the pointer (T7). Do not load a Z value.',
    setup: () => base(1),
    guide: (s) => pointerFlow(s, 'G54') ?? (s.work.G54.Z !== 0 ? { ...(cell(s, 0, 2) ?? { text: 'Press ORIGIN to clear G54 Z (third PART ZERO SET loads Z — S1 caution).', target: 'key-ORIGIN' }) } : null),
    hints: ['X/Y work offsets are negative from machine zero.', 'Use 0.01 / 0.001 mm increments for the final alignment.'],
    commonErrors: ['Pressing PART ZERO SET a third time (loads Z)', 'Storing in G55 instead of G54'],
    assess: (s) => { const t = trueWork(s, P, 'G54'); return score([acc('G54 X', s.work.G54.X - t.X, 0.05, 30), acc('G54 Y', s.work.G54.Y - t.Y, 0.05, 30), { label: 'G54 Z = 0', points: s.work.G54.Z === 0 ? 20 : 0, max: 20 }, ...conduct(s)]); },
  },
  {
    id: 'W-B', group: 'Work setup', title: 'B · G54 at the workpiece centre (edge finder)',
    outcomes: ['Find opposite edges', 'Compute a centre from two contacts', 'Offset from one edge by half the width'],
    objective: 'Set G54 at the top centre of A: X = midpoint of left and right edges; Y = front edge + W/2. Use the edge finder (T6).',
    setup: () => { const s = base(1); return { ...s, setup: { ...s.setup, wcsDatum: { ...s.setup.wcsDatum, G54: { type: 'TC', custom: [0, 0, 0] } } } }; },
    guide: (s, a) => {
      for (const f of ['left', 'right', 'front'] as Face[]) if (!a[f]) {
        const st = edgeFlow(s, f);
        return st ?? { text: `Edge finder kicked on the ${f} face. Press Record.`, target: 'lesson-record', record: f };
      }
      const r = edgeTarget(s, 'left').r, W = piece(s, 'A').size[1];
      const xs = [a.left, a.right].map((v) => Number(v.split(',')[0])), yf = Number(a.front.split(',')[1]);
      const cx = r3((xs[0] + xs[1]) / 2), cy = r3(yf + r + W / 2);
      if (!near(s.work.G54.X, cx, 0.002)) return cell(s, 0, 0) ?? typeValue(s, cx, 'F1', `Centre X = (${f3(xs[0])} + ${f3(xs[1])}) / 2 = ${f3(cx)}`);
      if (!near(s.work.G54.Y, cy, 0.002)) return cell(s, 0, 1) ?? typeValue(s, cy, 'F1', `Centre Y = front contact ${f3(yf)} + r ${f3(r)} + W/2 ${f3(W / 2)} = ${f3(cy)}`);
      return null;
    },
    hints: ['The radius cancels in a midpoint.', 'The back face is against the fixed jaw: use front edge + W/2.'],
    commonErrors: ['Forgetting the radius on the single-edge Y', 'Moving across the part without raising Z'],
    assess: (s) => { const t = trueWork(s, P, 'G54'); return score([acc('G54 X (centre)', s.work.G54.X - t.X, 0.02, 30), acc('G54 Y (centre)', s.work.G54.Y - t.Y, 0.02, 30), { label: 'G54 Z = 0', points: s.work.G54.Z === 0 ? 20 : 0, max: 20 }, ...conduct(s)]); },
  },
  {
    id: 'W-C', group: 'Work setup', title: 'C · X/Y with an edge finder (radius correction)',
    outcomes: ['Detect the edge kick', 'Apply the tip radius with ENTER (add)', 'Record G54 X and Y'],
    objective: 'Set G54 X/Y at the top front-left corner of A using the edge finder: PART ZERO SET at the kick, then add the tip radius.',
    setup: () => base(1),
    guide: (s) => {
      const t = trueWork(s, P, 'G54');
      for (const [face, axis, col] of [['left', 'X', 0], ['front', 'Y', 1]] as const) {
        const e = edgeTarget(s, face), v = s.work.G54[axis];
        if (near(v, t[axis], 0.01)) continue;
        if (near(v, e.contact, 0.01)) return cell(s, 0, col) ?? typeValue(s, e.r, 'ENTER', `Radius correction: edge = contact ${f3(e.contact)} + r ${f3(e.r)} = ${f3(e.edge)}`);
        const st = edgeFlow(s, face); if (st) return st;
        return cell(s, 0, col) ?? { text: `Kicked at ${axis} ${f3(s.machine[axis])}. Press PART ZERO SET.`, target: 'key-PART_ZERO_SET' };
      }
      return null;
    },
    hints: ['Approaching from −X/−Y: the edge is at contact + radius.', 'After PART ZERO SET the cursor moves on — go back LEFT before adding the radius.'],
    commonErrors: ['Subtracting the radius', 'Forgetting the radius (error = tip radius)', 'Adding the radius to the wrong column'],
    assess: (s) => { const t = trueWork(s, P, 'G54'); return score([acc('G54 X', s.work.G54.X - t.X, 0.01, 30), acc('G54 Y', s.work.G54.Y - t.Y, 0.01, 30), { label: 'G54 Z = 0', points: s.work.G54.Z === 0 ? 20 : 0, max: 20 }, ...conduct(s)]); },
  },
  {
    id: 'W-D', group: 'Work setup', title: 'D · Z with a gauge block (reference tool)',
    outcomes: ['Use a gauge block safely', 'Correct for block thickness', 'Avoid double tool offsets (reference tool H = 0)'],
    objective: 'T1 is the reference tool (H1 = 0). Touch T1 on a 25 mm gauge block on top of A, store G54 Z with PART ZERO SET and subtract the block.',
    setup: () => {
      let s = base(1);
      s = writeOffset(s, 1, 'hGeom', 0, P, true);
      return { ...s, setup: { ...s.setup, touch: 'block', gaugeBlock: 25 } };
    },
    guide: (s) => {
      const tb = s.setup.gaugeBlock, top = pieceTop(s, piece(s, 'A')), zc = zFor(s, top + tb);
      const ok = near(s.work.G54.Z + s.offsets[1].hGeom + s.offsets[1].hWear, idealHFor(s, findTool(s, 1)!, P), 0.01);
      if (ok) return null;
      if (s.prompt) return { text: 'Setting 142 prompt: press Y to accept.', target: 'key-Y' };
      const l = load(s, 1); if (l) return l;
      if (near(s.work.G54.Z, zc, 0.006)) return cell(s, 0, 2) ?? typeValue(s, -tb, 'ENTER', `Part top = block contact ${f3(s.work.G54.Z)} − block ${f3(tb)}`);
      const tr = travel(s, g.xAtCentre + piece(s, 'A').pos[0], g.yAtCentre, 'Move T1 over the middle of workpiece A'); if (tr) return tr;
      const z = move(s, 'Z', zc, 0.004, `Lower Z until the ${f3(tb)} mm block just drags`); if (z) return z;
      return cell(s, 0, 2) ?? { text: 'Block drags. Press PART ZERO SET to store machine Z in G54 Z.', target: 'key-PART_ZERO_SET' };
    },
    hints: ['Reference-tool method: G54 Z holds the part top, H holds tool differences.', 'Never combine part-top H values with a part-top G54 Z.'],
    commonErrors: ['Forgetting to subtract the block', 'Adding the block (wrong sign)', 'Leaving a part-top H1 (double application)'],
    assess: (s) => {
      const T1 = findTool(s, 1)!, H1 = s.offsets[1].hGeom + s.offsets[1].hWear;
      return score([acc('Combined G54 Z + H1', s.work.G54.Z + H1 - idealHFor(s, T1, P), 0.01, 50), { label: 'Reference tool H1 = 0', points: H1 === 0 ? 20 : 0, max: 20 }, ...conduct(s)]);
    },
  },
  {
    id: 'W-E', group: 'Work setup', title: 'E · G54 and G55 for two workpieces',
    outcomes: ['Use one offset per workpiece', 'Account for different part heights', 'Switch the active offset'],
    objective: 'G54 = top front-left of A (vice). G55 = top front-left of B (platter). H is measured to A top, so G55 Z = B top − A top. Then make G55 active.',
    setup: () => base(1),
    guide: (s) => {
      const dz = r3(pieceTop(s, piece(s, 'B')) - pieceTop(s, piece(s, 'A')));
      const st = pointerFlow(s, 'G54') ?? pointerFlow(s, 'G55'); if (st) return st;
      if (!near(s.work.G55.Z, dz, 0.01)) return cell(s, 1, 2) ?? typeValue(s, dz, 'F1', `G55 Z = B top − A top = ${f3(dz)}`);
      if (s.activeWcs !== 'G55') return { text: 'Make G55 active and watch the WORK coordinates change.', target: 'wcs-G55' };
      return null;
    },
    hints: ['Raise Z before moving between parts.', 'B is lower than A, so its Z offset is negative.'],
    commonErrors: ['Recording B into G54', 'Using G55 Z = 0 for a lower part'],
    assess: (s) => {
      const a = trueWork(s, P, 'G54'), b = trueWork(s, P, 'G55'), dz = pieceTop(s, piece(s, 'B')) - pieceTop(s, piece(s, 'A'));
      return score([acc('G54 X', s.work.G54.X - a.X, 0.05, 10), acc('G54 Y', s.work.G54.Y - a.Y, 0.05, 10), acc('G55 X', s.work.G55.X - b.X, 0.05, 15),
        acc('G55 Y', s.work.G55.Y - b.Y, 0.05, 15), acc('G55 Z', s.work.G55.Z - dz, 0.01, 20), { label: 'G54 Z = 0', points: s.work.G54.Z === 0 ? 10 : 0, max: 10 }, ...conduct(s)]);
    },
  },
  {
    id: 'W-F', group: 'Work setup', title: 'F · Identify incorrect work offsets',
    outcomes: ['Check offsets against the part', 'Recognise sign, radius and datum errors'],
    objective: 'G54–G59 are filled in. Tick every offset that does not match its workpiece datum (see SETUP for the intended datum of each).',
    setup: () => {
      let s = base(7, {
        wcsPiece: { G54: 'A', G55: 'B', G56: 'A', G57: 'A', G58: 'A', G59: 'B' },
        wcsDatum: { G54: { type: 'TFL', custom: [0, 0, 0] }, G55: { type: 'TFL', custom: [0, 0, 0] }, G56: { type: 'TC', custom: [0, 0, 0] },
          G57: { type: 'TFL', custom: [0, 0, 0] }, G58: { type: 'TFR', custom: [0, 0, 0] }, G59: { type: 'TC', custom: [0, 0, 0] } },
      });
      for (const w of WCS) { const t = trueWork(s, P, w); s = writeWork(writeWork(s, w, 'X', t.X, P, true), w, 'Y', t.Y, P, true); }
      if (pieceTop(s, piece(s, 'B')) !== pieceTop(s, piece(s, 'A'))) for (const w of ['G55', 'G59'] as const) s = writeWork(s, w, 'Z', pieceTop(s, piece(s, 'B')) - pieceTop(s, piece(s, 'A')), P, true);
      s = writeWork(s, 'G55', 'X', -s.work.G55.X, P, true); // sign error
      s = writeWork(s, 'G56', 'Y', s.work.G56.Y - piece(s, 'A').size[1] / 2, P, true); // front edge, not centre
      s = writeWork(s, 'G57', 'X', s.work.G57.X - 3, P, true); // edge finder radius not applied
      return { ...s, message: 'Lesson loaded' };
    },
    guide: (s) => ({ text: 'For each offset: make it active, jog the pointer (T7) to the intended datum — WORK X/Y should read 0.000. Tick the wrong ones and press Check.', target: 'wcs-G54,wcs-G55,wcs-G56,wcs-G57,wcs-G58,wcs-G59' }),
    hints: ['Offsets are normally negative.', 'An error of exactly the tip radius points to a missing correction.'],
    commonErrors: ['Trusting offsets without checking', 'Confusing intended datums'],
    questions: [{ id: 'wrong', label: 'Incorrect offsets', kind: 'multi', options: [...WCS] }],
    assess: (s, a) => {
      const picked = new Set((a.wrong ?? '').split(',').filter(Boolean));
      return score([...WCS.map((w) => { const t = trueWork(s, P, w); const bad = !near(s.work[w].X, t.X, 0.05) || !near(s.work[w].Y, t.Y, 0.05);
        return { label: `${w} ${bad ? 'incorrect' : 'correct'}`, points: picked.has(w) === bad ? 10 : 0, max: 10 }; }), ...conduct(s)]);
    },
  },
  {
    id: 'W-G', group: 'Work setup', title: 'G · Diagnose tool length + work offset',
    outcomes: ['Combine H and work Z correctly', 'Recognise double application (S1 caution)', 'Fix the setup'],
    objective: 'H1 was measured to the part top, and G54 Z was also set at the part top. Diagnose "G43 H01 Z5.0", predict the result, then fix G54.',
    setup: () => { let s = base(1); const t = trueWork(s, P, 'G54'); s = writeWork(writeWork(s, 'G54', 'X', t.X, P, true), 'G54', 'Y', t.Y, P, true); return writeWork(s, 'G54', 'Z', s.offsets[1].hGeom, P, true); },
    guide: (s, a) => {
      if (!a.diag) return { text: `Compensation check: work Z ${f3(s.work.G54.Z)} + H1 ${f3(s.offsets[1].hGeom)} → commanded machine Z ${f3(g43Check(s, P, 1, 5).machineZ)}. Choose a diagnosis.`, target: 'lesson-q-diag' };
      if (!a.result) return { text: 'What would happen when the programme runs?', target: 'lesson-q-result' };
      if (s.work.G54.Z !== 0) return cell(s, 0, 2) ?? { text: 'Press ORIGIN to zero G54 Z (keep part-top H values).', target: 'key-ORIGIN' };
      return null;
    },
    hints: ['Machine Z = programmed Z + work Z + H.'],
    commonErrors: ['Zeroing H instead of G54 Z without re-measuring', 'Ignoring the overtravel warning'],
    questions: [{ id: 'diag', label: 'Diagnosis', kind: 'choice', options: ['double application', 'H too long', 'work Z sign', 'no error'] },
      { id: 'result', label: 'Result', kind: 'choice', options: ['overtravel / crash', 'cuts shallow', 'correct'] }],
    assess: (s, a) => score([
      { label: 'Diagnosis', points: a.diag === 'double application' ? 25 : 0, max: 25 },
      { label: 'Predicted result', points: a.result === 'overtravel / crash' ? 15 : 0, max: 15 },
      { label: 'Fixed (combined error ≈ 0)', points: near(g43Check({ ...s, activeWcs: 'G54' }, P, 1, 5).combinedError, 0, 0.01) ? 40 : 0, max: 40 },
      ...conduct(s),
    ]),
  },
];

WORK_LESSONS_REF.list.push(...WORK_LESSONS);
