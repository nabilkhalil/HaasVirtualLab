import type { MachineProfile } from '../config/umc500';
import type { MachineState } from './machine';
import { collision, findTool, r3, toolPose } from './tools';
import { obstacles, piece, pieceTop, type OBox } from './workholding';

/**
 * Five-axis kinematics in the scene frame (mm, Z up, origin = platter top centre at B0 C0).
 * Hierarchy: C rotates about the platter normal through the C centre; B tilts about a Y-parallel line
 * through the B centre (S2: settings 255/257 locate B in X/Z, 256 locates C in Y). Positive sense UNVERIFIED.
 */
export type V3 = [number, number, number];
export interface Pivots { bx: number; bz: number; cx: number; cy: number }
const rad = (d: number) => (d * Math.PI) / 180;

export function rotate(p: V3, B: number, C: number, v: Pivots): V3 {
  const c = rad(C), b = rad(B);
  const x0 = p[0] - v.cx, y0 = p[1] - v.cy;
  const x1 = x0 * Math.cos(c) - y0 * Math.sin(c) + v.cx, y1 = x0 * Math.sin(c) + y0 * Math.cos(c) + v.cy;
  const dx = x1 - v.bx, dz = p[2] - v.bz;
  return [dx * Math.cos(b) + dz * Math.sin(b) + v.bx, y1, -dx * Math.sin(b) + dz * Math.cos(b) + v.bz];
}
export function unrotate(p: V3, B: number, C: number, v: Pivots): V3 {
  const b = rad(-B), c = rad(-C);
  const dx = p[0] - v.bx, dz = p[2] - v.bz;
  const x1 = dx * Math.cos(b) + dz * Math.sin(b) + v.bx, z1 = -dx * Math.sin(b) + dz * Math.cos(b) + v.bz;
  const x0 = x1 - v.cx, y0 = p[1] - v.cy;
  return [x0 * Math.cos(c) - y0 * Math.sin(c) + v.cx, x0 * Math.sin(c) + y0 * Math.cos(c) + v.cy, z1];
}

/** True pivots (simulator geometry) and the controller's pivots from simulated settings 255-257. */
export const truePivots = (p: MachineProfile): Pivots => ({ bx: 0, bz: -p.geometry.trunnionPivotBelowPlatter, cx: 0, cy: 0 });
export const ctrlPivots = (s: MachineState, p: MachineProfile): Pivots => {
  const t = truePivots(p), e = s.mrzpError;
  return { bx: t.bx + e.X, bz: t.bz + e.Z, cx: t.cx + e.X, cy: t.cy + e.Y };
};
/** MRZP expressed like Settings 255-257: machine X/Y/Z (gauge line) of the rotary centre, relative to home. */
export const trueMrzp = (p: MachineProfile) => ({ X: r3(p.geometry.xAtCentre), Y: r3(p.geometry.yAtCentre), Z: r3(truePivots(p).bz - p.geometry.gaugeLineAtZ0) });
export const ctrlMrzp = (s: MachineState, p: MachineProfile) => { const t = trueMrzp(p); return { X: r3(t.X + s.mrzpError.X), Y: r3(t.Y + s.mrzpError.Y), Z: r3(t.Z + s.mrzpError.Z) }; };

/** H reference plane (part top of A, Haas part-top convention). */
export const topRef = (s: MachineState) => pieceTop(s, piece(s, 'A'));

/** Programmed work point -> scene position at B0 C0 (G54 X/Y/Z, part-top tool lengths). */
export function workPoint0(s: MachineState, p: MachineProfile, w: V3): V3 {
  const o = s.work[s.activeWcs], g = p.geometry;
  return [w[0] + o.X - g.xAtCentre, w[1] + o.Y - g.yAtCentre, w[2] + o.Z + topRef(s)];
}

export type Comp = 'G43' | 'G254' | 'G234';
/** Where the controller sends the tool tip (scene) for programmed work point w under the active compensation. */
export function ctrlTarget(s: MachineState, p: MachineProfile, w: V3, comp: Comp = s.comp): V3 {
  const q = workPoint0(s, p, w);
  return comp === 'G43' ? q : rotate(q, s.machine.B, s.machine.C, ctrlPivots(s, p));
}
/** Machine X/Y/Z that put the tip (per stored H) at a scene tip position. */
export function machineFor(s: MachineState, p: MachineProfile, tip: V3, h = s.check.h): V3 {
  const row = s.offsets[h], H = row.hGeom + row.hWear, g = p.geometry;
  return [r3(tip[0] + g.xAtCentre), r3(tip[1] + g.yAtCentre), r3(tip[2] - topRef(s) + H)];
}
/** Where the programmed point physically is now (truth) and the resulting tip error. */
export function positionReport(s: MachineState, p: MachineProfile, w: V3) {
  const phys = rotate(workPoint0(s, p, w), s.machine.B, s.machine.C, truePivots(p));
  const pose = toolPose(s, p);
  const tip: V3 = [pose.gaugeLine[0], pose.gaugeLine[1], pose.tipZ];
  const err: V3 = [r3(tip[0] - phys[0]), r3(tip[1] - phys[1]), r3(tip[2] - phys[2])];
  return { phys: phys.map(r3) as V3, tip, err, mag: r3(Math.hypot(...err)), target: ctrlTarget(s, p, w).map(r3) as V3 };
}

