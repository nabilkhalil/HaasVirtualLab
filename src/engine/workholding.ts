import { CLAMP, EDGE_TIP_LENGTH, VICE, type DatumSel, type PieceId, type Wcs, type Workpiece } from '../config/workholding';
import type { MachineProfile } from '../config/umc500';
import type { MachineState } from './machine';
import { platterToWorld, r3, toolPose, worldToPlatter } from './tools';

/** Oriented box in the platter frame: centre, size, yaw (deg) about its own centre. */
export interface OBox { name: string; center: [number, number, number]; size: [number, number, number]; yaw: number; piece?: PieceId }

export const piece = (s: MachineState, id: PieceId) => s.setup.pieces.find((p) => p.id === id)!;
export const pieceBottom = (s: MachineState, w: Workpiece) => (w.mount === 'vice' ? VICE.base[2] + (s.setup.parallels ? VICE.parallelHeight : 0) : 0);
export const pieceTop = (s: MachineState, w: Workpiece) => pieceBottom(s, w) + w.size[2];

const rotZ = (x: number, y: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** All fixtures and workpieces as oriented boxes (platter frame). */
export function obstacles(s: MachineState): OBox[] {
  const out: OBox[] = [];
  const [bx, by, bz] = VICE.base;
  out.push({ name: 'vice', center: [0, 0, bz / 2], size: [bx, by, bz], yaw: 0 });
  const a = s.setup.pieces.find((p) => p.mount === 'vice' && p.present);
  const halfW = (a?.size[1] ?? 80) / 2;
  const open = a?.clamped ? 0 : VICE.openGap;
  const jz = bz + VICE.jawHeight / 2;
  out.push({ name: 'vice jaw', center: [0, halfW + VICE.jawThick / 2, jz], size: [bx, VICE.jawThick, VICE.jawHeight], yaw: 0 });
  out.push({ name: 'vice jaw', center: [0, -halfW - VICE.jawThick / 2 - open, jz], size: [bx, VICE.jawThick, VICE.jawHeight], yaw: 0 });
  if (s.setup.parallels) for (const sg of [-1, 1])
    out.push({ name: 'parallel', center: [0, sg * (halfW - VICE.parallelThick / 2 - 4), bz + VICE.parallelHeight / 2], size: [180, VICE.parallelThick, VICE.parallelHeight], yaw: 0 });
  if (s.setup.sphere) {
    out.push({ name: 'calibration sphere', center: [-150, 80, 100], size: [25.4, 25.4, 25.4], yaw: 0 });
    out.push({ name: 'sphere stem', center: [-150, 80, 43.65], size: [10, 10, 87.3], yaw: 0 });
  }
  for (const w of s.setup.pieces) {
    if (!w.present) continue;
    const b = pieceBottom(s, w);
    out.push({ name: `workpiece ${w.id}`, piece: w.id, center: [w.pos[0], w.pos[1], b + w.size[2] / 2], size: w.size, yaw: w.yaw });
    if (w.mount === 'platter') for (const sg of [-1, 1]) {
      const [cx, cy] = rotZ(0, sg * (w.size[1] / 2 + CLAMP.size[1] / 2 - CLAMP.overlap), w.yaw);
      out.push({ name: `clamp ${w.id}`, center: [w.pos[0] + cx, w.pos[1] + cy, b + w.size[2] + CLAMP.size[2] / 2], size: CLAMP.size, yaw: w.yaw });
    }
  }
  return out;
}

/** Point in the box's local XY frame. */
const local = (b: OBox, x: number, y: number) => rotZ(x - b.center[0], y - b.center[1], -b.yaw);
/** Horizontal distance from (x,y) to the box footprint (negative = inside, depth to nearest side). */
export function footprintDistance(b: OBox, x: number, y: number) {
  const [lx, ly] = local(b, x, y);
  const dx = Math.abs(lx) - b.size[0] / 2, dy = Math.abs(ly) - b.size[1] / 2;
  return dx <= 0 && dy <= 0 ? Math.max(dx, dy) : Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}
const zRange = (b: OBox): [number, number] => [b.center[2] - b.size[2] / 2, b.center[2] + b.size[2] / 2];

/** Effective collision radius of the physical tool at height h above its tip. */
export function radiusAt(type: string | undefined, dia: number, h: number) {
  if (type === 'Edge Finder') return h < EDGE_TIP_LENGTH ? Math.max(dia / 2 - 1, 0.01) : 5; // 1 mm tip compliance
  if (type === 'Pointer') return h < 20 ? Math.max(0.01, (h / 20) * 4) : 4;
  return Math.max(dia / 2, 0.01);
}

/** Static tool vs fixture/workpiece/platter check (tip to gauge line). Approximate when tilted (Phase 5). */
export function toolInterference(s: MachineState, prof: MachineProfile): { msg: string; obstacle?: OBox } | null {
  const t = toolPose(s, prof);
  if (!t.tool) return null;
  const obs = obstacles(s);
  const hs: number[] = [];
  for (let h = 0; h < t.length; h += 2.5) hs.push(h);
  hs.push(t.length);
  for (const h of hs) {
    const q = worldToPlatter([t.gaugeLine[0], t.gaugeLine[1], t.tipZ + h], s, prof);
    const r = radiusAt(t.tool.type, t.tool.diameter, h);
    for (const b of obs) {
      const [z0, z1] = zRange(b);
      if (q[2] < z1 - 1e-9 && q[2] > z0 && footprintDistance(b, q[0], q[1]) < r - 1e-9) {
        const w = b.piece ? piece(s, b.piece) : null;
        if (w && !w.clamped) return { msg: `Workpiece ${w.id} is not clamped — it would move. Clamp it first`, obstacle: b };
        return { msg: `Tool would hit the ${b.name}`, obstacle: b };
      }
    }
    if (Math.hypot(q[0], q[1]) < prof.geometry.platterDiameter / 2 + r && q[2] < -1e-9 && q[2] > -50) return { msg: 'Tool would hit the platter' };
  }
  return null;
}

/** Physical datum point of a workpiece (platter frame). Custom is measured from the top front-left corner. */
export function datumLocal(s: MachineState, w: Workpiece, sel: DatumSel): [number, number, number] {
  const [L, W, H] = w.size, c = sel.custom;
  const d = { TFL: [-L / 2, -W / 2, H], TFR: [L / 2, -W / 2, H], TC: [0, 0, H], BC: [0, 0, 0],
    CUSTOM: [-L / 2 + c[0], -W / 2 + c[1], H + c[2]] }[sel.type];
  const [x, y] = rotZ(d[0], d[1], w.yaw);
  return [w.pos[0] + x, w.pos[1] + y, pieceBottom(s, w) + d[2]];
}

/** TRUE work offset for a WCS (B = C = 0 exercises): X/Y machine position of the datum, and datum height (scene). */
export function trueWork(s: MachineState, prof: MachineProfile, wcs: Wcs) {
  const w = piece(s, s.setup.wcsPiece[wcs]);
  const p = platterToWorld(datumLocal(s, w, s.setup.wcsDatum[wcs]), s, prof);
  return { piece: w, X: r3(p[0] + prof.geometry.xAtCentre), Y: r3(p[1] + prof.geometry.yAtCentre), datumZ: r3(p[2]) };
}

/** Surface directly under the tool axis (highest workpiece top below the tip), B = 0 only. */
export function surfaceUnderTool(s: MachineState, prof: MachineProfile): { piece: Workpiece; gap: number } | null {
  const t = toolPose(s, prof);
  if (!t.tool || s.machine.B !== 0) return null;
  let best: { piece: Workpiece; gap: number } | null = null;
  for (const w of s.setup.pieces) {
    if (!w.present) continue;
    const top = pieceTop(s, w);
    const q = worldToPlatter([t.gaugeLine[0], t.gaugeLine[1], top], s, prof);
    const b = obstacles(s).find((o) => o.piece === w.id)!;
    if (footprintDistance(b, q[0], q[1]) > 0) continue;
    const gap = r3(t.tipZ - platterToWorld([q[0], q[1], top], s, prof)[2]);
    if (gap >= -1e-9 && (!best || gap < best.gap)) best = { piece: w, gap };
  }
  return best;
}

export type BlockState = 'NOT OVER PART' | 'BLOCK PASSES' | 'BLOCK DRAGS' | "BLOCK WON'T FIT";
export function blockState(gap: number | null, t: number): BlockState {
  if (gap === null) return 'NOT OVER PART';
  if (gap > t + 0.01) return 'BLOCK PASSES';
  if (gap >= t - 0.0005) return 'BLOCK DRAGS';
  return "BLOCK WON'T FIT";
}

export type EdgeState = 'NOT AN EDGE FINDER' | 'NO EDGE NEARBY' | 'RUNNING TRUE' | 'KICKED' | 'OVER-TRAVELLED';
/** Mechanical edge finder: tip kicks when the tip surface reaches a workpiece side face (simulator thresholds). */
export function edgeFinder(s: MachineState, prof: MachineProfile) {
  const t = toolPose(s, prof);
  if (t.tool?.type !== 'Edge Finder') return { state: 'NOT AN EDGE FINDER' as EdgeState };
  const r = t.tool.diameter / 2;
  let best: { d: number; b: OBox } | null = null;
  for (const b of obstacles(s).filter((o) => o.piece)) {
    const [z0, z1] = zRange(b);
    if (t.tipZ >= z1 || t.tipZ + EDGE_TIP_LENGTH <= z0) continue;
    const q = worldToPlatter([t.gaugeLine[0], t.gaugeLine[1], t.tipZ], s, prof);
    const d = footprintDistance(b, q[0], q[1]);
    if (!best || d < best.d) best = { d, b };
  }
  if (!best || best.d > r + 20) return { state: 'NO EDGE NEARBY' as EdgeState, r };
  const gap = r3(best.d - r);
  const state: EdgeState = gap > 0.005 ? 'RUNNING TRUE' : gap >= -0.005 ? 'KICKED' : 'OVER-TRAVELLED';
  return { state, r, gap, piece: best.b.piece };
}

/** Setup validation: interference, clamping, alignment, jaw height (simulator rules). */
export function setupIssues(s: MachineState): string[] {
  const out: string[] = [];
  for (const w of s.setup.pieces.filter((p) => p.present)) {
    if (!w.clamped) out.push(`Workpiece ${w.id} is unclamped`);
    if (Math.abs(w.yaw) > 0.01) out.push(`Workpiece ${w.id} is misaligned by ${w.yaw.toFixed(2)}°`);
    if (w.mount === 'vice' && pieceTop(s, w) < VICE.base[2] + VICE.jawHeight + 3) out.push(`Workpiece ${w.id} sits less than 3 mm above the jaws (use parallels)`);
  }
  return out;
}

/** Fixture interference for a candidate setup (pieces vs vice/other pieces vs platter edge). */
export function setupInterference(s: MachineState, prof: MachineProfile): string | null {
  const obs = obstacles(s);
  for (const w of s.setup.pieces.filter((p) => p.present)) {
    const b = obs.find((o) => o.piece === w.id)!;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => rotZ((i * w.size[0]) / 2, (j * w.size[1]) / 2, w.yaw)).map(([x, y]) => [x + w.pos[0], y + w.pos[1]]);
    if (corners.some(([x, y]) => Math.hypot(x, y) > prof.geometry.platterDiameter / 2)) return `Workpiece ${w.id} overhangs the platter`;
    for (const o of obs) {
      if (o === b || o.name.startsWith('clamp ' + w.id) || (w.mount === 'vice' && !o.piece && !o.name.startsWith('clamp'))) continue;
      const [z0, z1] = zRange(o), [bz0, bz1] = zRange(b);
      if (z1 <= bz0 || z0 >= bz1) continue;
      const hit = corners.some(([x, y]) => footprintDistance(o, x, y) < 0) || footprintDistance(b, o.center[0], o.center[1]) < 0;
      if (hit) return `Workpiece ${w.id} interferes with the ${o.name}`;
    }
  }
  return null;
}
