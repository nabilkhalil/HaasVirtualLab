import { describe, expect, it } from 'vitest';
import { UMC500 as P, stockTop } from '../../src/config/umc500';
import { DEFAULT_TOOLS } from '../../src/config/tools';
import { initialState, reduce, type Action, type Key, type MachineState } from '../../src/engine/machine';
import { collision, g43Check, idealH, paperState, platterToWorld, referenceGap, worldToPlatter } from '../../src/engine/tools';
import { sceneTransforms } from '../../src/engine/sceneTransforms';

const run = (acts: Action[], s: MachineState = initialState(P)) => acts.reduce((st, a) => reduce(st, a, P), s);
const keys = (ks: (Key | string)[]): Action[] => ks.flatMap((k) => (k.length > 1 && !['CANCEL', 'F1', 'ENTER', 'ORIGIN', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'PAGE_UP', 'PAGE_DOWN', 'OFFSET', 'POSITION', 'TOOL_OFFSET_MEASURE', 'NEXT_TOOL'].includes(k)
  ? [...k].map((c) => ({ type: 'KEY', key: c as Key }) as Action) : [{ type: 'KEY', key: k as Key } as Action]));
const g = P.geometry;
const T = (n: number) => DEFAULT_TOOLS.find((t) => t.number === n)!;
/** Jog over the part centre (B=C=0) with 1 mm steps. */
const overPart: Action[] = [
  { type: 'SET_INCREMENT', increment: 1 },
  { type: 'JOG', axis: 'X', direction: -1, steps: -g.xAtCentre },
  { type: 'JOG', axis: 'Y', direction: -1, steps: -g.yAtCentre },
];
/** Jog Z (0.001 steps) to put the tip `gap` mm above the part top for tool n. */
const zForGap = (n: number, gap: number) => Math.round((stockTop(P) + T(n).length - g.gaugeLineAtZ0 + gap) * 1000) / 1000;
const jogZTo = (z: number): Action[] => [{ type: 'SET_INCREMENT', increment: 0.001 }, { type: 'JOG', axis: 'Z', direction: -1, steps: Math.round(-z * 1000) }];
const measureRow = (row: number): Action[] => [{ type: 'KEY', key: 'OFFSET' }, { type: 'CURSOR_TO', row, col: 0 }, { type: 'KEY', key: 'TOOL_OFFSET_MEASURE' }, { type: 'KEY', key: 'Y' }];

describe('reference planes and physical data', () => {
  it('ideal H = machine Z with tip at part top (negative, Setting 64 OFF)', () => {
    const h = idealH(T(1), P);
    expect(h).toBe(Math.round((stockTop(P) + T(1).length - g.gaugeLineAtZ0) * 1000) / 1000);
    expect(h).toBeLessThan(0);
  });
  it('editing physical tool data never changes stored offsets', () => {
    const s = run([{ type: 'SET_OFFSET', n: 2, field: 'hGeom', value: -5, mode: 'set' }, { type: 'EDIT_TOOL', number: 2, patch: { length: 150 } }]);
    expect(s.tools.find((t) => t.number === 2)!.length).toBe(150);
    expect(s.offsets[2].hGeom).toBe(-5);
  });
  it('validates tool edits: in-spindle, ranges, unique pockets', () => {
    expect(run([{ type: 'EDIT_TOOL', number: 1, patch: { length: 100 } }]).message).toMatch(/Unload/);
    expect(run([{ type: 'EDIT_TOOL', number: 2, patch: { length: 5 } }]).message).toMatch(/length/);
    expect(run([{ type: 'EDIT_TOOL', number: 2, patch: { pocket: 3 } }]).message).toMatch(/already used/);
    expect(run([{ type: 'EDIT_TOOL', number: 2, patch: { pocket: 12 } }]).tools[1].pocket).toBe(12);
  });
  it('platter transforms are inverse of each other', () => {
    const s = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'C', direction: 1, steps: 37 }, { type: 'JOG', axis: 'B', direction: -1, steps: 25 }]);
    const q = worldToPlatter(platterToWorld([12, -34, 56], s, P), s, P);
    q.forEach((v, i) => expect(v).toBeCloseTo([12, -34, 56][i], 2));
  });
});

