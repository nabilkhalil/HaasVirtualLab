import type { ModuleProgress } from '../store/progressStore';

/** Sources (see references/haas.md): S1 Mill NGC manual 96-8210 Rev N (2020); S2 UMC supplement 96-8250 Rev L (2020);
 *  S3 UMC-500/SS layout drawing (2019 Rev 1); SIM = simplified educational model in this simulator. */
export interface QuizQ { q: string; options: string[]; answer: number; why: string; src: string }
export interface Module {
  id: string; title: string; available: boolean; unavailable?: string;
  outcomes: string[]; theory: string;
  demo: { text: string; lesson?: string };
  guided: string[]; practice: string | null; practical: string | null;
  quiz: QuizQ[];
}
const Q = (q: string, options: string[], answer: number, why: string, src: string): QuizQ => ({ q, options, answer, why, src });

export const MODULES: Module[] = [
  { id: 'M01', title: 'Machine familiarisation', available: true,
    outcomes: ['Name the five UMC-500 axes and what each moves', 'State the verified travels and B range', 'Explain the simulator limits and safety position'],
    theory: 'The UMC-500 moves the spindle in X, Y and Z (610 / 406 / 406 mm). The trunnion tilts the table on the B axis (−35° to +120°) about an axis parallel to Y, and the Ø400 mm platter rotates on the C axis. All values in this simulator are in mm and degrees. This is an offline educational simulator, not a Haas product, and never replaces supervised training.',
    demo: { text: 'Open the simulator, switch between iso/front/top/side views and jog B and C by small amounts. Watch which parts move.', lesson: 'F-A' },
    guided: ['F-A'], practice: 'F-A', practical: 'F-A',
    quiz: [
      Q('Which axis tilts the UMC-500 trunnion?', ['B', 'C', 'A'], 0, 'B tilts the trunnion; C turns the platter.', 'S2 3.3'),
      Q('UMC-500 B-axis travel (layout drawing)?', ['−35° to +120°', '−110° to +35°', '±180°'], 0, 'The layout drawing lists −35 min and +120 max.', 'S3 p.5'),
      Q('UMC-500 X-axis travel?', ['406 mm', '610 mm', '508 mm'], 1, 'X travel is 24.0 in / 610 mm.', 'S3 p.5'),
      Q('Does Haas Virtual Lab connect to a real machine?', ['Yes, through Ethernet', 'No — offline simulation only'], 1, 'It is an independent offline educational simulator.', 'SIM'),
    ] },
  { id: 'M02', title: 'Haas NGC controller operation', available: true,
    outcomes: ['Navigate the OFFSET display with cursor keys', 'Use F1 (set) and ENTER (add) correctly', 'Clear alarms with RESET after E-stop'],
    theory: 'On the NGC offsets display you highlight a cell with the cursor keys, type a value on the input line and press [F1] to set it or [ENTER] to add it to the current value. [F4] toggles the tool and work tabs. [RESET] clears alarms and input text; [CANCEL] deletes the last character typed.',
    demo: { text: 'Press OFFSET, move the cursor, type a number and compare F1 with ENTER. Press E-STOP, try to jog, then release and RESET.' },
    guided: ['C'], practice: 'B', practical: 'C',
    quiz: [
      Q('Type a value and press [F1] on the offsets page:', ['adds it to the current value', 'sets (replaces) the value', 'clears the column'], 1, '"press [F1] to set the value".', 'S1 p.170'),
      Q('Type a value and press [ENTER] on the offsets page:', ['adds it to the current value', 'sets the value', 'cancels input'], 0, '"press [ENTER] to add to the current value".', 'S1 p.170'),
      Q('What does [RESET] do?', ['Clears alarms and input text', 'Homes all axes', 'Turns off the spindle drive'], 0, 'Control pendant table: clears alarms, clears input text.', 'S1 p.38'),
      Q('[F4] on the offsets display:', ['toggles work / tool offset tabs', 'measures tool length', 'selects the next tool'], 0, '"Press [F4] to toggle from work to tool offset tab".', 'S1 p.170'),
    ] },
  { id: 'M03', title: 'Manual jogging and zero return', available: true,
    outcomes: ['Select axis and jog increment', 'Jog linear and rotary axes precisely', 'Return axes to machine zero safely'],
    theory: 'In HANDLE JOG choose an axis and an increment: [.0001/.1], [.001/1.], [.01/10.], [.1/100.] give 0.001, 0.01, 0.1 and 1 mm per click in metric. [ZERO RETURN] then [ALL] returns all axes; an axis letter plus [SINGLE] returns one. Retract Z before large rotary moves so the part cannot sweep into the tool.',
    demo: { text: 'Jog X with each increment and watch the POSITION display. Press ZERO RETURN, select Z and press SINGLE.' },
    guided: ['F-B'], practice: 'F-I', practical: 'F-I',
    quiz: [
      Q('Metric value of one click on [.0001/.1]?', ['0.0001 mm', '0.001 mm', '0.1 mm'], 1, 'Jog table: .0001 key = .001 mm per click in metric.', 'S1 settings jog table'),
      Q('Return one axis to machine zero:', ['[ZERO RETURN], axis letter, [SINGLE]', '[HANDLE JOG] then [ALL]', '[ORIGIN]'], 0, '[SINGLE] returns one axis after choosing its letter.', 'S1 p.43'),
      Q('Before a large B rotation with a long tool near the part:', ['retract Z first', 'choose a bigger increment', 'press F1'], 0, 'Retract to give clearance for rotary motion.', 'S2 5.1'),
      Q('MACHINE position at home is:', ['0 on each axis', 'the travel maximum', 'undefined'], 0, 'MACHINE shows positions relative to machine zero.', 'S1 T2.22'),
    ] },
  { id: 'M04', title: 'Workholding and stock preparation', available: true,
    outcomes: ['Set stock size and parallels', 'Align and clamp the workpiece', 'Recognise fixture interference'],
    theory: 'Place the material in the vise and tighten it before setting offsets (S1). Parallels lift the part above the jaws so tools and edge finders can reach it. Move or resize a part only while unclamped, square it to the axes, clamp it, then re-measure datums. The simulator flags overhang, overlap and low parts.',
    demo: { text: 'Open SETUP, unclamp workpiece A, try the parallels and size controls, click the part in 3D for the move/align toolbar.' },
    guided: ['W-0'], practice: 'W-0', practical: 'W-0',
    quiz: [
      Q('Why use parallels under a part in a vice?', ['raise it above the jaws for tool clearance', 'align the C axis', 'set tool length'], 0, 'The part must stand clear of the jaws.', 'SIM'),
      Q('When may a workpiece be moved on its fixture?', ['only unclamped, then re-measure datums', 'any time', 'only during E-stop'], 0, 'Moving a clamped part loses the setup.', 'SIM'),
      Q('A part 0.5° out of square mainly affects:', ['X/Y datum accuracy along its edges', 'spindle speed', 'tool length'], 0, 'Edges are no longer parallel to X/Y.', 'SIM'),
      Q('First step of "Set a Work Offset" in the Haas manual:', ['Place the material in the vise and tighten', 'Probe the MRZP', 'Change Setting 142'], 0, 'Step 1 of the procedure.', 'S1 p.171'),
    ] },
  { id: 'M05', title: 'Tool length and diameter offsets', available: true,
    outcomes: ['Touch off tools on the part top', 'Read and correct H and D geometry/wear', 'Predict the effect of wrong H values'],
    theory: 'Haas tool length offset is "measured from the tip of the tool to the top of the part" with Z at home. Highlight H GEOM for the tool and press [TOOL OFFSET MEASURE]; with Setting 64 OFF the offset equals the Z machine position. With G43, a stored H that is too long leaves the tip high (shallow); too short drives it low (gouge).',
    demo: { text: 'Load T1, open OFFSET, jog over the part, watch the paper indicator change from FREE to DRAGS.' },
    guided: ['A'], practice: 'B', practical: 'E',
    quiz: [
      Q('Setting 64 OFF: [TOOL OFFSET MEASURE] stores', ['the Z machine position', 'the gauge-line tool length', 'zero'], 0, '"When it is OFF, the tool offset equals the Z machine position."', 'S1 Setting 64'),
      Q('Stored H too long (less negative) than correct:', ['tip stops above programmed Z (shallow)', 'tip goes below programmed Z (gouge)'], 0, 'Machine Z = Z + H; a larger H keeps the tool higher.', 'SIM'),
      Q('Pocket cut 0.06 mm too shallow — length wear:', ['−0.06', '+0.06', '0'], 0, 'The tool must go lower: make H more negative.', 'SIM'),
      Q('Tilt axis position when touching off tools on a UMC:', ['0°', '90°', '−35°'], 0, '"make sure the tilt axis is at 0 degrees".', 'S1 p.168'),
    ] },
  { id: 'M06', title: 'Work offsets G54–G59', available: true,
    outcomes: ['Record X/Y with PART ZERO SET', 'Apply edge finder radius correction', 'Use one offset per workpiece'],
    theory: '[PART ZERO SET] stores the current machine position in the highlighted work offset cell; press it again for Y. Do not press it a third time (loads Z). X/Y offsets are negative from machine zero. With an edge finder, add or subtract the tip radius. With tool lengths measured to the part top, leave Z work offsets at zero.',
    demo: { text: 'Open OFFSET, press F4 for WORK, jog the pointer to a corner and press PART ZERO SET twice.' },
    guided: ['W-A', 'W-C'], practice: 'W-B', practical: 'W-E',
    quiz: [
      Q('[PART ZERO SET] stores', ['the current machine position in the highlighted cell', 'the tool length', 'the active WCS'], 0, '"the current machine position is automatically stored".', 'S1 6.12.4'),
      Q('X/Y work offsets are', ['negative values from machine zero', 'always positive', 'incremental'], 0, '"always given as negative values from machine zero".', 'S1 6.12.4'),
      Q('Ø6 edge finder from −X kicks at X−358.000. Edge X =', ['−355.000', '−361.000', '−358.000'], 0, 'Approaching from −X, the edge is contact + radius.', 'SIM'),
      Q('With tool lengths measured to the part top, G54 Z should be', ['0', 'the part-top machine Z', 'the tool length'], 0, 'Non-zero Z work offsets interfere and can crash.', 'S1 6.12.4'),
    ] },
  { id: 'M07', title: 'WIPS automatic probing', available: false, unavailable: 'Phase 4 (WIPS) is not implemented: installed probing equipment and documentation must be verified first (CLAUDE.md).',
    outcomes: ['Calibrate and use the WIPS tool setter and work probe'], theory: 'Not available in this release.', demo: { text: '' }, guided: [], practice: null, practical: null, quiz: [] },
  { id: 'M08', title: 'Coordinate systems', available: true,
    outcomes: ['Distinguish machine, work, programmed and actual tip coordinates', 'Combine H and work Z correctly', 'Explain coordinates after rotation'],
    theory: 'MACHINE positions are relative to machine zero; WORK (G54) positions are relative to part zero. A programme position becomes machine Z = programmed Z + work Z + H. The physical datum and the stored offset are different things: compare them before running.',
    demo: { text: 'Turn on the calculations checkbox in the coordinate panel and jog X/Y/Z while watching every line update.' },
    guided: ['F-C'], practice: 'W-F', practical: 'W-G',
    quiz: [
      Q('WORK (G54) position is relative to', ['part zero', 'the distance jogged', 'machine zero'], 0, 'T2.22: "relative to part zero".', 'S1 T2.22'),
      Q('Work Z −297 and H −297 for "G43 H01 Z5." results in', ['double application: crash / over travel', 'a correct position', 'a shallow cut'], 0, 'The part top is applied twice.', 'S1 6.12.4'),
      Q('After rotating C 90° without DWO, the WORK display', ['does not change (no linear motion)', 'rotates with the part'], 0, 'WORK = machine − offset; nothing linear moved.', 'SIM'),
      Q('MACHINE position is relative to', ['machine zero', 'part zero', 'the tool tip'], 0, 'T2.22: "relative to machine zero".', 'S1 T2.22'),
    ] },
  { id: 'M09', title: 'Five-axis setup and MRZP', available: true,
    outcomes: ['Explain the Machine Rotary Zero Point', 'Run the simulated sphere calibration', 'Relate MRZP errors to tip errors'],
    theory: 'MRZP settings 255, 256 and 257 locate the rotary centres relative to the linear home positions: 255 the B centre in X, 256 the C centre in Y, 257 the B centre in Z. They are set at the factory and used by DWO and TCPC. An error has no effect at B0 C0 and grows with rotation. Values here are simulated, never the machine\'s.',
    demo: { text: 'In 5-AXIS, mount the sphere, set a calibration error of 1 mm and watch the dashed controller MRZP line move.' },
    guided: ['F-D'], practice: 'F-E', practical: 'F-E',
    quiz: [
      Q('MRZP settings are', ['255, 256, 257', '40, 64, 142', '54–59'], 0, 'UMC supplement 3.3.', 'S2 3.3'),
      Q('Setting 256 locates', ['the C-axis centre in Y', 'the B-axis centre in Z', 'tool length'], 0, '"256 – Location of the C Axis rotary center point relative to the Y Axis home".', 'S2 3.3'),
      Q('Initial MRZP values are set by', ['the factory', 'the operator each day', 'G254'], 0, '"set at the factory".', 'S2 3.3'),
      Q('An MRZP error causes position error mainly', ['when rotary axes are away from zero', 'equally at all angles', 'only at B0 C0'], 0, 'The error rotates with the axes.', 'SIM'),
    ] },
  { id: 'M10', title: 'DWO and TCPC', available: true,
    outcomes: ['Use G254/G255 for 3+2 positioning', 'Explain G234 TCPC for simultaneous motion', 'Apply Haas compatibility rules'],
    theory: 'G254 (DWO) is for 3+1/3+2 positioning: command it after the work offset and after rotary positioning; the B work offset must be zero; cancel with G255 before any rotary motion. G234 (TCPC) is for simultaneous motion, cancels G43 and needs the H-code on the same block. G234 and G254 cannot be active together. HANDLE JOG, RESET and E-STOP cancel both.',
    demo: { text: 'In 5-AXIS, rotate to B30 C90, move to X0 Y0 Z10 with G43 only, then with G254. Animate TCPC on and off.' },
    guided: ['F-F'], practice: 'F-G', practical: 'F-H',
    quiz: [
      Q('G254 is intended for', ['3+1 / 3+2 positioning', 'simultaneous 5-axis contouring'], 0, 'DWO "is designed for use with 3+1 or 3+2 positioning".', 'S2 5.1'),
      Q('With G254 the B value of the work offset must be', ['zero', 'the current B', '90'], 0, '"MUST be zero".', 'S2 5.1'),
      Q('Can G234 and G254 be active together?', ['No', 'Yes'], 0, '"G234 cannot be used at the same time as G254".', 'S2 4.1'),
      Q('Which key cancels both G254 and G234?', ['[HANDLE JOG]', '[F1]', '[PART ZERO SET]'], 0, 'Listed in both programmer\'s notes.', 'S2 4.1/5.1'),
    ] },
  { id: 'M11', title: 'G-code and program verification', available: false, unavailable: 'Phase 6 (G-code parser, MDI/MEMORY, graphics, single block) is not implemented yet.',
    outcomes: ['Verify supported programs in graphics and single block'], theory: 'Not available in this release.', demo: { text: '' }, guided: [], practice: null, practical: null, quiz: [] },
  { id: 'M12', title: 'Complete machining workflow', available: false, unavailable: 'Needs program execution (Phase 6) to complete the setup-to-cut workflow.',
    outcomes: ['Perform a complete setup and verified program run'], theory: 'Not available in this release.', demo: { text: '' }, guided: [], practice: null, practical: null, quiz: [] },
];

