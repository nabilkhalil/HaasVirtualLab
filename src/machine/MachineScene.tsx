import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, Html, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { FatLine as Line } from './FatLine';
import type { MachineState } from '../engine/machine';
import { UMC500 } from '../config/umc500';
import type { PieceId } from '../config/workholding';
import { coords } from '../engine/coords';
import { datumLocal, edgeFinder, obstacles, piece, surfaceUnderTool, type OBox } from '../engine/workholding';
import { platterToWorld } from '../engine/tools';
import { ctrlPivots, positionReport, SPHERE, tcpcPaths, truePivots, workPoint0, type Pivots, type V3 } from '../engine/fiveaxis';
import { FACES } from '../engine/machine';
import { useFive } from '../store/fiveStore';
import { sceneTransforms, type SceneTransforms } from '../engine/sceneTransforms';
import { useHideTruth } from '../store/lessonStore';
import { useMachine } from '../store/machineStore';

const HALF_PI = Math.PI / 2;
/**
 * drei's <Html> appends its container to an element it does not own. Appending into R3F's canvas wrapper makes
 * React throw "removeChild" when the simulator unmounts (route change), so every label is portalled into this
 * React-owned overlay div instead.
 */
const LabelsPortal = createContext<RefObject<HTMLElement> | null>(null);
const useLabelsPortal = () => useContext(LabelsPortal);
/** State slices the 3D scene depends on; typing on the input line, messages and stats do not re-render the scene. */
const SCENE_KEYS: (keyof MachineState)[] = ['machine', 'activeTool', 'tools', 'setup', 'offsets', 'work', 'activeWcs', 'check', 'comp', 'mrzpError', 'lastPoint', 'selectedAxis'];
function useSceneState(): MachineState {
  useMachine(useShallow((m) => SCENE_KEYS.map((k) => m.state[k])));
  return useMachine.getState().state;
}
type View = 'iso' | 'front' | 'top' | 'side';
// Positions in three.js (Y-up) units, 1 unit = 100 mm.
const VIEWS: Record<View, [number, number, number]> = { iso: [9, 7, 9], front: [0, 3, 14], top: [0, 16, 0.01], side: [14, 3, 0] };
const f3 = (v: number) => v.toFixed(3);

function CameraRig({ view, ortho }: { view: View; ortho: boolean }) {
  const { camera, controls, invalidate } = useThree() as any;
  useEffect(() => {
    camera.position.set(...VIEWS[view]);
    camera.lookAt(0, 2, 0);
    controls?.target.set(0, 2, 0);
    controls?.update();
    invalidate();
  }, [view, ortho, camera, controls, invalidate]);
  return null;
}

const COLORS: Record<string, string> = { vice: '#2f5f9e', 'vice jaw': '#3b6fb6', parallel: '#9e9e9e' };
/** Fixtures and workpieces from state (platter frame). Clicking a workpiece selects it. */
function Workholding({ sel, onSel }: { sel: PieceId | null; onSel: (id: PieceId | null) => void }) {
  const s = useSceneState();
  return <>{obstacles(s).filter((b) => !/sphere/.test(b.name)).map((b: OBox, i) => (
    <mesh key={i} position={b.center} rotation={[0, 0, (b.yaw * Math.PI) / 180]}
      onClick={b.piece ? (e) => { e.stopPropagation(); onSel(sel === b.piece ? null : b.piece!); } : undefined}>
      <boxGeometry args={b.size} />
      <meshStandardMaterial color={b.piece ? (sel === b.piece ? '#ffcc80' : piece(s, b.piece).clamped ? '#d9a441' : '#e57373') : COLORS[b.name] ?? '#795548'} />
    </mesh>
  ))}</>;
}

