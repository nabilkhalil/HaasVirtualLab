import type { MachineProfile } from '../config/umc500';
import type { MachineState } from './machine';
import { r3, toolPose } from './tools';
import { trueWork } from './workholding';

const f = (v: number) => v.toFixed(3);
type XYZ = { X: number; Y: number; Z: number };

/**
 * Coordinate systems for the current state:
 *  machine    — position relative to machine zero (S1 MACHINE)
 *  work       — machine − active work offset (S1 WORK (Gxx); tool offset not included — simulator assumption)
 *  programmed — the coordinate a programme would use with G43 H{check.h}: work Z − H(total)
 *  tip        — PHYSICAL tool tip relative to the physical datum of the workpiece assigned to the active WCS
 */
export function coords(s: MachineState, p: MachineProfile) {
  const m = s.machine, w = s.work[s.activeWcs], row = s.offsets[s.check.h];
  const H = r3(row.hGeom + row.hWear);
  const work: XYZ = { X: r3(m.X - w.X), Y: r3(m.Y - w.Y), Z: r3(m.Z - w.Z) };
  const programmed: XYZ = { ...work, Z: r3(m.Z - w.Z - H) };
  const t = trueWork(s, p, s.activeWcs), pose = toolPose(s, p);
  const tip: XYZ = { X: r3(m.X - t.X), Y: r3(m.Y - t.Y), Z: r3(pose.tipZ - t.datumZ) };
  const breakdown = [
    `Work X = machine X ${f(m.X)} − ${s.activeWcs} X ${f(w.X)} = ${f(work.X)}`,
    `Work Y = machine Y ${f(m.Y)} − ${s.activeWcs} Y ${f(w.Y)} = ${f(work.Y)}`,
    `Programmed Z = machine Z ${f(m.Z)} − ${s.activeWcs} Z ${f(w.Z)} − H${s.check.h} ${f(H)} = ${f(programmed.Z)}`,
    `Actual tip Z above datum = tip height ${f(pose.tipZ)} − datum height ${f(t.datumZ)} = ${f(tip.Z)}`,
    `Offset error X/Y/Z = ${f(r3(tip.X - programmed.X))} / ${f(r3(tip.Y - programmed.Y))} / ${f(r3(tip.Z - programmed.Z))}`,
  ];
  return { machine: { X: m.X, Y: m.Y, Z: m.Z }, work, programmed, tip, H, truth: t, breakdown };
}
