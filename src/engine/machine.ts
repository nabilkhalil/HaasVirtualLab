import { AXES, type Axis, type MachineProfile } from '../config/umc500';
import { DEFAULT_TOOLS, OFFSET_COLS, OFFSET_ROWS, TOOL_LIMITS, type OffsetField, type PhysicalTool } from '../config/tools';
import { DEFAULT_SETUP, LIMITS, WCS, WORK_AXES, type PieceId, type Setup, type Wcs, type WorkAxis, type Workpiece } from '../config/workholding';
import { collision, emptyOffsets, findTool, r3, validateOffset, type OffsetTable } from './tools';
import { setupInterference } from './workholding';
import { getVariant } from './variant';
import { categorize } from './explain';
import { ctrlTarget, estimateMrzp, machineFor, probeSphere, requiredBC, sweep, trueMrzp, type Comp, type SphereHit, type V3 } from './fiveaxis';
export const FACES: Record<string, V3> = { Top: [0, 0, 1], Front: [0, -1, 0], Side: [1, 0, 0], Inclined: [Math.sin(Math.PI / 6), 0, Math.cos(Math.PI / 6)] };

export type WorkRow = Record<WorkAxis, number>;
const zeroWork = (): Record<Wcs, WorkRow> => Object.fromEntries(WCS.map((w) => [w, { X: 0, Y: 0, Z: 0, B: 0, C: 0 }])) as Record<Wcs, WorkRow>;
/** Simulator validation range for work offsets (not a Haas limit). */
const WORK_RANGE: Record<WorkAxis, number> = { X: 999, Y: 999, Z: 999, B: 360, C: 360 };

/** HANDLE JOG, ZERO RETURN (S1) and a simulated MDI context for G254/G234 exercises (real MDI: Phase 6). */
export type Mode = 'HANDLE_JOG' | 'ZERO_RETURN' | 'MDI_SIM';
/** Simulator messages. These are NOT Haas alarm numbers or texts. */
export interface SimAlarm { code: string; text: string }
export type Screen = 'POSITION' | 'OFFSET';
/** Offset page columns: 0-3 page 1 (editable), 4-5 page 2 (read-only: tool type, pocket). */
export const PAGE2_COLS = ['Tool Type', 'Tool Pocket'] as const;
export const MAX_COL = 3 + PAGE2_COLS.length;

export interface MachineState {
  mode: Mode;
  selectedAxis: Axis;
  jogIncrement: number;
  /** Machine coordinates (mm / deg). Single source of truth for controller and 3D scene. */
  machine: Record<Axis, number>;
  estopPressed: boolean;
  alarms: SimAlarm[];
  message: string;
  /** Physical tools (truth). Separate from stored offsets. */
  tools: PhysicalTool[];
  /** Tool physically in the spindle (0 = empty). */
  activeTool: number;
  offsets: OffsetTable;
  screen: Screen;
  cursor: { row: number; col: number };
  input: string;
  /** Pending Setting 142 confirmation (tool or work offset). */
  prompt: { kind: 'tool' | 'work'; row: number; field: string; value: number; text: string; advance?: boolean } | null;
  offsetTab: 'TOOL' | 'WORK';
  /** Work offsets G54-G59 and the active work coordinate system (power-up: G54, S1 T2.22). */
  work: Record<Wcs, WorkRow>;
  activeWcs: Wcs;
  workCursor: { row: number; col: number };
  /** Physical workholding setup (truth). */
  setup: Setup;
  /** Compensation check panel: G43 H / G41 D / programmed Z (relative to part top). */
  check: { h: number; d: number; z: number };
  /** Assessment metrics: accepted operations, rejected/incorrect actions, collisions, alarms, mistakes by category. */
  stats: { rejected: number; measures: number; toolChanges: number; collisions: number; ok: number; alarms: number; mistakes: Record<string, number> };
  /** Active length compensation / rotary mode: G43, G254 (DWO, with G43) or G234 (TCPC). */
  comp: Comp;
  /** Simulated calibration error of settings 255-257 (controller MRZP minus true rotary centre). */
  mrzpError: { X: number; Y: number; Z: number };
  mrzpHits: SphereHit[];
  lastPoint: V3 | null;
  faceLog: string[];
}