/** In-scene toolbar for the selected workpiece. */
function PieceToolbar({ id }: { id: PieceId }) {
  const s = useSceneState();
  const dispatch = useMachine((m) => m.dispatch);
  const w = piece(s, id);
  const b = obstacles(s).find((o) => o.piece === id)!;
  const up = (patch: object) => dispatch({ type: 'UPDATE_PIECE', id, patch });
  const portal = useLabelsPortal();
  return (
    <Html portal={portal ?? undefined} position={[b.center[0], b.center[1], b.center[2] + b.size[2] / 2 + 30]} center zIndexRange={[20, 10]}>
      <div className="ptool" data-testid={`ptool-${id}`}>
        <b>{id}</b>
        <button onClick={() => up({ pos: [w.pos[0] - 5, w.pos[1]] })}>−X</button><button onClick={() => up({ pos: [w.pos[0] + 5, w.pos[1]] })}>+X</button>
        <button onClick={() => up({ pos: [w.pos[0], w.pos[1] - 5] })}>−Y</button><button onClick={() => up({ pos: [w.pos[0], w.pos[1] + 5] })}>+Y</button>
        <button onClick={() => up({ yaw: Math.round((w.yaw + 0.25) * 100) / 100 })}>⟲</button>
        <button data-testid={`ptool-align-${id}`} onClick={() => up({ yaw: 0 })}>Align</button>
        <button data-testid={`ptool-clamp-${id}`} className={w.clamped ? 'on' : ''} onClick={() => up({ clamped: !w.clamped })}>{w.clamped ? 'Unclamp' : 'Clamp'}</button>
      </div>
    </Html>
  );
}

function Triad({ at, label, cls, size = 40 }: { at: [number, number, number]; label: string; cls: string; size?: number }) {
  return <group position={at}><axesHelper args={[size]} /><Label at={[0, 0, 4]} cls={cls}>{label}</Label></group>;
}
const Label = ({ at, children, cls = '' }: { at: [number, number, number]; children: ReactNode; cls?: string }) => {
  const portal = useLabelsPortal();
  return <Html portal={portal ?? undefined} position={at} className={'lbl ' + cls} zIndexRange={[5, 0]}>{children}</Html>;
};
const Ring = ({ at, r, color }: { at: [number, number, number]; r: number; color: string }) => (
  <mesh position={at}><torusGeometry args={[r, 1.2, 8, 48]} /><meshBasicMaterial color={color} /></mesh>
);

/** Physical tool body by type (gauge line at local z = 0, tip at z = -L). */
function ToolBody({ t }: { t: SceneTransforms }) {
  const L = t.toolLength, r = t.toolDiameter / 2;
  if (!L) return null;
  const cyl = (rad: number, h: number, z: number, color = '#e8e8e8') => (
    <mesh rotation={[HALF_PI, 0, 0]} position={[0, 0, z]}><cylinderGeometry args={[rad, rad, h, 24]} /><meshStandardMaterial color={color} metalness={0.5} /></mesh>
  );
  const holder = Math.min(45, L - 10);
  const body = L - holder;
  switch (t.toolType) {
    case 'Shell Mill': return <>{cyl(16, body - 20, -holder - (body - 20) / 2, '#888')}{cyl(r, 20, -L + 10)}</>;
    case 'Ball Nose': return <>{cyl(r, body - r, -holder - (body - r) / 2)}<mesh position={[0, 0, -L + r]}><sphereGeometry args={[r, 20, 12]} /><meshStandardMaterial color="#e8e8e8" /></mesh></>;
    case 'Drill': return <>{cyl(r, body - r, -holder - (body - r) / 2)}<mesh rotation={[-HALF_PI, 0, 0]} position={[0, 0, -L + r / 2]}><coneGeometry args={[r, r, 20]} /><meshStandardMaterial color="#e8e8e8" /></mesh></>;
    case 'Probe': return <>{cyl(10, body - 30, -holder - (body - 30) / 2, '#555')}{cyl(1.5, 30 - r, -L + r + (30 - r) / 2)}<mesh position={[0, 0, -L + r]}><sphereGeometry args={[r, 20, 12]} /><meshStandardMaterial color="#d32f2f" /></mesh></>;
    default: return cyl(r, body, -holder - body / 2);
  }
}

