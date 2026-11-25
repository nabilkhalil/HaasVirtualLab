import { describe, expect, it } from 'vitest';
import { UMC500 } from '../../src/config/umc500';
import { initialState, reduce, type Action, type MachineState } from '../../src/engine/machine';
import { sceneTransforms } from '../../src/engine/sceneTransforms';
import { DEFAULT_TOOLS } from '../../src/config/tools';

const run = (acts: Action[], s: MachineState = initialState(UMC500)) => acts.reduce((st, a) => reduce(st, a, UMC500), s);

describe('machine state', () => {
  it('starts at machine zero in handle jog', () => {
    const s = initialState(UMC500);
    expect(s.mode).toBe('HANDLE_JOG');
    expect(Object.values(s.machine).every((v) => v === 0)).toBe(true);
  });

  it('jogs selected axis by increment without float drift', () => {
    const s = run([
      { type: 'SELECT_AXIS', axis: 'Y' }, { type: 'SET_INCREMENT', increment: 0.001 },
      ...Array(10).fill({ type: 'JOG', direction: -1 }),
    ]);
    expect(s.machine.Y).toBe(-0.01);
    expect(s.machine.X).toBe(0);
  });

  it('rejects unsupported increment', () => {
    const s = run([{ type: 'SET_INCREMENT', increment: 5 }]);
    expect(s.jogIncrement).toBe(0.1);
    expect(s.message).toMatch(/Unsupported/);
  });

  it('enforces linear travel limits without moving', () => {
    const s = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'Z', direction: 1 }]);
    expect(s.machine.Z).toBe(0);
    expect(s.message).toMatch(/Travel limit/);
    const t = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'X', direction: -1, steps: 611 }]);
    expect(t.machine.X).toBe(0);
    const u = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'X', direction: -1, steps: 610 }]);
    expect(u.machine.X).toBe(-610);
  });

  it('enforces B limits and wraps C', () => {
    const s = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'B', direction: 1, steps: 121 }]);
    expect(s.machine.B).toBe(0);
    const c = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'C', direction: -1, steps: 1 }]);
    expect(c.machine.C).toBe(359);
    const c2 = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'C', direction: 1, steps: 361 }]);
    expect(c2.machine.C).toBe(1);
  });

  it('E-stop blocks motion; RESET requires release and clears alarm', () => {
    let s = run([{ type: 'ESTOP_PRESS' }, { type: 'JOG', axis: 'X', direction: -1 }]);
    expect(s.machine.X).toBe(0);
    expect(s.alarms).toHaveLength(1);
    s = run([{ type: 'RESET' }], s);
    expect(s.alarms).toHaveLength(1);
    s = run([{ type: 'ESTOP_RELEASE' }, { type: 'JOG', axis: 'X', direction: -1 }], s);
    expect(s.machine.X).toBe(0); // alarm still active
    s = run([{ type: 'RESET' }, { type: 'JOG', axis: 'X', direction: -1 }], s);
    expect(s.alarms).toHaveLength(0);
    expect(s.machine.X).toBe(-0.1);
  });

  it('repeated E-stop press does not duplicate alarm', () => {
    expect(run([{ type: 'ESTOP_PRESS' }, { type: 'ESTOP_PRESS' }]).alarms).toHaveLength(1);
  });
});

describe('scene sync', () => {
  it('maps machine state to tool and rotary transforms', () => {
    const g = UMC500.geometry;
    const s = run([{ type: 'SET_INCREMENT', increment: 1 },
      { type: 'JOG', axis: 'X', direction: -1, steps: 305 }, { type: 'JOG', axis: 'Z', direction: -1, steps: 100 },
      { type: 'JOG', axis: 'C', direction: 1, steps: 90 }, { type: 'JOG', axis: 'B', direction: -1, steps: 30 }]);
    const t = sceneTransforms(s, UMC500);
    expect(t.gaugeLine[0]).toBe(0);
    expect(t.gaugeLine[2]).toBe(g.gaugeLineAtZ0 - 100);
    expect(t.toolTip[2]).toBeCloseTo(g.gaugeLineAtZ0 - 100 - DEFAULT_TOOLS[0].length, 3);
    expect(t.cRad).toBeCloseTo(Math.PI / 2);
    expect(t.bRad).toBeCloseTo(-Math.PI / 6);
  });

  it('tool tip stays above platter top at Z minimum (approximate geometry)', () => {
    const s = run([{ type: 'SET_INCREMENT', increment: 1 }, { type: 'JOG', axis: 'Z', direction: -1, steps: 406 }]);
    expect(sceneTransforms(s, UMC500).toolTip[2]).toBeGreaterThan(0);
  });
});