/** Error of the controller target vs the true point for a given MRZP error (propagation, ignores tool). */
export function mrzpPropagation(s: MachineState, p: MachineProfile, w: V3) {
  const q = workPoint0(s, p, w);
  const t = rotate(q, s.machine.B, s.machine.C, truePivots(p)), c = rotate(q, s.machine.B, s.machine.C, ctrlPivots(s, p));
  return { err: [r3(c[0] - t[0]), r3(c[1] - t[1]), r3(c[2] - t[2])] as V3, mag: r3(Math.hypot(c[0] - t[0], c[1] - t[1], c[2] - t[2])) };
}

/** Required B/C to bring a platter-frame face normal to +Z (tool axis). Prefers the smallest |B| within limits. */
export function requiredBC(n: V3, p: MachineProfile): { B: number; C: number } | null {
  const len = Math.hypot(...n); const [nx, ny, nz] = n.map((v) => v / len);
  const lim = p.limits.B, cands: { B: number; C: number }[] = [];
  const b0 = (Math.acos(Math.max(-1, Math.min(1, nz))) * 180) / Math.PI;
  for (const B of [b0, -b0]) {
    if (B < lim.min - 1e-9 || B > lim.max + 1e-9) continue;
    const h = Math.hypot(nx, ny);
    // R_C n must equal (-sin B, 0, cos B)
    const tx = -Math.sin(rad(B));
    const C = h < 1e-9 ? 0 : ((((Math.atan2(0, tx) - Math.atan2(ny, nx)) * 180) / Math.PI) % 360 + 360) % 360;
    if (h > 1e-9 && Math.abs(Math.abs(tx) - h) > 1e-6) continue;
    cands.push({ B: r3(B), C: r3(C) });
  }
  const cdist = (c: number) => Math.min(c, 360 - c);
  cands.sort((a, b) => Math.abs(a.B) - Math.abs(b.B) || cdist(a.C) - cdist(b.C));
  return cands[0] ?? null;
}

/** Spindle head envelope (scene, relative to gauge line) used for rotation sweeps. Illustrative. */
const HEAD = { x: 110, y: 130, z0: 0, z1: 350 };
function hitsHead(s: MachineState, p: MachineProfile, obs: OBox[], B: number, C: number): string | null {
  const g = toolPose(s, p).gaugeLine, piv = truePivots(p);
  for (const o of obs) for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) {
    const a = (o.yaw * Math.PI) / 180, lx = (i * o.size[0]) / 2, ly = (j * o.size[1]) / 2;
    const c: V3 = [o.center[0] + lx * Math.cos(a) - ly * Math.sin(a), o.center[1] + lx * Math.sin(a) + ly * Math.cos(a), o.center[2] + (k * o.size[2]) / 2];
    const w = rotate(c, B, C, piv);
    if (Math.abs(w[0] - g[0]) < HEAD.x && Math.abs(w[1] - g[1]) < HEAD.y && w[2] - g[2] > HEAD.z0 && w[2] - g[2] < HEAD.z1) return `the ${o.name} would hit the spindle head`;
  }
  return null;
}

/** Swept check from the current state to a target (linear path in machine axes, rotary in ≤1° steps). */
export function sweep(s: MachineState, p: MachineProfile, to: Partial<Record<'X' | 'Y' | 'Z' | 'B' | 'C', number>>): string | null {
  const from = s.machine;
  const d = { X: (to.X ?? from.X) - from.X, Y: (to.Y ?? from.Y) - from.Y, Z: (to.Z ?? from.Z) - from.Z, B: (to.B ?? from.B) - from.B, C: (to.C ?? from.C) - from.C };
  const n = Math.max(1, Math.ceil(Math.max(Math.hypot(d.X, d.Y, d.Z) / 2, Math.abs(d.B), Math.abs(d.C))));
  const obs = obstacles(s);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const m = { X: from.X + d.X * t, Y: from.Y + d.Y * t, Z: from.Z + d.Z * t, B: from.B + d.B * t, C: from.C + d.C * t };
    const st = { ...s, machine: m };
    const hit = collision(st, p) ?? (d.B || d.C ? hitsHead(st, p, obs, m.B, m.C) : null);
    if (hit) return `${hit} at X${r3(m.X)} Y${r3(m.Y)} Z${r3(m.Z)} B${r3(m.B)} C${r3(m.C)}`;
  }
  return null;
}