/** Learning overlays: gauge line, physical length, tip, reference plane, H offset and G43 rings. */
function Overlays({ t, exaggerate, hide }: { t: SceneTransforms; exaggerate: number; hide: boolean }) {
  const [x, y, zg] = t.gaugeLine;
  const dx = Math.max(t.toolDiameter / 2, 10);
  const c = t.check;
  const hOk = Math.abs(c.lengthError) < 0.01;
  const hx = -dx - 40; // H bar sits left of the tool
  const actualZ = t.programmedTipZ + (t.actualTipZ - t.programmedTipZ) * exaggerate;
  return (
    <group>
      {/* Spindle gauge line */}
      <mesh position={[x, y, zg]}><cylinderGeometry args={[70, 70, 0.5, 48]} /><meshBasicMaterial color="#ffd54f" transparent opacity={0.35} /></mesh>
      <Label at={[x + 75, y, zg]}>Gauge line · Z {f3(zg - UMC500.geometry.gaugeLineAtZ0)}</Label>
      {/* Physical tool length (truth) */}
      {t.toolLength > 0 && <>
        <Line points={[[x + dx + 15, y, zg], [x + dx + 15, y, t.toolTip[2]]]} color="#ffd54f" lineWidth={2} />
        {!hide && <Label at={[x + dx + 18, y, zg - t.toolLength / 2]}>L {f3(t.toolLength)} (actual)</Label>}
        <mesh position={t.toolTip}><sphereGeometry args={[2.5, 12, 8]} /><meshBasicMaterial color="#00e5ff" /></mesh>
        <Label at={[x + dx + 18, y, t.toolTip[2]]} cls="tip">Tip {f3(t.toolTip[2] - t.refZ)} above part top</Label>
      </>}
      {/* Reference plane: part top */}
      <mesh position={[0, 0, t.refZ + 0.2]}><boxGeometry args={[240, 180, 0.3]} /><meshBasicMaterial color="#00e676" transparent opacity={0.18} /></mesh>
      <Label at={[-120, -90, t.refZ]} cls="ref">Part top A = H reference</Label>
      {/* H: machine Z travel from the tip-at-home position to the part top (stored vs ideal) */}
      {t.toolLength > 0 && <>
        <Line points={[[x + hx, y, t.tipAtHome], [x + hx, y, t.storedHEnd]]} color={hide ? '#90caf9' : hOk ? '#00e676' : '#ff1744'} lineWidth={4} />
        <Line points={[[x + hx - 8, y, t.tipAtHome], [x + hx + 8, y, t.tipAtHome]]} color="#90caf9" lineWidth={2} />
        <Label at={[x + hx - 8, y, (t.tipAtHome + t.storedHEnd) / 2]} cls="left">H {f3(c.storedH)} (stored, from tip at Z0)</Label>
        {!hide && !hOk && <Line points={[[x + hx + 6, y, t.tipAtHome], [x + hx + 6, y, t.idealHEnd]]} color="#00e676" lineWidth={1} dashed dashSize={6} gapSize={4} />}
      </>}
      {/* G43 check: programmed (blue) vs actual (green/red) tip */}
      {t.toolLength > 0 && <>
        <Ring at={[x, y, t.programmedTipZ]} r={dx + 6} color="#2979ff" />
        <Label at={[x - dx - 10, y, t.programmedTipZ]} cls="left prog">Programmed Z{f3(c.programmedTip)} (G43)</Label>
        {!hide && <Ring at={[x, y, actualZ]} r={dx + 3} color={c.collision ? '#ff1744' : hOk ? '#00e676' : '#ffab00'} />}
        {!hide && c.collision && <Label at={[x + dx + 18, y, actualZ]} cls="crash">COLLISION {f3(c.actualTip)}</Label>}
      </>}
    </group>
  );
}