describe('controller keys (S1 semantics)', () => {
  it('F1 sets, ENTER adds, CANCEL deletes last char, ORIGIN zeroes', () => {
    let s = run([{ type: 'KEY', key: 'OFFSET' }, { type: 'CURSOR_TO', row: 3, col: 1 }, ...keys(['0.025', 'F1'])]);
    expect(s.offsets[3].hWear).toBe(0.025);
    expect(s.input).toBe('');
    s = run(keys(['-.01', 'ENTER']), s);
    expect(s.offsets[3].hWear).toBe(0.015);
    s = run(keys(['12', 'CANCEL']), s);
    expect(s.input).toBe('1');
    s = run(keys(['ORIGIN']), s);
    expect(s.offsets[3].hWear).toBe(0);
  });
  it('rejects invalid input and out-of-range values', () => {
    const s0 = run([{ type: 'KEY', key: 'OFFSET' }]);
    expect(run(keys(['1-2', 'F1']), s0).message).toBe('Invalid number');
    expect(run([{ type: 'CURSOR_TO', row: 1, col: 1 }, ...keys(['6', 'F1'])], s0).message).toMatch(/Out of range/);
    expect(run(keys(['5', 'F1']), s0).offsets[1].hGeom).toBe(0); // H geometry must be <= 0
  });
  it('Setting 142 prompt: N rejects, Y accepts', () => {
    const s0 = run([{ type: 'KEY', key: 'OFFSET' }, ...keys(['-250', 'F1'])]);
    expect(s0.prompt?.text).toMatch(/Setting 142/);
    expect(run(keys(['N']), s0).offsets[1].hGeom).toBe(0);
    expect(run(keys(['Y']), s0).offsets[1].hGeom).toBe(-250);
  });
  it('cursor keys move and clamp; page 2 columns are read-only', () => {
    let s = run(keys(['OFFSET', 'UP', 'LEFT']));
    expect(s.cursor).toEqual({ row: 1, col: 0 });
    s = run(keys(['PAGE_DOWN', 'DOWN', 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT']), s);
    expect(s.cursor).toEqual({ row: 12, col: 5 });
    expect(run(keys(['1', 'F1']), s).message).toMatch(/Read-only/);
  });
  it('F1 outside the OFFSET display does nothing; RESET clears input', () => {
    expect(run(keys(['5', 'F1'])).message).toMatch(/OFFSET/);
    expect(run([...keys(['5']), { type: 'RESET' }]).input).toBe('');
  });
});

describe('tool change and NEXT TOOL', () => {
  it('retracts Z to machine zero, swaps tool, syncs check H/D', () => {
    const s = run([...overPart, { type: 'JOG', axis: 'Z', direction: -1, steps: 50 }, { type: 'TOOL_CHANGE', tool: 3 }]);
    expect(s.machine.Z).toBe(0);
    expect(s.activeTool).toBe(3);
    expect(s.check).toMatchObject({ h: 3, d: 3 });
  });
  it('NEXT TOOL cycles by tool number and wraps', () => {
    let s = run(keys(['NEXT_TOOL']));
    expect(s.activeTool).toBe(2);
    s = run(keys(Array(6).fill('NEXT_TOOL')), s);
    expect(s.activeTool).toBe(1);
    expect(s.stats.toolChanges).toBe(7);
  });
  it('blocked by E-stop; unknown tool rejected', () => {
    expect(run([{ type: 'ESTOP_PRESS' }, { type: 'TOOL_CHANGE', tool: 2 }]).activeTool).toBe(1);
    expect(run([{ type: 'TOOL_CHANGE', tool: 42 }]).activeTool).toBe(1);
  });
  it('position display stays in machine coordinates through a tool change', () => {
    const s = run([...overPart, { type: 'TOOL_CHANGE', tool: 4 }]);
    expect(s.machine).toMatchObject({ X: g.xAtCentre, Y: g.yAtCentre, Z: 0 });
    expect(sceneTransforms(s, P).toolLength).toBe(T(4).length);
  });
});

describe('manual tool length measurement', () => {
  it('paper states and measured H at paper contact', () => {
    const s = run([...overPart, ...jogZTo(zForGap(1, 0.1))]);
    expect(referenceGap(s, P)).toBe(0.1);
    expect(paperState(referenceGap(s, P), P)).toBe('PAPER DRAGS');
    expect(paperState(1, P)).toBe('PAPER FREE');
    expect(paperState(0.05, P)).toBe('PAPER PINCHED');
    const m = run(measureRow(1), s);
    expect(m.offsets[1].hGeom).toBe(s.machine.Z);
    expect(g43Check(m, P, 1, 0).lengthError).toBe(0.1); // paper thickness left in
  });
  it('exact touch gives zero error; measuring three tools', () => {
    let s = initialState(P);
    for (const n of [1, 2, 3]) {
      s = run([{ type: 'TOOL_CHANGE', tool: n }, { type: 'SET_INCREMENT', increment: 1 }, ...(n === 1 ? overPart.slice(1) : []), ...jogZTo(zForGap(n, 0)), ...measureRow(n)], s);
      expect(s.offsets[n].hGeom).toBe(idealH(T(n), P));
    }
    expect(s.stats.measures).toBe(3);
  });
  it('requires H geometry cursor, B0 and tool in spindle', () => {
    expect(run([{ type: 'KEY', key: 'OFFSET' }, { type: 'CURSOR_TO', row: 1, col: 1 }, { type: 'KEY', key: 'TOOL_OFFSET_MEASURE' }]).message).toMatch(/Length Geometry/);
    expect(run([{ type: 'JOG', axis: 'B', direction: -1 }, ...measureRow(1)]).message).toMatch(/B0/);
    expect(run(keys(['TOOL_OFFSET_MEASURE'])).message).toMatch(/OFFSET/);
  });
  it('measuring into the wrong row leaves the active tool row untouched', () => {
    const s = run([{ type: 'TOOL_CHANGE', tool: 2 }, ...overPart, ...jogZTo(zForGap(2, 0)), ...measureRow(1)]);
    expect(s.offsets[1].hGeom).toBe(idealH(T(2), P));
    expect(s.offsets[2].hGeom).toBe(0);
  });
});

describe('collision detection (static)', () => {
  it('rejects jogging the tip into the part and counts it', () => {
    const s = run([...overPart, ...jogZTo(zForGap(1, 0)), { type: 'JOG', axis: 'Z', direction: -1 }]);
    expect(s.message).toMatch(/hit the workpiece A/);
    expect(s.machine.Z).toBe(zForGap(1, 0));
    expect(s.stats.rejected).toBe(1);
  });
  it('detects tool side contact with the part and the vice', () => {
    const s = run([...overPart, ...jogZTo(zForGap(1, -10)).slice(0, 1)]);
    // move X so the 50 mm face mill is beside the part, then lower: must hit vice or part
    const side = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'X', direction: 1, steps: 70 }, { type: 'JOG', axis: 'Z', direction: -1, steps: 340 }], s);
    expect(side.message).toMatch(/hit the (workpiece A|vice)/);
  });
  it('no collision at home', () => expect(collision(initialState(P), P)).toBeNull());
});