export type Key =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '-'
  | 'CANCEL' | 'F1' | 'ENTER' | 'ORIGIN' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'PAGE_UP' | 'PAGE_DOWN'
  | 'OFFSET' | 'POSITION' | 'TOOL_OFFSET_MEASURE' | 'NEXT_TOOL' | 'Y' | 'N' | 'F4' | 'PART_ZERO_SET' | 'HANDLE_JOG' | 'ZERO_RETURN' | 'ALL' | 'SINGLE';

export type Action =
  | { type: 'SELECT_AXIS'; axis: Axis }
  | { type: 'SET_INCREMENT'; increment: number }
  | { type: 'JOG'; axis?: Axis; direction: 1 | -1; steps?: number }
  | { type: 'ESTOP_PRESS' }
  | { type: 'ESTOP_RELEASE' }
  | { type: 'RESET' }
  | { type: 'KEY'; key: Key }
  | { type: 'CURSOR_TO'; row: number; col: number }
  | { type: 'TOOL_CHANGE'; tool: number }
  | { type: 'EDIT_TOOL'; number: number; patch: Partial<Pick<PhysicalTool, 'length' | 'diameter' | 'pocket'>> }
  | { type: 'SET_CHECK'; h?: number; d?: number; z?: number }
  | { type: 'SET_OFFSET'; n: number; field: OffsetField; value: number; mode: 'set' | 'add' }
  | { type: 'SET_WORK'; wcs: Wcs; axis: WorkAxis; value: number }
  | { type: 'SET_WCS'; wcs: Wcs }
  | { type: 'WORK_CURSOR_TO'; row: number; col: number }
  | { type: 'UPDATE_PIECE'; id: PieceId; patch: Partial<Omit<Workpiece, 'id'>> }
  | { type: 'SET_SETUP'; patch: Partial<Omit<Setup, 'pieces'>> }
  | { type: 'MDI'; cmd: 'G254' | 'G255' | 'G43' | 'G234'; h?: number }
  | { type: 'MDI_ROTATE'; B?: number; C?: number; dryRun?: boolean }
  | { type: 'MDI_MOVE'; w: V3; dryRun?: boolean }
  | { type: 'INTERP'; to: Record<Axis, number> }
  | { type: 'SET_MRZP_ERROR'; X?: number; Y?: number; Z?: number }
  | { type: 'PROBE_SPHERE' }
  | { type: 'APPLY_MRZP' }
  | { type: 'CLEAR_HITS' }
  | { type: 'CONFIRM_FACE'; face: string };

export const ALARM_ESTOP: SimAlarm = { code: 'SIM-ESTOP', text: 'Simulated emergency stop' };

export function initialState(profile: MachineProfile): MachineState {
  const s = baseState(profile), v = getVariant();
  if (!v) return s;
  return {
    ...s,
    tools: s.tools.map((t) => ({ ...t, length: r3(t.length + (v.toolDelta[t.number] ?? 0)) })),
    setup: { ...s.setup, pieces: s.setup.pieces.map((w) => ({ ...w, pos: [w.pos[0] + (w.id === 'A' ? v.aShiftX : v.bShiftX), w.pos[1]] as [number, number] })) },
  };
}

function baseState(profile: MachineProfile): MachineState {
  const machine = Object.fromEntries(AXES.map((a) => [a, 0])) as Record<Axis, number>;
  return {
    mode: 'HANDLE_JOG', selectedAxis: 'X', jogIncrement: profile.jogIncrements[2], machine,
    estopPressed: false, alarms: [], message: '',
    tools: DEFAULT_TOOLS.map((t) => ({ ...t })), activeTool: 1, offsets: emptyOffsets(),
    screen: 'POSITION', cursor: { row: 1, col: 0 }, input: '', prompt: null,
    check: { h: 1, d: 1, z: 5 }, stats: { rejected: 0, measures: 0, toolChanges: 0, collisions: 0, ok: 0, alarms: 0, mistakes: {} },
    offsetTab: 'TOOL', work: zeroWork(), activeWcs: 'G54', workCursor: { row: 0, col: 0 },
    setup: structuredClone(DEFAULT_SETUP),
    comp: 'G43', mrzpError: { X: 0, Y: 0, Z: 0 }, mrzpHits: [], lastPoint: null, faceLog: [],
  };
}

const wrap360 = (v: number) => r3(((v % 360) + 360) % 360);
const validRow = (n: number) => Number.isInteger(n) && n >= 1 && n <= OFFSET_ROWS;
const reject = (s: MachineState, message: string): MachineState => ({
  ...s, message, stats: { ...s.stats, rejected: s.stats.rejected + 1, collisions: s.stats.collisions + (/would hit|would move/.test(message) ? 1 : 0) },
});