export const PASS = 0.8;
export type StepKey = 'guided' | 'practice' | 'quiz' | 'practical';
export type ModuleStatus = 'unavailable' | 'not started' | 'in progress' | 'complete';
/** Completion: all guided exercises done, practice attempted, knowledge quiz ≥ 80 %, practical assessment ≥ 80 %. */
export function moduleStatus(m: Module, p?: ModuleProgress): { status: ModuleStatus; steps: Record<StepKey, boolean> } {
  const ok = (r?: { score: number; max: number }) => !!r && r.max > 0 && r.score / r.max >= PASS;
  const steps = { guided: !!p && m.guided.every((g) => p.guided.includes(g)), practice: !!p?.practice, quiz: ok(p?.quiz), practical: ok(p?.practical) };
  if (!m.available) return { status: 'unavailable', steps };
  const n = Object.values(steps).filter(Boolean).length;
  return { status: n === 4 ? 'complete' : n || p?.quiz || p?.practical ? 'in progress' : 'not started', steps };
}
export const moduleOfLesson = (lessonId: string) => MODULES.find((m) => m.guided.includes(lessonId) || m.practice === lessonId || m.practical === lessonId);
export const lessonsOf = (m: Module) => [...new Set([...m.guided, m.practice, m.practical].filter(Boolean) as string[])];
export function scoreQuiz(m: Module, answers: number[]) {
  return { score: m.quiz.filter((q, i) => answers[i] === q.answer).length, max: m.quiz.length };
}