/** Built in machine frame (Z-up, mm); parent group converts to three.js Y-up (1 unit = 100 mm). */
type Sys = 'machine' | 'datum' | 'work' | 'tip';
/** A frame defined at B0 C0 (scene point `at`), carried through C then B about the given pivots. */
function RotFrame({ v, B, C, at, children }: { v: Pivots; B: number; C: number; at: V3; children: ReactNode }) {
  const r = (d: number) => (d * Math.PI) / 180;
  return <group position={[v.bx, 0, v.bz]} rotation={[0, r(B), 0]}><group position={[v.cx - v.bx, v.cy, -v.bz]} rotation={[0, 0, r(C)]}>
    <group position={[at[0] - v.cx, at[1] - v.cy, at[2]]}>{children}</group></group></group>;
}
/** Phase 5 overlays: rotary centres (true + controller, error ×20), sphere, TCPC paths, face, target markers. */
function FiveOverlays({ hide }: { hide: boolean }) {
  const s = useSceneState();
  const five = useFive();
  const tp = truePivots(UMC500), cp = ctrlPivots(s, UMC500);
  const ex: Pivots = { bx: tp.bx + (cp.bx - tp.bx) * 20, bz: tp.bz + (cp.bz - tp.bz) * 20, cx: tp.cx + (cp.cx - tp.cx) * 20, cy: tp.cy + (cp.cy - tp.cy) * 20 };
  const { B, C } = s.machine;
  const rep = positionReport(s, UMC500, s.lastPoint ?? five.point);
  const paths = five.showPaths ? tcpcPaths(s, UMC500, five.demo) : null;
  const A = piece(s, 'A'), n = FACES[five.face];
  const fc: V3 = [A.pos[0] + n[0] * A.size[0] / 2, A.pos[1] + n[1] * A.size[1] / 2, 60 + A.size[2] / 2 + n[2] * A.size[2] / 2];
  const err = cp.bx !== tp.bx || cp.bz !== tp.bz || cp.cy !== tp.cy;
  return <>
    {five.showPivots && <>
      <Line points={[[tp.bx, -320, tp.bz], [tp.bx, 320, tp.bz]]} color="#ff9800" lineWidth={3} />
      <Label at={[tp.bx, 300, tp.bz]} cls="mach">B axis (true centre)</Label>
      <RotFrame v={tp} B={B} C={0} at={[tp.cx, tp.cy, 0]}><Line points={[[0, 0, -60], [0, 0, 260]]} color="#ce93d8" lineWidth={3} /><Label at={[0, 0, 260]} cls="prog">C axis</Label></RotFrame>
      {err && <><Line points={[[ex.bx, -320, ex.bz], [ex.bx, 320, ex.bz]]} color="#ff1744" lineWidth={2} dashed dashSize={10} gapSize={6} />
        <Label at={[ex.bx, -300, ex.bz]} cls="crash">Controller MRZP (error ×20)</Label></>}
    </>}
    {s.setup.sphere && <RotFrame v={tp} B={B} C={C} at={SPHERE.at}>
      <mesh><sphereGeometry args={[SPHERE.r, 24, 16]} /><meshStandardMaterial color="#eceff1" metalness={0.8} roughness={0.2} /></mesh>
      <mesh rotation={[HALF_PI, 0, 0]} position={[0, 0, -SPHERE.at[2] / 2]}><cylinderGeometry args={[SPHERE.stem, SPHERE.stem, SPHERE.at[2], 12]} /><meshStandardMaterial color="#607d8b" /></mesh>
    </RotFrame>}
    {paths && <RotFrame v={tp} B={B} C={C} at={[0, 0, 0]}>
      <Line points={paths.prog} color="#2979ff" lineWidth={3} />
      <Line points={paths.on} color="#00e676" lineWidth={2} dashed dashSize={4} gapSize={3} />
      <Line points={paths.off} color="#ff1744" lineWidth={2} />
      <Label at={paths.off[paths.off.length >> 1]} cls="crash">TCPC off</Label>
      <Label at={paths.prog[paths.prog.length - 1]} cls="prog">programmed / TCPC on</Label>
    </RotFrame>}
    <RotFrame v={tp} B={B} C={C} at={fc}>
      <Line points={[[0, 0, 0], n.map((v) => v * 60) as V3]} color="#ffeb3b" lineWidth={3} /><Label at={n.map((v) => v * 62) as V3} cls="mach">{five.face} face normal</Label>
    </RotFrame>
    {s.lastPoint && <>
      <mesh position={rep.target}><sphereGeometry args={[3, 12, 8]} /><meshBasicMaterial color="#2979ff" /></mesh>
      <Label at={[rep.target[0], rep.target[1], rep.target[2] + 8]} cls="prog">programmed TCP</Label>
      {!hide && <><mesh position={rep.phys}><sphereGeometry args={[2.5, 12, 8]} /><meshBasicMaterial color="#00e676" /></mesh>
        <Label at={[rep.phys[0], rep.phys[1], rep.phys[2] - 8]} cls="ref">part point (|e| {rep.mag.toFixed(3)})</Label></>}
    </>}
  </>;
}
/** Coordinate system triads (scene frame). Physical datum and actual tip hidden in assessments. */
function CoordSystems({ show, hide }: { show: Record<Sys, boolean>; hide: boolean }) {
  const s = useSceneState();
  const g = UMC500.geometry;
  const c = coords(s, UMC500);
  const t = sceneTransforms(s, UMC500);
  const w = s.work[s.activeWcs];
  const datum0 = datumLocal(s, piece(s, s.setup.wcsPiece[s.activeWcs]), s.setup.wcsDatum[s.activeWcs]);
  void platterToWorld;
  // Stored work origin: X/Y from the offset; Z where the real tip would be at programmed Z0 (work Z + H).
  const storedZ = w.Z + c.H + g.gaugeLineAtZ0 - t.toolLength;
  const ef = edgeFinder(s, UMC500);
  const blk = s.setup.touch === 'block' ? surfaceUnderTool(s, UMC500) : null;
  return <>
    {show.machine && <Triad at={[-g.xAtCentre, -g.yAtCentre, g.gaugeLineAtZ0]} label="Machine zero (X0 Y0 Z0)" cls="mach" size={60} />}
    {show.datum && !hide && <RotFrame v={truePivots(UMC500)} B={s.machine.B} C={s.machine.C} at={datum0}><Triad at={[0, 0, 0]} label={`Physical datum ${s.setup.wcsPiece[s.activeWcs]} (${s.setup.wcsDatum[s.activeWcs].type})`} cls="ref" /></RotFrame>}
    {show.work && (s.comp === 'G43'
      ? <Triad at={[w.X - g.xAtCentre, w.Y - g.yAtCentre, storedZ]} label={`${s.activeWcs} stored origin (no rotation)`} cls="prog" />
      : <RotFrame v={ctrlPivots(s, UMC500)} B={s.machine.B} C={s.machine.C} at={workPoint0(s, UMC500, [0, 0, 0])}><Triad at={[0, 0, 0]} label={`${s.activeWcs} via ${s.comp} (controller MRZP)`} cls="prog" /></RotFrame>)}
    {show.tip && <Label at={[t.toolTip[0] - 20, t.toolTip[1], t.toolTip[2] - 12]} cls="left tip">
      Prog X{c.programmed.X.toFixed(3)} Y{c.programmed.Y.toFixed(3)} Z{c.programmed.Z.toFixed(3)}{hide ? '' : ` · Tip X${c.tip.X.toFixed(3)} Y${c.tip.Y.toFixed(3)} Z${c.tip.Z.toFixed(3)}`}</Label>}
    {(ef.state === 'KICKED' || ef.state === 'OVER-TRAVELLED' || ef.state === 'RUNNING TRUE') && <>
      <Ring at={[t.toolTip[0], t.toolTip[1], t.toolTip[2] + 4]} r={ef.r!} color={ef.state === 'KICKED' ? '#00e676' : ef.state === 'RUNNING TRUE' ? '#90a4ae' : '#ff1744'} />
      <Label at={[t.toolTip[0], t.toolTip[1], t.toolTip[2] - 6]} cls="ref">Edge finder r {ef.r!.toFixed(3)} · gap {ef.gap!.toFixed(3)} · contact X{s.machine.X.toFixed(3)} Y{s.machine.Y.toFixed(3)}</Label>
    </>}
    {blk && <mesh position={[t.toolTip[0], t.toolTip[1], t.toolTip[2] - blk.gap + s.setup.gaugeBlock / 2]}>
      <boxGeometry args={[50, 25, s.setup.gaugeBlock]} /><meshStandardMaterial color="#cfd8dc" transparent opacity={0.8} /></mesh>}
  </>;
}

