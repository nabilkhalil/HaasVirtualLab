import type { MachineProfile } from '../config/umc500';
import type { MachineState } from './machine';
import { g43Check, platterToWorld, toolPose } from './tools';
import { piece, pieceTop, trueWork } from './workholding';

/**
 * Pure mapping from machine state to 3D scene transforms (mm, Z-up machine frame).
 * Relative-motion approximation: tool moves in X/Y/Z, trunnion tilts B, platter rotates C.
 * Real axis-to-structure assignment, axis signs and pivot positions are UNVERIFIED.
 */
export function sceneTransforms(s: MachineState, p: MachineProfile) {
  const pose = toolPose(s, p);
  const [x, y] = pose.gaugeLine;
  const refZ = platterToWorld([0, 0, pieceTop(s, piece(s, 'A'))], s, p)[2];
  const datumZ = trueWork(s, p, s.activeWcs).datumZ;
  const chk = g43Check(s, p, s.check.h, s.check.z, s.check.d);
  const tipAtHome = p.geometry.gaugeLineAtZ0 - pose.length;
  return {
    gaugeLine: pose.gaugeLine,
    toolTip: [x, y, pose.tipZ] as [number, number, number],
    toolLength: pose.length,
    toolDiameter: pose.radius * 2,
    toolType: pose.tool?.type,
    bRad: (s.machine.B * Math.PI) / 180,
    cRad: (s.machine.C * Math.PI) / 180,
    /** Part-top reference plane height (scene frame). Plane is horizontal only at B = 0. */
    refZ,
    /** Tip height at machine Z0 and the stored H measured down from there (H visualisation). */
    tipAtHome,
    storedHEnd: tipAtHome + chk.storedH,
    idealHEnd: tipAtHome + chk.idealH,
    /** G43 check rings: programmed vs actual tip heights. */
    programmedTipZ: datumZ + chk.programmedTip,
    actualTipZ: datumZ + chk.actualTip,
    check: chk,
  };
}
export type SceneTransforms = ReturnType<typeof sceneTransforms>;