/** MRZP estimate from simulated sphere centre measurements (machine coords, gauge-line frame). */
export interface SphereHit { B: number; C: number; X: number; Y: number; Z: number }
export function estimateMrzp(hits: SphereHit[]) {
  const at = (B: number, C: number) => hits.find((h) => Math.abs(h.B - B) < 0.01 && Math.abs(h.C - C) < 0.01);
  const b0 = hits.filter((h) => Math.abs(h.B) < 0.01);
  const c0 = b0.find((h) => Math.abs(h.C) < 0.01), c180 = b0.find((h) => Math.abs(h.C - 180) < 0.01);
  const bt = hits.find((h) => Math.abs(h.B) > 1 && Math.abs(h.C) < 0.01);
  if (!c0 || !c180 || !bt) return null;
  // C centre: midpoint of C0/C180. B centre: rotation of (x,z) by B about (bx,bz): solve (I - R) c = P1 - R P0.
  const b = rad(bt.B), cs = Math.cos(b), sn = Math.sin(b);
  // R maps (dx,dz) -> (dx cos + dz sin, -dx sin + dz cos)
  const r00 = cs, r01 = sn, r10 = -sn, r11 = cs;
  const rx = bt.X - (r00 * c0.X + r01 * c0.Z), rz = bt.Z - (r10 * c0.X + r11 * c0.Z);
  const a00 = 1 - r00, a01 = -r01, a10 = -r10, a11 = 1 - r11, det = a00 * a11 - a01 * a10;
  void at;
  return { X: r3((rx * a11 - a01 * rz) / det), Y: r3((c0.Y + c180.Y) / 2), Z: r3((a00 * rz - a10 * rx) / det), Cx: r3((c0.X + c180.X) / 2) };
}

/** Simulated sphere: platter-frame centre and radius (calibration artefact, not WIPS). */
export const SPHERE = { at: [-150, 80, 100] as V3, r: 12.7, stem: 5 };
export function sphereWorld(s: MachineState, p: MachineProfile): V3 { return rotate(SPHERE.at, s.machine.B, s.machine.C, truePivots(p)); }
/** Probe tip centre must be within 15 mm of the sphere surface to start the simulated cycle. */
export function probeSphere(s: MachineState, p: MachineProfile): SphereHit | string {
  const t = findTool(s, s.activeTool);
  if (t?.type !== 'Probe') return 'Load the spindle probe (T5)';
  if (!s.setup.sphere) return 'Mount the calibration sphere (5-AXIS panel)';
  const c = sphereWorld(s, p), pose = toolPose(s, p);
  const tipC: V3 = [pose.gaugeLine[0], pose.gaugeLine[1], pose.tipZ + t.diameter / 2];
  const dist = Math.hypot(tipC[0] - c[0], tipC[1] - c[1], tipC[2] - c[2]) - SPHERE.r - t.diameter / 2;
  if (dist > 15) return `Probe is ${r3(dist)} mm from the sphere; jog within 15 mm`;
  const g = p.geometry;
  return { B: s.machine.B, C: s.machine.C, X: r3(c[0] + g.xAtCentre), Y: r3(c[1] + g.yAtCentre), Z: r3(c[2] - g.gaugeLineAtZ0) };
}

/** TCPC demo: tip path in the PART frame for a linear programmed move with simultaneous B/C motion. */
export function tcpcPaths(s: MachineState, p: MachineProfile, d: { from: V3; to: V3; B: [number, number]; C: [number, number] }, n = 30) {
  const piv = truePivots(p), ctrl = ctrlPivots(s, p);
  const prog: V3[] = [], on: V3[] = [], off: V3[] = [];
  const m0 = workPoint0(s, p, d.from), m1 = workPoint0(s, p, d.to);
  for (let i = 0; i <= n; i++) {
    const t = i / n, B = d.B[0] + (d.B[1] - d.B[0]) * t, C = d.C[0] + (d.C[1] - d.C[0]) * t;
    const q: V3 = [m0[0] + (m1[0] - m0[0]) * t, m0[1] + (m1[1] - m0[1]) * t, m0[2] + (m1[2] - m0[2]) * t];
    prog.push(q);
    // TCPC on: controller keeps the tip fixed to the rotating table frame (using its MRZP).
    on.push(unrotate(rotate(q, B, C, ctrl), B, C, piv));
    // TCPC off: linear axes interpolate the programmed values; the table rotates underneath.
    off.push(unrotate(q, B, C, piv));
  }
  const dev = (a: V3[]) => r3(Math.max(...a.map((v, i) => Math.hypot(v[0] - prog[i][0], v[1] - prog[i][1], v[2] - prog[i][2]))));
  return { prog, on, off, devOn: dev(on), devOff: dev(off) };
}
