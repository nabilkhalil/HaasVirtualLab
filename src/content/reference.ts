/**
 * Reference library: only facts already recorded in references/haas.md, src/config/umc500.ts and the implemented
 * engine are listed here. Anything unverified is marked as such instead of being presented as machine truth.
 */
export interface Source { id: 'S1' | 'S2' | 'S3'; title: string; doc: string; used: string }
export const SOURCES: Source[] = [
  { id: 'S1', title: "Haas Mill Operator's Manual, NGC", doc: '96-8210 Revision N (2020)', used: 'Control keys, jog increments, tool and work offset pages, tool setting cautions' },
  { id: 'S2', title: 'Haas UMC supplement / rotary and MRZP rules', doc: '96-8250 Revision L', used: 'B/C limits, MRZP, DWO (G254) and TCPC (G234) rules, zero-return order' },
  { id: 'S3', title: 'UMC-500 layout drawing', doc: '2019, Revision 1', used: 'Travels X610 / Y406 / Z406, platter Ø400, 508 mm spindle-table clearance' },
];

export interface RefRow { name: string; value: string; source: 'S1' | 'S2' | 'S3' | 'sim' }
export const KEY_ROWS: RefRow[] = [
  { name: 'RESET', value: 'Clears alarms and the input line; resets overrides when Setting 88 is ON.', source: 'S1' },
  { name: 'OFFSET', value: 'Opens the tool/work offset tabbed display (F1 tool, F4 work).', source: 'S1' },
  { name: 'TOOL OFFSET MEASURE', value: 'Writes the machine position into the highlighted length offset.', source: 'S1' },
  { name: 'NEXT TOOL', value: 'Selects the next tool from the changer.', source: 'S1' },
  { name: 'ORIGIN', value: 'Sets the selected offset value to zero.', source: 'S1' },
  { name: 'CANCEL', value: 'Deletes the last character typed.', source: 'S1' },
  { name: 'ENTER', value: 'Answers prompts and writes the input value.', source: 'S1' },
  { name: 'F1 / ENTER on an offset cell', value: 'F1 sets the value; ENTER adds to the current value.', source: 'S1' },
  { name: 'HANDLE JOG', value: 'Jog mode; also cancels G254/G234 before manual motion.', source: 'S1' },
  { name: 'Zero return (Z, then X/Y, then B/C)', value: 'Order used by the simulator for SETUP:ZERO.', source: 'S2' },
];

export const INCREMENT_ROWS: RefRow[] = [
  { name: 'Inch', value: '.0001 / .001 / .01 / .1 in per handle click', source: 'S1' },
  { name: 'Metric', value: '.001 / .01 / .1 / 1 mm per handle click (simulator uses mm)', source: 'S1' },
  { name: 'Machine travel', value: 'X 610 mm · Y 406 mm · Z 406 mm (machine coordinates run negative from home)', source: 'S3' },
  { name: 'B axis', value: '−35° to +120° (platter tilt)', source: 'S3' },
  { name: 'C axis', value: 'Continuous platter rotation (360°)', source: 'S3' },
  { name: 'Platter', value: 'Ø400 mm, 508 mm spindle-to-table clearance at B0', source: 'S3' },
];

export const CODE_ROWS: RefRow[] = [
  { name: 'G00 B… C…', value: 'Simulated rotary positioning on the 5-AXIS tab (no linear interpolation).', source: 'sim' },
  { name: 'G254', value: 'DWO (dynamic work offset) — positions are recalculated after rotation.', source: 'S2' },
  { name: 'G255', value: 'Cancels DWO. Required before any rotary motion; G254 again after positioning.', source: 'S2' },
  { name: 'G234 H…', value: 'TCPC (simultaneous rotary + linear); the H-code must be on the same block.', source: 'S2' },
  { name: 'G43 H…', value: 'Applies the tool length offset for the given H number.', source: 'S1' },
];

export interface Term { term: string; def: string }
export const GLOSSARY: Term[] = [
  { term: 'MRZP', def: 'Machine rotary zero point: the controller’s stored pivot of the trunnion, used by DWO and TCPC.' },
  { term: 'DWO (G254)', def: 'Dynamic work offset: keeps the programmed work position correct after the rotary axes move.' },
  { term: 'TCPC (G234)', def: 'Tool centre point control: keeps the tool tip on the programmed path during simultaneous motion.' },
  { term: 'G54–G59', def: 'Work offsets: the stored distance from machine zero to the part datum.' },
  { term: 'H offset', def: 'Tool length (geometry and wear) applied by G43 H.' },
  { term: 'D offset', def: 'Tool diameter (geometry and wear) applied by cutter compensation.' },
  { term: 'Gauge line', def: 'Spindle reference plane that tool length is measured from; treated as the spindle nose here.' },
  { term: 'Reference tool', def: 'A tool used to establish the Z datum so other tools are measured against it.' },
  { term: '3+2', def: 'Positioning two rotary axes, then machining in the resulting fixed orientation (not simultaneous).' },
];

export const UNVERIFIED = [
  'Lab NGC software version and the real MRZP values are unknown; MRZP is simulated.',
  'B/C positive sense, B pivot depth (0), the X0 side of the 356/254 X split and “gauge line = spindle nose” are assumptions.',
  'Collision envelopes are boxes; the spindle head shape is illustrative.',
  'WIPS probing (Phase 4) and G-code program execution (Phase 6) are not implemented.',
];
