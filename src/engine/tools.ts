import { OFFSET_RANGES, OFFSET_ROWS, type OffsetField, type PhysicalTool } from '../config/tools';
import { stockTop, type MachineProfile } from '../config/umc500';
import { piece, pieceTop, surfaceUnderTool, toolInterference, trueWork } from './workholding';
import type { MachineState } from './machine';

/**
 * Reference planes (never mixed):
 *  - Spindle gauge line: physical tool length L is measured from here to the tip (physical data only).
 *  - Part top (stock top): Haas tool length offset reference (S1 p.168). With Setting 64 OFF the
 *    stored H geometry = machine Z when the tip is at the part top (negative number).
 * Stored offsets never read physical L; physical L is only used for "truth" (tip position, scoring, errors).
 */
export interface OffsetRow { hGeom: number; hWear: number; dGeom: number; dWear: number }
export type OffsetTable = Record<number, OffsetRow>;

export const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function emptyOffsets(): OffsetTable {
  const t: OffsetTable = {};
  for (let i = 1; i <= OFFSET_ROWS; i++) t[i] = { hGeom: 0, hWear: 0, dGeom: 0, dWear: 0 };
  return t;
}

export function validateOffset(field: OffsetField, value: number): string | null {
  if (!Number.isFinite(value)) return 'Invalid number';
  const r = OFFSET_RANGES[field];
  if (value < r.min || value > r.max) return `Out of range (${r.min} to ${r.max})`;
  return null;
}

export const findTool = (s: MachineState, n: number): PhysicalTool | undefined => s.tools.find((t) => t.number === n);

const rot = (a: number, b: number, ang: number): [number, number] => [a * Math.cos(ang) - b * Math.sin(ang), a * Math.sin(ang) + b * Math.cos(ang)];

/** Platter frame (origin platter top centre) -> machine scene frame. Rotate C, then tilt B about the pivot. */
export function platterToWorld(p: [number, number, number], s: MachineState, prof: MachineProfile): [number, number, number] {
  const c = (s.machine.C * Math.PI) / 180, b = (s.machine.B * Math.PI) / 180, d = prof.geometry.trunnionPivotBelowPlatter;
  let [x, y] = rot(p[0], p[1], c); let z = p[2] + d;
  if (prof.geometry.bTiltAxis === 'X') [y, z] = rot(y, z, b); else [z, x] = rot(z, x, b);
  return [r3(x), r3(y), r3(z - d)];
}

/** Inverse of platterToWorld. */
export function worldToPlatter(p: [number, number, number], s: MachineState, prof: MachineProfile): [number, number, number] {
  const c = (s.machine.C * Math.PI) / 180, b = (s.machine.B * Math.PI) / 180, d = prof.geometry.trunnionPivotBelowPlatter;
  let [x, y, z] = [p[0], p[1], p[2] + d];
  if (prof.geometry.bTiltAxis === 'X') [y, z] = rot(y, z, -b); else [z, x] = rot(z, x, -b);
  [x, y] = rot(x, y, -c);
  return [x, y, z - d];
}

/** Physical tool pose in the scene frame (truth). */
export function toolPose(s: MachineState, prof: MachineProfile) {
  const g = prof.geometry, tool = findTool(s, s.activeTool);
  const gaugeLine: [number, number, number] = [r3(s.machine.X - g.xAtCentre), r3(s.machine.Y - g.yAtCentre), r3(s.machine.Z + g.gaugeLineAtZ0)];
  const length = tool?.length ?? 0;
  return { tool, gaugeLine, length, tipZ: r3(gaugeLine[2] - length), radius: (tool?.diameter ?? 0) / 2 };
}

/** Static check of the physical tool against workpieces, fixtures and platter (see workholding.ts). */
export function collision(s: MachineState, prof: MachineProfile): string | null {
  return toolInterference(s, prof)?.msg ?? null;
}

/** Gap between the physical tip and the workpiece top under the tool (B = 0), else null. */
export function referenceGap(s: MachineState, prof: MachineProfile): number | null {
  return surfaceUnderTool(s, prof)?.gap ?? null;
}

export type PaperState = 'NOT OVER PART' | 'PAPER FREE' | 'PAPER DRAGS' | 'PAPER PINCHED';
/** Simulated paper feel (simulator thresholds; paper thickness from profile). */
export function paperState(gap: number | null, prof: MachineProfile): PaperState {
  if (gap === null) return 'NOT OVER PART';
  if (gap > prof.paperThickness + 0.03) return 'PAPER FREE';
  if (gap >= prof.paperThickness - 0.0005) return 'PAPER DRAGS';
  return 'PAPER PINCHED';
}

/** Ideal H geometry (machine Z with tip exactly at the default part top). TRUTH, for scoring/feedback only. */
export const idealH = (tool: PhysicalTool, prof: MachineProfile) => r3(stockTop(prof) + tool.length - prof.geometry.gaugeLineAtZ0);
/** Ideal H to the current top of workpiece A (Haas convention: H to part top, work Z = 0). */
export const idealHFor = (s: MachineState, tool: PhysicalTool, prof: MachineProfile) => r3(pieceTop(s, piece(s, 'A')) + tool.length - prof.geometry.gaugeLineAtZ0);

/**
 * G43 check for "G43 H{h} Z{z}" in the active work offset (S1: G54-G59 interpret positions in that system).
 * Machine Z = z + work Z + H(total). Actual tip is reported relative to the PHYSICAL datum of the workpiece
 * assigned to the active work offset. Tool length error (H vs part-top ideal) is reported separately.
 */
export function g43Check(s: MachineState, prof: MachineProfile, h: number, z: number, d = h, toolNo = s.activeTool) {
  const tool = findTool(s, toolNo);
  const row = s.offsets[h] ?? { hGeom: 0, hWear: 0, dGeom: 0, dWear: 0 };
  const drow = s.offsets[d] ?? row;
  const work = s.work[s.activeWcs];
  const storedH = r3(row.hGeom + row.hWear), storedD = r3(drow.dGeom + drow.dWear);
  const machineZ = r3(z + work.Z + storedH);
  const truth = trueWork(s, prof, s.activeWcs);
  const L = tool?.length ?? 0;
  const tipScene = machineZ + prof.geometry.gaugeLineAtZ0 - L;
  const actualTip = tool ? r3(tipScene - truth.datumZ) : z;
  const top = pieceTop(s, truth.piece);
  const ideal = tool ? idealHFor(s, tool, prof) : 0;
  return {
    tool, storedH, storedD, workZ: work.Z, machineZ, idealH: ideal,
    lengthError: tool ? r3(storedH - ideal) : 0,
    /** Combined work Z + H error: actual tip minus programmed tip. */
    combinedError: r3(actualTip - z),
    programmedTip: z, actualTip,
    diameterError: tool ? r3(storedD - tool.diameter) : 0,
    /** Real tip ends below the part top although the programme expects it higher. */
    collision: !!tool && tipScene < top - 1e-9 && actualTip < z - 0.01,
    overtravel: machineZ < prof.limits.Z.min || machineZ > prof.limits.Z.max,
    /** S1 caution: nonzero work Z together with part-top tool offsets (|H| large) applies the part top twice. */
    doubleApplied: work.Z !== 0 && Math.abs(storedH) > 50,
  };
}
