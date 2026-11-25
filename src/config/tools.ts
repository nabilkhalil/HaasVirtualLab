/**
 * Simulated PHYSICAL tools ("truth"). length = spindle gauge line to tool tip (mm).
 * Never read these to compute stored offsets; stored offsets live in the offset table.
 * Values are illustrative and editable in the instructor tool setup.
 */
export type ToolType = 'Shell Mill' | 'End Mill' | 'Ball Nose' | 'Drill' | 'Spot Drill' | 'Probe' | 'Edge Finder' | 'Pointer';
/** Haas Tool Type options (S1). Simulator-only types display as None. */
export const HAAS_TYPES: ToolType[] = ['Shell Mill', 'End Mill', 'Ball Nose', 'Drill', 'Spot Drill', 'Probe'];
export interface PhysicalTool {
  number: number; name: string; type: ToolType; diameter: number; length: number; holder: string; pocket: number;
}

export const DEFAULT_TOOLS: PhysicalTool[] = [
  { number: 1, name: '50 mm face mill', type: 'Shell Mill', diameter: 50, length: 92.417, holder: '40-taper shell mill arbor', pocket: 1 },
  { number: 2, name: '12 mm flat end mill', type: 'End Mill', diameter: 12, length: 104.862, holder: '40-taper end mill holder', pocket: 2 },
  { number: 3, name: '10 mm ball nose end mill', type: 'Ball Nose', diameter: 10, length: 112.588, holder: '40-taper ER32 collet', pocket: 3 },
  { number: 4, name: '8.5 mm drill', type: 'Drill', diameter: 8.5, length: 131.046, holder: '40-taper ER32 collet', pocket: 4 },
  { number: 5, name: 'Spindle probe (6 mm stylus)', type: 'Probe', diameter: 6, length: 120.0, holder: 'Probe shank', pocket: 5 },
  { number: 6, name: 'Mechanical edge finder (tip Ø)', type: 'Edge Finder', diameter: 6, length: 85.0, holder: '40-taper collet, 10 mm shank', pocket: 6 },
  { number: 7, name: 'Pointer (centre finder)', type: 'Pointer', diameter: 1, length: 100.0, holder: '40-taper collet', pocket: 7 },
];

/** S1: "There is a maximum of 200 tool offsets available." */
export const OFFSET_ROWS = 200;
/** Simulator validation ranges (not Haas limits). Length geometry is negative under Setting 64 OFF. */
export const OFFSET_RANGES = {
  hGeom: { min: -406, max: 0 }, hWear: { min: -5, max: 5 },
  dGeom: { min: 0, max: 100 }, dWear: { min: -5, max: 5 },
} as const;
export type OffsetField = keyof typeof OFFSET_RANGES;
export const OFFSET_COLS: OffsetField[] = ['hGeom', 'hWear', 'dGeom', 'dWear'];
export const TOOL_LIMITS = { length: { min: 20, max: 300 }, diameter: { min: 0.5, max: 125 } };