export function canMove(s: MachineState): string | null {
  if (s.estopPressed) return 'Motion blocked: E-stop pressed';
  if (s.alarms.length) return 'Motion blocked: clear alarm with RESET';
  if (s.mode !== 'HANDLE_JOG') return `Motion blocked: not in Handle Jog — press HANDLE JOG${s.comp !== 'G43' ? ` (this cancels ${s.comp})` : ''}`;
  return null;
}

/** Writes one offset value, applying Setting 142 (S1: prompt if change exceeds the setting). */
export function writeOffset(s: MachineState, row: number, field: OffsetField, value: number, p: MachineProfile, confirmed = false): MachineState {
  if (!validRow(row)) return { ...s, message: 'Invalid offset number' };
  const v = r3(value);
  const err = validateOffset(field, v);
  if (err) return { ...s, message: err };
  const old = s.offsets[row][field];
  if (!confirmed && p.settings.s142 > 0 && Math.abs(v - old) > p.settings.s142) {
    return { ...s, prompt: { kind: 'tool', row, field, value: v, text: `${v.toFixed(3)} changes the offset by more than Setting 142! Accept (Y/N)?` }, message: '' };
  }
  return { ...s, prompt: null, input: '', offsets: { ...s.offsets, [row]: { ...s.offsets[row], [field]: v } }, message: `T${row} ${field} = ${v.toFixed(3)}` };
}

/** Writes one work offset value (G54-G59), applying Setting 142. */
export function writeWork(s: MachineState, wcs: Wcs, axis: WorkAxis, value: number, p: MachineProfile, confirmed = false, advance = false): MachineState {
  const v = r3(value);
  if (!Number.isFinite(v) || Math.abs(v) > WORK_RANGE[axis]) return { ...s, message: !Number.isFinite(v) ? 'Invalid number' : `Out of range (±${WORK_RANGE[axis]})` };
  const row = WCS.indexOf(wcs);
  if (!confirmed && p.settings.s142 > 0 && Math.abs(v - s.work[wcs][axis]) > p.settings.s142) {
    return { ...s, prompt: { kind: 'work', row, field: axis, value: v, advance, text: `${v.toFixed(3)} changes the offset by more than Setting 142! Accept (Y/N)?` }, message: '' };
  }
  const col = advance && s.workCursor.col < 2 ? s.workCursor.col + 1 : s.workCursor.col;
  return { ...s, prompt: null, input: '', work: { ...s.work, [wcs]: { ...s.work[wcs], [axis]: v } }, workCursor: { row, col }, message: `${wcs} ${axis} = ${v.toFixed(3)}` };
}

/** Simulated tool change (M06 / [NEXT TOOL]): Z retracts to machine zero first, then the tool is swapped. */
function toolChange(s: MachineState, tool: number, p: MachineProfile): MachineState {
  const blocked = canMove(s);
  if (blocked) return reject(s, blocked);
  if (!findTool(s, tool)) return { ...s, message: `Tool ${tool} not in library` };
  const retracted = { ...s, machine: { ...s.machine, Z: 0 } };
  if (collision(retracted, p)) return reject(s, 'Tool change rejected: Z retract blocked');
  const next = { ...retracted, activeTool: tool, check: { ...s.check, h: tool, d: tool },
    stats: { ...s.stats, toolChanges: s.stats.toolChanges + 1 }, message: `Tool change: T${tool} in spindle` };
  const hit = collision(next, p);
  return hit ? reject(s, `Tool change rejected: ${hit}`) : next;
}

function workKey(s: MachineState, k: Key, p: MachineProfile): MachineState {
  const c = s.workCursor, wcs = WCS[c.row], axis = WORK_AXES[c.col];
  switch (k) {
    case 'UP': case 'DOWN': case 'PAGE_UP': case 'PAGE_DOWN': {
      const d = { UP: -1, DOWN: 1, PAGE_UP: -WCS.length, PAGE_DOWN: WCS.length }[k];
      return { ...s, workCursor: { ...c, row: Math.min(WCS.length - 1, Math.max(0, c.row + d)) } };
    }
    case 'LEFT': return { ...s, workCursor: { ...c, col: Math.max(0, c.col - 1) } };
    case 'RIGHT': return { ...s, workCursor: { ...c, col: Math.min(WORK_AXES.length - 1, c.col + 1) } };
    case 'ORIGIN': return writeWork(s, wcs, axis, 0, p);
    default: {
      if (s.input === '') return s;
      const v = Number(s.input);
      if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s.input) || !Number.isFinite(v)) return { ...s, message: 'Invalid number' };
      return writeWork(s, wcs, axis, k === 'F1' ? v : s.work[wcs][axis] + v, p);
    }
  }
}

