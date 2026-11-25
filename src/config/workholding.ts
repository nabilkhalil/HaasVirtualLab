/** Workholding and measuring-aid defaults (illustrative geometry, platter frame mm, origin = platter top centre). */
export type PieceId = 'A' | 'B';
export type DatumType = 'TFL' | 'TFR' | 'TC' | 'BC' | 'CUSTOM';
export const DATUM_LABEL: Record<DatumType, string> = {
  TFL: 'Top front-left corner', TFR: 'Top front-right corner', TC: 'Top centre', BC: 'Bottom centre', CUSTOM: 'Custom (from top front-left)',
};
export const WCS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'] as const;
export type Wcs = (typeof WCS)[number];
export const WORK_AXES = ['X', 'Y', 'Z', 'B', 'C'] as const;
export type WorkAxis = (typeof WORK_AXES)[number];

export interface Workpiece {
  id: PieceId; present: boolean; mount: 'vice' | 'platter';
  /** L (X), W (Y), H (Z) */
  size: [number, number, number];
  /** Centre position on the platter (x, y). Vice pieces are centred between the jaws (y = 0). */
  pos: [number, number];
  /** Misalignment about Z in degrees (0 = square to X). */
  yaw: number;
  clamped: boolean;
}
export interface DatumSel { type: DatumType; custom: [number, number, number] }
export interface Setup {
  pieces: Workpiece[];
  parallels: boolean;
  touch: 'paper' | 'block';
  gaugeBlock: number;
  /** Which physical workpiece and datum each work offset is meant for (truth for warnings and scoring). */
  wcsPiece: Record<Wcs, PieceId>;
  wcsDatum: Record<Wcs, DatumSel>;
  /** Simulated MRZP calibration sphere mounted on the platter. */
  sphere: boolean;
}

/** Vice centred on the platter, jaws along X; fixed jaw at +Y, moving jaw at -Y. */
export const VICE = { base: [220, 120, 40] as [number, number, number], jawHeight: 55, jawThick: 20, parallelHeight: 20, parallelThick: 8, openGap: 10 };
export const CLAMP = { size: [20, 30, 12] as [number, number, number], overlap: 10 };
export const EDGE_TIP_LENGTH = 12;
export const LIMITS = { L: [20, 200], W: [20, 100], H: [10, 100], gauge: [1, 100] } as const;

function TFL(): DatumSel { return { type: 'TFL', custom: [0, 0, 0] }; }
export const DEFAULT_SETUP: Setup = {
  pieces: [
    { id: 'A', present: true, mount: 'vice', size: [100, 80, 50], pos: [0, 0], yaw: 0, clamped: true },
    { id: 'B', present: true, mount: 'platter', size: [80, 50, 30], pos: [0, -150], yaw: 0, clamped: true },
  ],
  parallels: true, touch: 'paper', gaugeBlock: 25, sphere: false,
  wcsPiece: { G54: 'A', G55: 'B', G56: 'A', G57: 'A', G58: 'A', G59: 'A' },
  wcsDatum: { G54: TFL(), G55: TFL(), G56: { type: 'TC', custom: [0, 0, 0] }, G57: TFL(), G58: TFL(), G59: TFL() },
};
/** Default top of workpiece A (vice base + parallels + height) = 110 mm. */
export const DEFAULT_A_TOP = VICE.base[2] + VICE.parallelHeight + DEFAULT_SETUP.pieces[0].size[2];