describe('G43 compensation check (positive and negative errors)', () => {
  const base = run([{ type: 'SET_OFFSET', n: 1, field: 'hGeom', value: idealH(T(1), P), mode: 'set' }, { type: 'KEY', key: 'Y' }]);
  it('correct H: actual tip = programmed Z', () => {
    const c = g43Check(base, P, 1, 5);
    expect(c.lengthError).toBe(0);
    expect(c.actualTip).toBe(5);
    expect(c.machineZ).toBe(Math.round((5 + idealH(T(1), P)) * 1000) / 1000);
    expect(c.collision).toBe(false);
  });
  it('positive wear error: tip above programmed Z (shallow)', () => {
    const s = run([{ type: 'SET_OFFSET', n: 1, field: 'hWear', value: 0.06, mode: 'set' }], base);
    const c = g43Check(s, P, 1, -2);
    expect(c.lengthError).toBe(0.06);
    expect(c.actualTip).toBe(-1.94);
    expect(c.collision).toBe(false);
  });
  it('negative error: tip below programmed Z -> collision flagged at a clearance plane', () => {
    const s = run([{ type: 'SET_OFFSET', n: 1, field: 'hWear', value: -4, mode: 'set' }], base);
    const c = g43Check(s, P, 1, 2);
    expect(c.lengthError).toBe(-4);
    expect(c.actualTip).toBe(-2);
    expect(c.collision).toBe(true);
  });
  it('wrong H number (empty row) predicts a deep crash', () => {
    const c = g43Check(base, P, 2, 5);
    expect(c.lengthError).toBe(-idealH(T(1), P));
    expect(c.actualTip).toBeGreaterThan(0); // empty H = 0 -> stored too long (0 > negative ideal) -> tip far above
  });
  it('scene rings follow the check', () => {
    const t = sceneTransforms(base, P);
    expect(t.actualTipZ).toBeCloseTo(t.programmedTipZ, 6);
    expect(t.storedHEnd).toBeCloseTo(t.refZ, 6);
  });
});