function key(s: MachineState, k: Key, p: MachineProfile): MachineState {
  if (s.prompt) {
    if (k === 'Y') return s.prompt.kind === 'tool'
      ? writeOffset(s, s.prompt.row, s.prompt.field as OffsetField, s.prompt.value, p, true)
      : writeWork(s, WCS[s.prompt.row], s.prompt.field as WorkAxis, s.prompt.value, p, true, s.prompt.advance);
    if (k === 'N') return { ...s, prompt: null, message: 'Offset change rejected' };
    return { ...s, message: 'Answer Y or N' };
  }
  if (/^[0-9]$/.test(k) || k === '.' || k === '-') return s.input.length >= 12 ? s : { ...s, input: s.input + k };
  const c = s.cursor, field = OFFSET_COLS[c.col];
  switch (k) {
    case 'CANCEL': return { ...s, input: s.input.slice(0, -1) };
    case 'OFFSET': return { ...s, screen: 'OFFSET', message: '' };
    case 'POSITION': return { ...s, screen: 'POSITION', message: '' };
    case 'HANDLE_JOG':
      return { ...s, mode: 'HANDLE_JOG', comp: 'G43', message: s.comp !== 'G43' ? `${s.comp} cancelled by HANDLE JOG (S2)` : 'HANDLE JOG' };
    case 'ZERO_RETURN':
      return { ...s, mode: 'ZERO_RETURN', comp: 'G43', message: 'ZERO RETURN mode: press ALL, or select an axis and press SINGLE' };
    case 'ALL': case 'SINGLE': {
      if (s.mode !== 'ZERO_RETURN') return reject(s, 'Select ZERO RETURN mode first');
      if (s.estopPressed || s.alarms.length) return reject(s, 'Zero return blocked: clear E-stop/alarm');
      // Simulator order: Z first, then X/Y, then B/C (order not stated in S1).
      const seq: Partial<Record<Axis, number>>[] = k === 'SINGLE' ? [{ [s.selectedAxis]: 0 }] : [{ Z: 0 }, { X: 0, Y: 0 }, { B: 0, C: 0 }];
      let st = s;
      for (const step of seq) {
        const tgt = { ...step };
        const hit = sweep(st, p, tgt);
        if (hit) return reject(st, `Zero return stopped: ${hit}`);
        st = { ...st, machine: { ...st.machine, ...tgt } };
      }
      return { ...st, message: k === 'ALL' ? 'All axes at machine zero' : `${s.selectedAxis} at machine zero` };
    }
    case 'F4':
      if (s.screen !== 'OFFSET') return { ...s, message: 'Open the OFFSET display first' };
      return { ...s, offsetTab: s.offsetTab === 'TOOL' ? 'WORK' : 'TOOL', message: '' };
    case 'PART_ZERO_SET': {
      if (s.screen !== 'OFFSET' || s.offsetTab !== 'WORK') return { ...s, message: 'Select the WORK offset tab (OFFSET, then F4)' };
      if (s.estopPressed) return reject(s, 'Release E-stop first');
      const wcs = WCS[s.workCursor.row], axis = WORK_AXES[s.workCursor.col];
      // S1: "the current machine position is automatically stored in that address"; 1st press X, 2nd Y, 3rd Z.
      const out = writeWork(s, wcs, axis, s.machine[axis], p, false, true);
      return axis === 'Z' ? { ...out, message: `${out.message} — CAUTION: Z work offset loaded (S1: can cause a crash with part-top tool offsets)` } : out;
    }
    case 'UP': case 'DOWN': case 'PAGE_UP': case 'PAGE_DOWN': case 'LEFT': case 'RIGHT': case 'F1': case 'ENTER': case 'ORIGIN':
      if (s.screen === 'OFFSET' && s.offsetTab === 'WORK') return workKey(s, k, p);
  }
  switch (k) {
    case 'UP': case 'DOWN': case 'PAGE_UP': case 'PAGE_DOWN': {
      const d = { UP: -1, DOWN: 1, PAGE_UP: -10, PAGE_DOWN: 10 }[k];
      return { ...s, cursor: { ...c, row: Math.min(OFFSET_ROWS, Math.max(1, c.row + d)) } };
    }
    case 'LEFT': return { ...s, cursor: { ...c, col: Math.max(0, c.col - 1) } };
    case 'RIGHT': return { ...s, cursor: { ...c, col: Math.min(MAX_COL, c.col + 1) } };
    case 'F1': case 'ENTER': case 'ORIGIN': {
      if (s.screen !== 'OFFSET') return { ...s, message: 'Open the OFFSET display first' };
      if (!field) return { ...s, message: 'Read-only column' };
      if (k === 'ORIGIN') return writeOffset(s, c.row, field, 0, p);
      if (s.input === '') return s;
      const v = Number(s.input);
      if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s.input) || !Number.isFinite(v)) return { ...s, message: 'Invalid number' };
      return writeOffset(s, c.row, field, k === 'F1' ? v : s.offsets[c.row][field] + v, p);
    }
    case 'TOOL_OFFSET_MEASURE': {
      if (s.offsetTab === 'WORK' && s.screen === 'OFFSET') return { ...s, message: 'Highlight a Length Geometry (H) value on the TOOL tab' };
      if (s.estopPressed || s.alarms.length) return reject(s, 'Measurement blocked: clear E-stop/alarm');
      if (s.screen !== 'OFFSET' || field !== 'hGeom') return { ...s, message: 'Highlight a Length Geometry (H) value on the OFFSET display' };
      if (!s.activeTool) return { ...s, message: 'No tool in spindle' };
      if (s.machine.B !== 0) return { ...s, message: 'Set the tilt axis to B0 before touching off tools' };
      // Setting 64 OFF: offset = Z machine position (S1). Work Z offset is 0 in Phase 2, so ON gives the same value.
      const out = writeOffset(s, c.row, 'hGeom', s.machine.Z, p);
      return { ...out, stats: { ...out.stats, measures: s.stats.measures + 1 } };
    }
    case 'NEXT_TOOL': {
      const nums = s.tools.map((t) => t.number).sort((a, b) => a - b);
      const next = nums.find((n) => n > s.activeTool) ?? nums[0];
      return toolChange(s, next, p);
    }
    default: return s;
  }
}

