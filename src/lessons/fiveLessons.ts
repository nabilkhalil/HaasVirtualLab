import { UMC500 as P } from '../config/umc500';
import { FACES, initialState, reduce, writeOffset, writeWork, type MachineState, type Mode } from '../engine/machine';
import { ctrlPivots, positionReport, requiredBC, rotate, sphereWorld, tcpcPaths, truePivots, type V3 } from '../engine/fiveaxis';
import { findTool, idealHFor, r3, toolPose } from '../engine/tools';
import { datumLocal, obstacles, piece, trueWork } from '../engine/workholding';
import type { Score } from '../store/lessonStore';
import { DEFAULT_DEMO } from '../store/fiveStore';
import { WORK_LESSONS_REF, type Lesson, type Step } from './toolLessons';
import { conduct, move } from './workLessons';

const g = P.geometry;
const f3 = (v: number) => v.toFixed(3);
const score = (items: Score['items']): Score => ({ items, total: items.reduce((a, i) => a + i.points, 0), max: items.reduce((a, i) => a + i.max, 0) });
const near = (a: number, b: number, t: number) => Math.abs(a - b) <= t;
const q = (a: Record<string, string>, id: string, want: string, pts: number, label: string) => ({ label, points: a[id] === want ? pts : 0, max: pts });
const num = (a: Record<string, string>, id: string, want: number, tol: number, pts: number, label: string) =>
  ({ label, points: Number.isFinite(Number(a[id])) && a[id] !== undefined && near(Number(a[id]), want, tol) ? pts : 0, max: pts, detail: `expected ${f3(want)}` });

/** Base: Haas part-top H for all tools, G54 at the top centre of A, tool `t` loaded. */
function base(t: number, extra: Partial<MachineState> = {}): MachineState {
  let s = initialState(P);
  s = { ...s, activeTool: t, check: { h: t, d: t, z: 5 }, setup: { ...s.setup, wcsDatum: { ...s.setup.wcsDatum, G54: { type: 'TC', custom: [0, 0, 0] } } } };
  for (const tl of s.tools) s = writeOffset(s, tl.number, 'hGeom', idealHFor(s, tl, P), P, true);
  const tw = trueWork(s, P, 'G54');
  s = writeWork(writeWork(s, 'G54', 'X', tw.X, P, true), 'G54', 'Y', tw.Y, P, true);
  return { ...s, ...extra, message: 'Lesson loaded' };
}
const at = (s: MachineState, m: Partial<MachineState['machine']>, mode: Mode = 'HANDLE_JOG'): MachineState => ({ ...s, mode, machine: { ...s.machine, ...m } });
const mdiRotate = (B: number, C: number): Step => ({ text: `Open 5-AXIS, enter B${B} C${C} and press "G00 B C" (simulated MDI).`, target: 'tab-5AXIS,mdi-rotate', act: { type: 'MDI_ROTATE', B, C } });
const handleJog = (s: MachineState): Step | null => (s.mode !== 'HANDLE_JOG' ? { text: 'Press HANDLE JOG to return to jog mode.', target: 'key-HANDLE_JOG' } : null);
const selAxis = (s: MachineState, a: 'B' | 'C'): Step | null => (s.selectedAxis !== a ? { text: `Select the ${a} axis.`, target: `sel-${a}`, act: { type: 'SELECT_AXIS', axis: a } } : null);

/** Highest obstacle point in the scene (rotated), for safe travel heights. */
function maxObsZ(s: MachineState) {
  let m = -Infinity;
  for (const o of obstacles(s)) for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1])
    m = Math.max(m, rotate([o.center[0] + (i * o.size[0]) / 2, o.center[1] + (j * o.size[1]) / 2, o.center[2] + (k * o.size[2]) / 2], s.machine.B, s.machine.C, truePivots(P))[2]);
  return m;
}
/** Jog the tool to scene XY then lower the tip to height h, retracting first if needed. */
function jogTo(s: MachineState, x: number, y: number, h: number, why: string): Step | null {
  const hj = handleJog(s); if (hj) return hj;
  const L = toolPose(s, P).length, tip = toolPose(s, P).tipZ;
  const mx = r3(x + g.xAtCentre), my = r3(y + g.yAtCentre), mz = r3(h + L - g.gaugeLineAtZ0);
  const inXY = near(s.machine.X, mx, 0.5) && near(s.machine.Y, my, 0.5);
  if (!inXY && tip < maxObsZ(s) + 10) return move(s, 'Z', Math.min(0, r3(maxObsZ(s) + 20 + L - g.gaugeLineAtZ0)), 1, 'Raise Z clear of the rotated parts');
  return move(s, 'X', mx, 0.5, why) ?? move(s, 'Y', my, 0.5, why) ?? move(s, 'Z', mz, 0.5, why);
}