function Machine({ exaggerate, overlays, sel, onSel, show }: { exaggerate: number; overlays: boolean; sel: PieceId | null; onSel: (id: PieceId | null) => void; show: Record<Sys, boolean> }) {
  const s = useSceneState();
  const hide = useHideTruth();
  const t = sceneTransforms(s, UMC500);
  const g = UMC500.geometry;
  const tilt: [number, number, number] = g.bTiltAxis === 'X' ? [t.bRad, 0, 0] : [0, t.bRad, 0];
  const lim = UMC500.limits;
  return (
    <group rotation={[-HALF_PI, 0, 0]} scale={0.01}>
      <mesh position={[0, 0, -260]}><boxGeometry args={[1000, 700, 120]} /><meshStandardMaterial color="#3a3f47" /></mesh>
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[0, sgn * 270, -110]}><boxGeometry args={[260, 90, 300]} /><meshStandardMaterial color="#c9ccd1" /></mesh>
      ))}
      <group position={[0, 0, -g.trunnionPivotBelowPlatter]} rotation={tilt}>
        <group position={[0, 0, g.trunnionPivotBelowPlatter]}>
          <mesh position={[0, 0, -90]}><boxGeometry args={[260, 460, 80]} /><meshStandardMaterial color="#9aa0a8" /></mesh>
          <group rotation={[0, 0, t.cRad]}>
            <mesh rotation={[HALF_PI, 0, 0]} position={[0, 0, -25]}>
              <cylinderGeometry args={[g.platterDiameter / 2, g.platterDiameter / 2, 50, 48]} /><meshStandardMaterial color="#b8bcc2" />
            </mesh>
            <mesh position={[g.platterDiameter / 2 - 20, 0, 2]}><boxGeometry args={[30, 8, 4]} /><meshStandardMaterial color="#e33" /></mesh>
            <Workholding sel={sel} onSel={onSel} />
            {sel && <PieceToolbar id={sel} />}
          </group>
        </group>
      </group>
      <group position={t.gaugeLine}>
        <mesh position={[0, 0, 200]}><boxGeometry args={[220, 260, 300]} /><meshStandardMaterial color="#d7d9dc" /></mesh>
        <mesh rotation={[HALF_PI, 0, 0]} position={[0, 0, 25]}><cylinderGeometry args={[55, 55, 50, 32]} /><meshStandardMaterial color="#6b7078" /></mesh>
        <mesh rotation={[-HALF_PI, 0, 0]} position={[0, 0, -Math.min(45, t.toolLength - 10) / 2]}>
          <coneGeometry args={[35, Math.min(45, Math.max(t.toolLength - 10, 1)), 32]} /><meshStandardMaterial color="#444" />
        </mesh>
        <ToolBody t={t} />
      </group>
      {overlays && <Overlays t={t} exaggerate={exaggerate} hide={hide} />}
      <CoordSystems show={show} hide={hide} />
      <FiveOverlays hide={hide} />
      <mesh position={[(lim.X.min + lim.X.max) / 2 - g.xAtCentre, (lim.Y.min + lim.Y.max) / 2 - g.yAtCentre, (lim.Z.min + lim.Z.max) / 2 + g.gaugeLineAtZ0]}>
        <boxGeometry args={[lim.X.max - lim.X.min, lim.Y.max - lim.Y.min, lim.Z.max - lim.Z.min]} />
        <meshBasicMaterial color="#4fc3f7" wireframe transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