/** Actions that count as operator operations for the "correct controller operations" metric. */
const OPERATIONS = new Set(['KEY', 'JOG', 'TOOL_CHANGE', 'MDI', 'MDI_ROTATE', 'MDI_MOVE', 'UPDATE_PIECE', 'SET_SETUP', 'ESTOP_PRESS', 'ESTOP_RELEASE', 'RESET', 'PROBE_SPHERE', 'APPLY_MRZP', 'CONFIRM_FACE']);
export function reduce(s: MachineState, a: Action, p: MachineProfile): MachineState {
  const n = reduceCore(s, a, p);
  if (n === s) return s;
  const st = { ...n.stats };
  const cat = n.message !== s.message || n.stats.rejected !== s.stats.rejected ? categorize(n.message) : null;
  if (cat) {
    st.mistakes = { ...st.mistakes, [cat]: (st.mistakes[cat] ?? 0) + 1 };
    if (n.stats.rejected === s.stats.rejected) st.rejected += 1; // wrong-screen / invalid entries also count as incorrect
  } else if (OPERATIONS.has(a.type)) st.ok += 1;
  if (n.alarms.length > s.alarms.length) st.alarms += 1;
  return { ...n, stats: st };
}

function reduceCore(s: MachineState, a: Action, p: MachineProfile): MachineState {
  switch (a.type) {
    case 'SELECT_AXIS':
      return { ...s, selectedAxis: a.axis, message: '' };
    case 'SET_INCREMENT':
      if (!p.jogIncrements.includes(a.increment)) return { ...s, message: 'Unsupported increment' };
      return { ...s, jogIncrement: a.increment, message: '' };
    case 'JOG': {
      const blocked = canMove(s);
      if (blocked) return reject(s, blocked);
      const axis = a.axis ?? s.selectedAxis;
      const lim = p.limits[axis];
      const target = r3(s.machine[axis] + a.direction * (a.steps ?? 1) * s.jogIncrement);
      let value = target;
      if (lim.continuous) value = wrap360(target);
      else if (target > lim.max || target < lim.min) return reject({ ...s, selectedAxis: axis }, `Travel limit: ${axis} ${lim.min} to ${lim.max}`);
      const next = { ...s, selectedAxis: axis, machine: { ...s.machine, [axis]: value }, message: '' };
      // Swept check along the jog (linear ≤2 mm, rotary ≤1° samples), incl. rotating parts vs spindle head.
      const hit = sweep(s, p, { [axis]: lim.continuous ? s.machine[axis] + (target - s.machine[axis]) : value });
      return hit ? reject({ ...s, selectedAxis: axis }, `Move rejected: ${hit}`) : next;
    }
    case 'ESTOP_PRESS':
      return {
        ...s, estopPressed: true, comp: 'G43',
        alarms: s.alarms.some((x) => x.code === ALARM_ESTOP.code) ? s.alarms : [...s.alarms, ALARM_ESTOP],
        message: 'E-stop pressed',
      };
    case 'ESTOP_RELEASE':
      return { ...s, estopPressed: false, message: 'E-stop released; press RESET' };
    case 'RESET':
      if (s.estopPressed) return { ...s, message: 'Release E-stop before RESET' };
      // S1: RESET clears alarms and input text.
      return { ...s, alarms: [], input: '', prompt: null, comp: 'G43', message: s.comp !== 'G43' ? `Alarms cleared; ${s.comp} cancelled by RESET` : 'Alarms cleared' };
    case 'KEY':
      return key(s, a.key, p);
    case 'CURSOR_TO':
      if (!validRow(a.row) || a.col < 0 || a.col > MAX_COL) return s;
      return { ...s, cursor: { row: a.row, col: a.col } };
    case 'TOOL_CHANGE':
      return toolChange(s, a.tool, p);
    case 'EDIT_TOOL': {
      const t = findTool(s, a.number);
      if (!t) return { ...s, message: 'Unknown tool' };
      if (a.number === s.activeTool) return { ...s, message: 'Unload the tool before editing its physical data' };
      const n = { ...t, ...a.patch };
      if (!(n.length >= TOOL_LIMITS.length.min && n.length <= TOOL_LIMITS.length.max)) return { ...s, message: 'Tool length out of range' };
      if (!(n.diameter >= TOOL_LIMITS.diameter.min && n.diameter <= TOOL_LIMITS.diameter.max)) return { ...s, message: 'Tool diameter out of range' };
      if (!Number.isInteger(n.pocket) || n.pocket < 1 || n.pocket > p.atcPockets) return { ...s, message: `Pocket must be 1 to ${p.atcPockets}` };
      if (s.tools.some((o) => o.number !== n.number && o.pocket === n.pocket)) return { ...s, message: `Pocket ${n.pocket} already used` };
      return { ...s, tools: s.tools.map((o) => (o.number === n.number ? { ...n, length: r3(n.length), diameter: r3(n.diameter) } : o)), message: `T${n.number} physical data updated` };
    }
    case 'SET_CHECK': {
      const c = { ...s.check, ...Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== 'type' && Number.isFinite(v))) };
      if (!validRow(c.h) || !validRow(c.d)) return { ...s, message: 'Invalid H/D number' };
      return { ...s, check: c as MachineState['check'] };
    }
    case 'SET_WORK':
      return writeWork(s, a.wcs, a.axis, a.value, p, true);
    case 'WORK_CURSOR_TO':
      if (a.row < 0 || a.row >= WCS.length || a.col < 0 || a.col >= WORK_AXES.length) return s;
      return { ...s, workCursor: { row: a.row, col: a.col } };
    case 'SET_WCS':
      return { ...s, activeWcs: a.wcs, message: `${a.wcs} active (simulated MDI command)` };
    case 'UPDATE_PIECE': {
      const w = s.setup.pieces.find((x) => x.id === a.id);
      if (!w) return s;
      const geometric = ['size', 'pos', 'yaw', 'mount', 'present'].some((k) => k in a.patch);
      if (geometric && w.clamped && a.patch.clamped !== false) return reject(s, `Unclamp workpiece ${a.id} before moving or changing it`);
      const n: Workpiece = { ...w, ...a.patch };
      const [L, W, H] = n.size;
      if (L < LIMITS.L[0] || L > LIMITS.L[1] || W < LIMITS.W[0] || W > LIMITS.W[1] || H < LIMITS.H[0] || H > LIMITS.H[1]) return { ...s, message: 'Stock size out of range' };
      if (n.mount === 'vice') n.pos = [Math.max(-(110 - L / 2), Math.min(110 - L / 2, n.pos[0])), 0];
      if (n.mount === 'vice' && s.setup.pieces.some((x) => x.id !== n.id && x.mount === 'vice' && x.present)) return { ...s, message: 'The vice already holds a workpiece' };
      const next = { ...s, setup: { ...s.setup, pieces: s.setup.pieces.map((x) => (x.id === n.id ? n : x)) } };
      const inter = setupInterference(next, p);
      if (inter) return reject(s, inter);
      const hit = collision(next, p);
      if (hit) return reject(s, `Setup change rejected: ${hit}`);
      return { ...next, message: a.patch.clamped !== undefined ? `Workpiece ${n.id} ${n.clamped ? 'clamped' : 'unclamped'}` : `Workpiece ${n.id} updated` };
    }
    case 'SET_SETUP': {
      const vicePiece = s.setup.pieces.find((x) => x.mount === 'vice' && x.present);
      if ('parallels' in a.patch && vicePiece?.clamped) return reject(s, 'Unclamp the vice before changing parallels');
      if (a.patch.gaugeBlock !== undefined && !(a.patch.gaugeBlock >= LIMITS.gauge[0] && a.patch.gaugeBlock <= LIMITS.gauge[1])) return { ...s, message: 'Gauge block thickness out of range' };
      const next = { ...s, setup: { ...s.setup, ...a.patch, gaugeBlock: r3(a.patch.gaugeBlock ?? s.setup.gaugeBlock) } };
      const hit = collision(next, p);
      return hit ? reject(s, `Setup change rejected: ${hit}`) : { ...next, message: 'Setup updated' };
    }
    case 'MDI': {
      if (s.estopPressed || s.alarms.length) return reject(s, 'Clear E-stop/alarm first');
      const mdi = { ...s, mode: 'MDI_SIM' as Mode };
      if (a.cmd === 'G254') {
        if (s.comp === 'G234') return reject(s, 'G234 cannot be used at the same time as G254 (S2). Cancel TCPC with G43 first');
        if (s.work[s.activeWcs].B !== 0) return reject(s, `The B-Axis value of ${s.activeWcs} must be zero for G254 (S2)`);
        return { ...mdi, comp: 'G254', message: `G254 DWO active with ${s.activeWcs}. Specify X/Y, then Z, before cutting (S2)` };
      }
      if (a.cmd === 'G255') return { ...mdi, comp: s.comp === 'G254' ? 'G43' : s.comp, message: 'G255: DWO cancelled' };
      if (!a.h || !(a.h >= 1 && a.h <= OFFSET_ROWS)) return reject(s, `${a.cmd} needs an H-code on the same block (S2)`);
      if (a.cmd === 'G234') {
        if (s.comp === 'G254') return reject(s, 'G234 cannot be used at the same time as G254 (S2). Cancel DWO with G255 first');
        return { ...mdi, comp: 'G234', check: { ...s.check, h: a.h }, message: `G234 TCPC on with H${a.h} (cancels G43)` };
      }
      return { ...mdi, comp: s.comp === 'G234' ? 'G43' : s.comp, check: { ...s.check, h: a.h }, message: `G43 H${a.h}${s.comp === 'G234' ? ' — cancels G234' : ''}` };
    }
    case 'MDI_ROTATE': {
      if (s.estopPressed || s.alarms.length) return reject(s, 'Clear E-stop/alarm first');
      if (s.comp === 'G254') return reject(s, 'Cancel G254 with G255 before ANY rotary motion (S2)');
      const B = a.B ?? s.machine.B, C = a.C ?? s.machine.C;
      if (B < p.limits.B.min || B > p.limits.B.max) {
        const al = { code: 'SIM-ROTARY-LIMIT', text: `B${B} outside ${p.limits.B.min}..${p.limits.B.max}° (S3)` };
        return a.dryRun ? { ...s, message: `Rotation check: rotary limit — ${al.text}` } : { ...reject(s, `Rotary limit: ${al.text}`), alarms: [...s.alarms, al] };
      }
      let tgt: Partial<Record<Axis, number>> = { B: r3(B), C: r3(C) };
      if (s.comp === 'G234' && s.lastPoint) {
        const st = { ...s, machine: { ...s.machine, B, C } };
        const [X, Y, Z] = machineFor(st, p, ctrlTarget(st, p, s.lastPoint), s.check.h);
        tgt = { ...tgt, X, Y, Z };
      }
      const hit = sweep(s, p, tgt);
      if (hit) return a.dryRun ? { ...s, message: `Rotation check: ${hit}` } : reject(s, `Rotation rejected: ${hit}`);
      if (a.dryRun) return { ...s, message: `Rotation check OK: B${r3(B)} C${r3(C)} is clear` };
      return { ...s, mode: 'MDI_SIM', machine: { ...s.machine, ...tgt, C: ((tgt.C! % 360) + 360) % 360 }, message: `Simulated G00 B${r3(B)} C${r3(C)}` };
    }
    case 'MDI_MOVE': {
      if (s.estopPressed || s.alarms.length) return reject(s, 'Clear E-stop/alarm first');
      const [X, Y, Z] = machineFor(s, p, ctrlTarget(s, p, a.w), s.check.h);
      for (const [ax, v] of [['X', X], ['Y', Y], ['Z', Z]] as const) {
        const l = p.limits[ax];
        if (v < l.min || v > l.max) {
          const al = { code: 'SIM-OVERTRAVEL', text: `${ax}${v} outside travel (S3)` };
          return a.dryRun ? { ...s, message: `Move check: over travel — ${al.text}` } : { ...reject(s, `Over travel: ${al.text}`), alarms: [...s.alarms, al] };
        }
      }
      const hit = sweep(s, p, { X, Y, Z });
      if (hit) return a.dryRun ? { ...s, message: `Move check: ${hit}` } : reject(s, `Move rejected: ${hit}`);
      if (a.dryRun) return { ...s, message: 'Move check OK' };
      return { ...s, mode: 'MDI_SIM', machine: { ...s.machine, X, Y, Z }, lastPoint: a.w, message: `Simulated G00 X${a.w[0]} Y${a.w[1]} Z${a.w[2]} (${s.comp})` };
    }
    case 'INTERP': {
      const st = { ...s, mode: 'MDI_SIM' as Mode, machine: { ...a.to } };
      const hit = collision(st, p);
      return hit ? reject(s, `Interpolation stopped: ${hit}`) : st;
    }
    case 'SET_MRZP_ERROR': {
      const e = { ...s.mrzpError, ...Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== 'type' && Number.isFinite(v))) };
      if (Object.values(e).some((v) => Math.abs(v as number) > 5)) return { ...s, message: 'Simulated calibration error limited to ±5 mm' };
      return { ...s, mrzpError: e as MachineState['mrzpError'], message: 'Simulated settings 255-257 changed (no real machine settings are touched)' };
    }
    case 'PROBE_SPHERE': {
      const r = probeSphere(s, p);
      if (typeof r === 'string') return reject(s, r);
      return { ...s, mrzpHits: [...s.mrzpHits.filter((h) => !(h.B === r.B && h.C === r.C)), r], message: `Sphere centre at B${r.B} C${r.C}: X${r.X} Y${r.Y} Z${r.Z}` };
    }
    case 'CLEAR_HITS':
      return { ...s, mrzpHits: [], message: 'Calibration measurements cleared' };
    case 'APPLY_MRZP': {
      const est = estimateMrzp(s.mrzpHits);
      if (!est) return reject(s, 'Need sphere measurements at B0 C0, B0 C180 and a tilted B with C0');
      const t = trueMrzp(p);
      return { ...s, mrzpError: { X: r3(est.X - t.X), Y: r3(est.Y - t.Y), Z: r3(est.Z - t.Z) }, message: `Simulated MRZP applied: X${est.X} Y${est.Y} Z${est.Z}` };
    }
    case 'CONFIRM_FACE': {
      const req = FACES[a.face] && requiredBC(FACES[a.face], p);
      if (!req) return reject(s, 'Face not reachable within B limits');
      const okC = Math.abs((((s.machine.C - req.C) % 360) + 540) % 360 - 180) <= 0.01;
      if (Math.abs(s.machine.B - req.B) > 0.01 || !okC) return reject(s, `${a.face} face needs B${req.B} C${req.C}`);
      return { ...s, faceLog: s.faceLog.includes(a.face) ? s.faceLog : [...s.faceLog, a.face], message: `${a.face} face oriented to the spindle` };
    }
    case 'SET_OFFSET':
      return writeOffset(s, a.n, a.field, a.mode === 'add' && validRow(a.n) ? s.offsets[a.n][a.field] + a.value : a.value, p);
  }
}