export const FIVE_LESSONS: Lesson[] = [
  {
    id: 'F-A', group: '5-axis', title: 'A · Identify B and C axis movements',
    outcomes: ['Recognise trunnion tilt (B) and platter rotation (C)', 'Know the UMC-500 B travel'],
    objective: 'Jog B by at least +10° and C by at least +30° in HANDLE JOG, watch the 3D machine, then answer.',
    setup: () => base(1),
    guide: (s, a) => {
      if (s.machine.B < 10) return selAxis(s, 'B') ?? (s.jogIncrement !== 1 ? { text: 'Select the 1 increment (1° per click for rotary axes).', target: 'inc-1', act: { type: 'SET_INCREMENT', increment: 1 } } : { text: 'Jog +B and watch the trunnion tilt about the Y-parallel B axis.', target: 'jog-B+', act: { type: 'JOG', axis: 'B', direction: 1 } });
      if (s.machine.C < 30) return selAxis(s, 'C') ?? { text: 'Jog +C and watch the platter turn about its own centre.', target: 'jog-C+', act: { type: 'JOG', axis: 'C', direction: 1 } };
      for (const id of ['tilt', 'rot', 'range']) if (!a[id]) return { text: 'Answer the questions below.', target: `lesson-q-${id}` };
      return null;
    },
    hints: ['B moves the whole trunnion; C turns only the platter.', 'Rotary positions are in degrees.'],
    commonErrors: ['Confusing B with C', 'Assuming B can tilt to -110°'],
    questions: [{ id: 'tilt', label: 'Tilts the trunnion', kind: 'choice', options: ['B', 'C'] }, { id: 'rot', label: 'Rotates the platter', kind: 'choice', options: ['B', 'C'] },
      { id: 'range', label: 'UMC-500 B travel', kind: 'choice', options: ['-35 to +120', '-110 to +35', '0 to 360'] }],
    assess: (s, a) => score([{ label: 'Jogged B ≥ 10°', points: s.machine.B >= 10 ? 10 : 0, max: 10 }, { label: 'Jogged C ≥ 30°', points: s.machine.C >= 30 ? 10 : 0, max: 10 },
      q(a, 'tilt', 'B', 20, 'B tilts'), q(a, 'rot', 'C', 20, 'C rotates'), q(a, 'range', '-35 to +120', 20, 'B range (S3)'), ...conduct(s)]),
  },
  {
    id: 'F-B', group: '5-axis', title: 'B · Position at B45 C120',
    outcomes: ['Use rotary jog increments', 'Read the rotary position display'],
    objective: 'In HANDLE JOG, position the workpiece at exactly B 45.000° and C 120.000°.',
    setup: () => base(1),
    guide: (s) => handleJog(s) ?? (s.machine.B !== 45 ? selAxis(s, 'B') ?? move(s, 'B' as never, 45, 0, 'Tilt to B45') : null) ?? (s.machine.C !== 120 ? selAxis(s, 'C') ?? move(s, 'C' as never, 120, 0, 'Rotate to C120') : null),
    hints: ['Use 1° for coarse moves, then 0.1/0.01/0.001°.'],
    commonErrors: ['Stopping close but not exact', 'Rotating C the long way'],
    assess: (s) => score([{ label: 'B = 45.000', points: s.machine.B === 45 ? 40 : 0, max: 40, detail: f3(s.machine.B) }, { label: 'C = 120.000', points: s.machine.C === 120 ? 40 : 0, max: 40, detail: f3(s.machine.C) }, ...conduct(s).slice(0, 1).map((i) => ({ ...i, max: 20, points: i.points * 2 }))]),
  },
  {
    id: 'F-C', group: '5-axis', title: 'C · Work coordinates after rotation',
    outcomes: ['Separate machine/work display from the physical part', 'See why a fixed G54 is wrong after rotation'],
    objective: 'The pointer is 1 mm above the G54 datum (top centre of A). Rotate C to 90°, watch the WORK display and the part, then answer.',
    setup: () => {
      let s = base(7, { setup: { ...initialState(P).setup, wcsDatum: { ...initialState(P).setup.wcsDatum, G54: { type: 'TFL', custom: [0, 0, 0] } } } });
      const t = trueWork(s, P, 'G54');
      s = writeWork(writeWork(s, 'G54', 'X', t.X, P, true), 'G54', 'Y', t.Y, P, true);
      return at(s, { X: t.X, Y: t.Y, Z: r3(t.datumZ + 1 + 100 - g.gaugeLineAtZ0) });
    },
    guide: (s, a) => {
      if (s.machine.C !== 90) return handleJog(s) ?? selAxis(s, 'C') ?? move(s, 'C' as never, 90, 0, 'Rotate C to 90');
      for (const id of ['work', 'over', 'dist']) if (!a[id]) return { text: 'Compare the WORK display, the pointer and the datum triad; answer below.', target: `lesson-q-${id}` };
      return null;
    },
    hints: ['WORK = machine − offset; no linear axis moved.', 'The corner moved on a circle about the C centre.'],
    commonErrors: ['Assuming G54 follows the part without DWO'],
    questions: [{ id: 'work', label: 'WORK X/Y changed?', kind: 'choice', options: ['yes', 'no'] }, { id: 'over', label: 'Pointer still over the corner?', kind: 'choice', options: ['yes', 'no'] },
      { id: 'dist', label: 'Corner moved in XY (mm)', kind: 'number' }],
    assess: (s, a) => {
      const c0 = datumLocal(s, piece(s, 'A'), s.setup.wcsDatum.G54), c1 = rotate(c0, 0, 90, truePivots(P));
      return score([q(a, 'work', 'no', 25, 'WORK display unchanged'), q(a, 'over', 'no', 25, 'Pointer no longer at corner'), num(a, 'dist', Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), 0.5, 30, 'Corner displacement'), ...conduct(s)]);
    },
  },
  {
    id: 'F-D', group: '5-axis', title: 'D · Virtual MRZP calibration',
    outcomes: ['Explain MRZP (settings 255–257)', 'Measure a sphere at several orientations', 'Apply simulated calibration values'],
    objective: 'Probe the calibration sphere at B0 C0, B0 C180 and B90 C0, then apply the estimated MRZP to the simulated settings.',
    setup: () => base(5, { setup: { ...initialState(P).setup, sphere: true, wcsDatum: { ...initialState(P).setup.wcsDatum } }, mrzpError: { X: 0.3, Y: 0, Z: -0.2 } }),
    guide: (s, a) => {
      if (!near(s.mrzpError.X, 0, 0.002) || !near(s.mrzpError.Z, 0, 0.002) || s.mrzpHits.length < 3) {
        for (const [B, C] of [[0, 0], [0, 180], [90, 0]]) {
          if (s.mrzpHits.some((h) => h.B === B && h.C === C)) continue;
          if (s.machine.B !== B || s.machine.C !== C) {
            if (s.machine.Z < -1) return handleJog(s) ?? move(s, 'Z', 0, 0.5, 'Retract Z before rotating');
            return mdiRotate(B, C);
          }
          const c = sphereWorld(s, P);
          const st = jogTo(s, c[0], c[1], c[2] + 12.7 + 5 - 3 + 3, 'Bring the probe about 5 mm above the sphere'); if (st) return st;
          return { text: `Press "Probe sphere" (simulated cycle) at B${B} C${C}.`, target: 'tab-5AXIS,probe-sphere', act: { type: 'PROBE_SPHERE' } };
        }
        return { text: 'Three orientations measured: press "Apply estimate" (simulated settings only).', target: 'tab-5AXIS,apply-mrzp', act: { type: 'APPLY_MRZP' } };
      }
      return a.set ? null : { text: 'Which settings hold the MRZP?', target: 'lesson-q-set' };
    },
    hints: ['C centre = midpoint of C0 and C180 sphere centres.', 'B centre = centre of the arc between B0 and B90.'],
    commonErrors: ['Rotating with the probe low', 'Probing only one orientation'],
    questions: [{ id: 'set', label: 'MRZP settings', kind: 'choice', options: ['255-257', '64', '142'] }],
    assess: (s, a) => score([{ label: 'Orientations measured', points: Math.min(3, s.mrzpHits.length) * 10, max: 30, detail: `${s.mrzpHits.length}` },
      { label: 'Simulated MRZP corrected', points: Math.hypot(s.mrzpError.X, s.mrzpError.Y, s.mrzpError.Z) <= 0.01 ? 30 : 0, max: 30, detail: `|err| ${f3(Math.hypot(s.mrzpError.X, s.mrzpError.Y, s.mrzpError.Z))}` },
      q(a, 'set', '255-257', 20, 'Settings 255–257'), ...conduct(s)]),
  },
  {
    id: 'F-E', group: '5-axis', title: 'E · Incorrect MRZP values',
    outcomes: ['Relate MRZP errors to tip errors', 'Identify which setting is wrong'],
    objective: 'DWO is active at B45 and the pointer is at G54 X0 Y0 Z5, but the simulated MRZP is wrong. Measure the miss, name the wrong settings, then correct them.',
    setup: () => {
      const s = base(7, { mrzpError: { X: 0.4, Y: 0, Z: -0.3 } });
      return { ...reduce({ ...s, machine: { ...s.machine, B: 45 }, comp: 'G254', mode: 'MDI_SIM' }, { type: 'MDI_MOVE', w: [0, 0, 5] }, P), message: 'Lesson loaded' };
    },
    guide: (s, a) => {
      if (!a.miss) return { text: 'Read |e| (tip − part point) in the 5-AXIS report and enter it.', target: 'tab-5AXIS,lesson-q-miss' };
      if (!a.which) return { text: 'Which settings differ from the true rotary centre?', target: 'lesson-q-which' };
      if (s.mrzpError.X || s.mrzpError.Y || s.mrzpError.Z) return { text: 'Correct the simulated calibration errors to 0 (or run the MRZP demonstration).', target: 'mrzp-err-X', act: { type: 'SET_MRZP_ERROR', X: 0, Y: 0, Z: 0 } };
      return null;
    },
    hints: ['At B0 C0 an MRZP error does nothing; it grows with the rotation angle.'],
    commonErrors: ['Correcting G54 instead of the MRZP'],
    questions: [{ id: 'miss', label: 'Tip miss |e| (mm)', kind: 'number' }, { id: 'which', label: 'Wrong settings', kind: 'multi', options: ['255', '256', '257'] }],
    assess: (s, a) => {
      const st = { ...s, machine: { ...s.machine, B: 45, C: 0 }, mrzpError: { X: 0.4, Y: 0, Z: -0.3 } };
      const e = Math.hypot(...(() => { const w = rotate([0, 0, 115], 45, 0, ctrlPivots(st, P)), t = rotate([0, 0, 115], 45, 0, truePivots(P)); return [w[0] - t[0], w[1] - t[1], w[2] - t[2]]; })());
      return score([num(a, 'miss', e, 0.05, 25, 'Miss size'), { label: 'Wrong settings', points: a.which === '255,257' ? 25 : 0, max: 25 },
        { label: 'MRZP corrected', points: !s.mrzpError.X && !s.mrzpError.Y && !s.mrzpError.Z ? 30 : 0, max: 30 }, ...conduct(s)]);
    },
  },
  {
    id: 'F-F', group: '5-axis', title: 'F · Positioning with and without DWO',
    outcomes: ['See the error of a fixed G54 after rotation', 'Apply G254 correctly (after rotary positioning)'],
    objective: 'The part is at B30 C90. Move the pointer to G54 X0 Y0 Z10 with G43 only, note the miss, then use G254 and move again.',
    setup: () => { const s = base(7); return { ...s, machine: { ...s.machine, B: 30, C: 90 }, mode: 'MDI_SIM' }; },
    guide: (s, a) => {
      if (!a.miss) {
        if (s.lastPoint === null || s.comp !== 'G43') return { text: 'With G43 only, press "G00 to point" for X0 Y0 Z10.', target: 'tab-5AXIS,mdi-move', act: { type: 'MDI_MOVE', w: [0, 0, 10] } };
        return { text: `The tip misses the part point by |e| shown in the report. Enter it.`, target: 'lesson-q-miss' };
      }
      if (s.comp !== 'G254') return { text: 'Rotary motion is complete: press G254 (DWO).', target: 'tab-5AXIS,mdi-g254', act: { type: 'MDI', cmd: 'G254' } };
      if (positionReport(s, P, [0, 0, 10]).mag > 0.01) return { text: 'With G254 active, press "G00 to point" again (X/Y then Z).', target: 'tab-5AXIS,mdi-move', act: { type: 'MDI_MOVE', w: [0, 0, 10] } };
      return a.cancel ? null : { text: 'Which code must cancel DWO before the next rotation?', target: 'lesson-q-cancel' };
    },
    hints: ['G254 after the work offset and after rotary positioning (Haas).'],
    commonErrors: ['Rotating with G254 active', 'Expecting G54 to follow the part'],
    questions: [{ id: 'miss', label: 'Miss without DWO (mm)', kind: 'number' }, { id: 'cancel', label: 'Cancel DWO with', kind: 'choice', options: ['G255', 'G49', 'G234'] }],
    assess: (s, a) => {
      const g43 = { ...s, comp: 'G43' as const };
      const tip = rotate([0, 0, 0], 0, 0, truePivots(P)); void tip;
      const q0 = (() => { const o = g43.work.G54; return [o.X - g.xAtCentre, o.Y - g.yAtCentre, 10 + 110] as V3; })();
      const phys = rotate(q0, 30, 90, truePivots(P));
      return score([num(a, 'miss', Math.hypot(q0[0] - phys[0], q0[1] - phys[1], q0[2] - phys[2]), 0.5, 30, 'Miss without DWO'),
        { label: 'DWO move accurate', points: s.comp === 'G254' && positionReport(s, P, [0, 0, 10]).mag <= 0.01 ? 40 : 0, max: 40 }, q(a, 'cancel', 'G255', 10, 'G255 cancels'), ...conduct(s).slice(0, 1).map((i) => ({ ...i, max: 20, points: i.points * 2 }))]);
    },
  },
  {
    id: 'F-G', group: '5-axis', title: 'G · Tool tip trajectory with and without TCPC',
    outcomes: ['Explain TCPC for simultaneous motion', 'Know G234/G254 incompatibility'],
    objective: 'In 5-AXIS, animate the demo move with TCPC off and on (X−40→+40 while B 0→30). Compare the tip paths and answer.',
    setup: () => base(7),
    guide: (s, a) => {
      for (const id of ['dev', 'keeps', 'combo']) if (!a[id]) return { text: id === 'dev' ? 'Press "Animate TCPC off", then "Animate TCPC on"; read the maximum deviation without TCPC.' : 'Answer the questions.', target: id === 'dev' ? 'tab-5AXIS,tcpc-off,lesson-q-dev' : `lesson-q-${id}` };
      return null;
    },
    hints: ['TCPC keeps the programmed path fixed to the rotating table.', 'Haas: G234 cannot be used with G254; G234 cancels G43.'],
    commonErrors: ['Using DWO for simultaneous moves', 'Forgetting the H-code on the G234 block'],
    questions: [{ id: 'dev', label: 'Max deviation without TCPC (mm)', kind: 'number' }, { id: 'keeps', label: 'Keeps the tip on the path', kind: 'choice', options: ['TCPC on', 'TCPC off'] },
      { id: 'combo', label: 'G234 together with G254?', kind: 'choice', options: ['allowed', 'not allowed'] }],
    assess: (s, a) => score([num(a, 'dev', tcpcPaths(s, P, DEFAULT_DEMO).devOff, 1, 30, 'Deviation'), q(a, 'keeps', 'TCPC on', 25, 'TCPC on'), q(a, 'combo', 'not allowed', 25, 'Incompatible modes'), ...conduct(s).slice(0, 1).map((i) => ({ ...i, max: 20, points: i.points * 2 }))]),
  },
  {
    id: 'F-H', group: '5-axis', title: 'H · 3+2 multi-face setup',
    outcomes: ['Find the B/C orientation for each face', 'Compare 3-axis and 3+2 setups'],
    objective: 'Orient workpiece A so the Top, Front, Side and Inclined (30°) faces each face the spindle; confirm each. Then answer.',
    setup: () => base(1),
    guide: (s, a) => {
      for (const f of Object.keys(FACES)) if (!s.faceLog.includes(f)) {
        const r = requiredBC(FACES[f], P)!;
        if (s.machine.B !== r.B || s.machine.C !== r.C) return { ...mdiRotate(r.B, r.C), text: `Select "${f}" in 3+2: it needs B${r.B} C${r.C}. Press "Rotate to face".`, target: 'tab-5AXIS,face-select,face-rotate' };
        return { text: `Confirm the ${f} face.`, target: 'face-confirm', act: { type: 'CONFIRM_FACE', face: f } };
      }
      return a.setups ? null : { text: 'How many separate setups would a 3-axis mill need?', target: 'lesson-q-setups' };
    },
    hints: ['Faces on ±Y need C±90 before tilting B.', 'The inclined face uses negative B (limit −35°).'],
    commonErrors: ['Choosing B outside −35..+120', 'Tilting before rotating C'],
    questions: [{ id: 'setups', label: '3-axis setups needed', kind: 'number' }],
    assess: (s, a) => score([...Object.keys(FACES).map((f) => ({ label: `${f} face`, points: s.faceLog.includes(f) ? 15 : 0, max: 15 })), num(a, 'setups', Object.keys(FACES).length, 0, 20, '3-axis setups'), ...conduct(s).slice(0, 1).map((i) => ({ ...i, max: 20, points: i.points * 2 }))]),
  },
  {
    id: 'F-I', group: '5-axis', title: 'I · Rotary collision risks',
    outcomes: ['Check a rotation sweep before moving', 'Retract before rotating'],
    objective: 'A long drill (T4) is low beside the part. Check whether B90 is safe, make it safe, then rotate to B90 without a collision.',
    setup: () => base(4, { machine: { ...initialState(P).machine, X: g.xAtCentre - 140, Y: g.yAtCentre, Z: -250 } }),
    guide: (s, a) => {
      if (!a.safe) return { text: 'Enter B90 and press "Check sweep" (no motion), then answer.', target: 'tab-5AXIS,mdi-rotate-check,lesson-q-safe', act: { type: 'MDI_ROTATE', B: 90, dryRun: true } };
      if (s.machine.B === 90) return null;
      if (s.machine.Z !== 0) {
        if (s.mode !== 'ZERO_RETURN') return { text: 'Press ZERO RETURN.', target: 'key-ZERO_RETURN', act: { type: 'KEY', key: 'ZERO_RETURN' } };
        if (s.selectedAxis !== 'Z') return { text: 'Select the Z axis.', target: 'sel-Z', act: { type: 'SELECT_AXIS', axis: 'Z' } };
        return { text: 'Press SINGLE to return Z to machine zero.', target: 'key-SINGLE', act: { type: 'KEY', key: 'SINGLE' } };
      }
      return mdiRotate(90, s.machine.C);
    },
    hints: ['The whole part and platter sweep through space during B motion.'],
    commonErrors: ['Rotating at low Z', 'Checking only the end position'],
    questions: [{ id: 'safe', label: 'B90 safe from the start position?', kind: 'choice', options: ['yes', 'no'] }],
    assess: (s, a) => score([q(a, 'safe', 'no', 30, 'Risk identified'), { label: 'At B90', points: s.machine.B === 90 ? 30 : 0, max: 30 }, ...conduct(s).map((i) => ({ ...i, max: i.max * 2, points: i.points * 2 }))]),
  },
];
WORK_LESSONS_REF.list.push(...FIVE_LESSONS);
void findTool;
