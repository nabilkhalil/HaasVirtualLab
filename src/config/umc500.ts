import { DEFAULT_A_TOP } from './workholding';
/**
 * UMC-500 machine profile. All lengths in mm, angles in degrees.
 * Travels, B range, platter size and Z clearance VERIFIED against the UMC-500/SS Machine Layout Drawing (S3, 2019 Rev 1).
 * B axis parallel to Y per MRZP settings 255-257 (S2). Lab machine calibration (MRZP) is NOT known.
 * See references/haas.md. Do not claim fidelity until verified.
 */
export type LinearAxis = 'X' | 'Y' | 'Z';
export type RotaryAxis = 'B' | 'C';
export type Axis = LinearAxis | RotaryAxis;
export const AXES: Axis[] = ['X', 'Y', 'Z', 'B', 'C'];

export interface AxisLimit { min: number; max: number; continuous?: boolean }
/** Axis-aligned box in the platter frame (origin = platter top centre, Z up). */
export interface Box { center: [number, number, number]; size: [number, number, number] }

export interface MachineProfile {
  name: string;
  verified: boolean;
  limits: Record<Axis, AxisLimit>;
  /** Jog increments in mm (linear) / deg (rotary), metric mode. Verified vs S1 jog table. */
  jogIncrements: number[];
  atcPockets: number; // UNVERIFIED
  /** Approximate scene geometry (mm). Not calibrated. */
  geometry: {
    gaugeLineAtZ0: number;   // spindle-to-table clearance at Z0, B0 (S3: 508 mm); gauge line taken as spindle nose
    xAtCentre: number;       // machine X placing the spindle over platter centre (approx.)
    yAtCentre: number;
    platterDiameter: number;
    trunnionPivotBelowPlatter: number; // UNVERIFIED
    bTiltAxis: 'X' | 'Y';             // 'Y' per S2 MRZP definitions; positive sense UNVERIFIED
  };
  /** Simulator settings mirroring Haas settings (values are simulator choices). */
  settings: { s40: 'DIAMETER' | 'RADIUS'; s64: boolean; s142: number };
  paperThickness: number;
}

export const UMC500: MachineProfile = {
  name: 'Haas UMC-500 (S3 travels; calibration simulated)',
  verified: false, // travels verified; MRZP/pivot depth/axis sense not
  limits: {
    X: { min: -610, max: 0 }, Y: { min: -406, max: 0 }, Z: { min: -406, max: 0 },
    B: { min: -35, max: 120 }, C: { min: 0, max: 360, continuous: true },
  },
  jogIncrements: [0.001, 0.01, 0.1, 1],
  atcPockets: 30,
  geometry: {
    gaugeLineAtZ0: 508,
    xAtCentre: -305,
    yAtCentre: -203,
    platterDiameter: 400,
    trunnionPivotBelowPlatter: 0,
    bTiltAxis: 'Y',
  },
  settings: { s40: 'DIAMETER', s64: false, s142: 10 },
  paperThickness: 0.1,
};

/** Default workpiece A top (H reference plane in Phase 2 lessons). */
export const stockTop = (_p?: MachineProfile) => DEFAULT_A_TOP;