/** Releases WebGL resources when the simulator unmounts (route change) and drops the debug handle. */
function GlCleanup() {
  const gl = useThree((s) => s.gl);
  useEffect(() => () => {
    gl.renderLists.dispose(); gl.dispose();
    const w = window as unknown as { __hvlGl?: unknown };
    if (w.__hvlGl === gl) delete w.__hvlGl;
  }, [gl]);
  return null;
}

export function MachineScene() {
  const labelsRef = useRef<HTMLDivElement>(null) as RefObject<HTMLElement>;
  const [view, setView] = useState<View>('iso');
  const [ortho, setOrtho] = useState(false);
  const [exag, setExag] = useState(false);
  const [overlays, setOverlays] = useState(true);
  const [sel, setSel] = useState<PieceId | null>(null);
  const [show, setShow] = useState<Record<Sys, boolean>>({ machine: true, datum: true, work: true, tip: true });
  return (
    <div className="scene">
      <div className="views">
        {(Object.keys(VIEWS) as View[]).map((v) => <button key={v} className={v === view ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}
        <button className={ortho ? 'on' : ''} onClick={() => setOrtho(!ortho)}>ortho</button>
        <button className={overlays ? 'on' : ''} data-testid="overlays" onClick={() => setOverlays(!overlays)}>labels</button>
        {(['machine', 'datum', 'work', 'tip'] as Sys[]).map((k) => <button key={k} data-testid={`sys-${k}`} className={show[k] ? 'on' : ''}
          onClick={() => setShow({ ...show, [k]: !show[k] })}>{{ machine: 'machine', datum: 'workpiece datum', work: 'work offset', tip: 'prog/tip' }[k]}</button>)}
        <button className={exag ? 'on' : ''} title="Exaggerate actual-vs-programmed tip error x50" onClick={() => setExag(!exag)}>error x50</button>
      </div>
      <div className="labels" ref={labelsRef as RefObject<HTMLDivElement>} aria-hidden="true" />
      {/* On-demand rendering: frames are drawn only when the state, camera or controls change. DPR capped for lab PCs. */}
      <LabelsPortal.Provider value={labelsRef}>
      <Canvas data-testid="canvas" frameloop="demand" dpr={[1, 1.5]} onCreated={(st) => { (window as unknown as { __hvlGl: unknown }).__hvlGl = st.gl; }}>
        <GlCleanup />
        {ortho ? <OrthographicCamera makeDefault zoom={45} near={-100} far={100} /> : <PerspectiveCamera makeDefault fov={45} near={0.1} far={200} />}
        <CameraRig view={view} ortho={ortho} />
        <color attach="background" args={['#1b1e23']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 6]} intensity={1.6} />
        <Grid position={[0, -3.2, 0]} args={[20, 20]} cellColor="#333" sectionColor="#555" />
        <Machine exaggerate={exag ? 50 : 1} overlays={overlays} sel={sel} onSel={setSel} show={show} />
        <OrbitControls makeDefault />
      </Canvas>
      </LabelsPortal.Provider>
    </div>
  );
}
