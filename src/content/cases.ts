/**
 * Case studies: synthetic industrial scenarios built only from lessons and controls the simulator actually has.
 * Titles, scenarios and objectives are translated in i18n/*.json (case.<id>.title|scenario|objectives); the
 * procedure, acceptance checks and pitfalls stay in English as technical procedure text.
 */
export type CaseLevel = 'beginner' | 'intermediate' | 'advanced';
export interface CaseStep { text: string; lesson?: string; module?: string }
export interface CaseStudy {
  id: string;
  minutes: number;
  level: CaseLevel;
  title: string;
  scenario: string;
  objectives: string[];
  steps: CaseStep[];
  checks: string[];
  pitfalls: string[];
  modules: string[];
  sources: ('S1' | 'S2' | 'S3')[];
}

export const CASES: CaseStudy[] = [
  {
    id: 'CS-1',
    minutes: 25,
    level: 'beginner',
    title: 'First plate in a vice',
    scenario:
      'A 80 × 60 × 20 mm aluminium plate must be set up with G54 at the top-left corner. The tools are already in the library and nothing is clamped yet.',
    objectives: [
      'Seat the plate on parallels and clamp it without tilting the datum',
      'Touch off X, Y and Z for G54 with the mounted tool',
      'Prove the datum with a clearance move before any cutting',
    ],
    steps: [
      { text: 'Load T3 (Ø10 end mill) and confirm the active tool on the controller.', module: 'M05' },
      { text: 'Clamp workpiece A on parallels in the vice and read the setup warnings.', lesson: 'W-0', module: 'M04' },
      { text: 'Touch the top-left corner and set G54 X, Y and Z.', lesson: 'W-A', module: 'M06' },
      { text: 'HANDLE JOG in 1 mm increments to X0 Y0 Z10 and confirm the displayed position.', module: 'M03' },
    ],
    checks: [
      'The setup panel reports no unclamped or interference warning',
      'G54 X and Y agree with the touched corner at the displayed resolution',
      'Z reads 10.000 at the clearance point, with no collision or alarm',
    ],
    pitfalls: [
      'Clamping without parallels lifts the plate and tilts the datum',
      'Setting Z before X/Y forces a re-touch after the final clamp',
    ],
    modules: ['M04', 'M05', 'M06'],
    sources: ['S1', 'S2'],
  },
  {
    id: 'CS-2',
    minutes: 30,
    level: 'beginner',
    title: 'Centre datum with an edge finder',
    scenario:
      'A 100 mm round bar sits in the vice and the drawing dimensions everything from its centre. The datum must be the bar centre, not an edge.',
    objectives: [
      'Find X and Y with the edge finder and apply the radius correction once',
      'Set Z on the top face with a gauge block for the reference tool',
      'Confirm the centre datum from both directions',
    ],
    steps: [
      { text: 'Clamp workpiece A and fit the edge finder before any measurement.', lesson: 'W-0', module: 'M04' },
      { text: 'Touch X and Y from opposite sides and set G54 at the bar centre.', lesson: 'W-B', module: 'M06' },
      { text: 'Set G54 Z with the gauge block and reference tool.', lesson: 'W-D', module: 'M05' },
      { text: 'Re-touch the second side and verify the centre does not move.', lesson: 'W-C', module: 'M06' },
    ],
    checks: [
      'Both edge-finder contacts give the same centre within the displayed resolution',
      'The radius correction is applied exactly once',
      'Z equals the gauge-block height above the top face',
    ],
    pitfalls: [
      'Forgetting the edge-finder radius doubles the error on every axis',
      'Measuring Y while the bar can rotate gives an intermittent contact',
    ],
    modules: ['M05', 'M06'],
    sources: ['S1'],
  },
  {
    id: 'CS-3',
    minutes: 35,
    level: 'intermediate',
    title: 'Two parts, two offsets',
    scenario:
      'Two identical blanks sit side by side on the platter. The job needs G54 for part A and G55 for part B, without disturbing either setup.',
    objectives: [
      'Build two independent work offsets from measured positions',
      'Switch between G54 and G55 and read the resulting coordinates',
      'Show that setting one offset leaves the other untouched',
    ],
    steps: [
      { text: 'Clamp both workpieces and confirm the setup is complete.', lesson: 'W-0', module: 'M04' },
      { text: 'Measure part A and store G54, then measure part B into G55.', lesson: 'W-E', module: 'M06' },
      { text: 'Switch the active WCS and compare the WORK display with the machine position.', module: 'M08' },
      { text: 'Re-open OFFSET, F4 and confirm both offset sets are unchanged.', module: 'M02' },
    ],
    checks: [
      'Both offsets exist and differ by the physical spacing of the blanks',
      'Switching WCS changes the coordinate display, not the machine position',
      'PART ZERO SET into G55 leaves G54 exactly as measured',
    ],
    pitfalls: [
      'Measuring the second part while the first offset is active overwrites the wrong column',
      'Assuming the active WCS after a restart instead of reading the display',
    ],
    modules: ['M06', 'M08'],
    sources: ['S1', 'S2'],
  },
  {
    id: 'CS-4',
    minutes: 45,
    level: 'advanced',
    title: '3+2 bracket on the trunnion',
    scenario:
      'A bracket needs three faces machined. It is clamped on the platter and positioned with B45 C120 for the first face, then re-oriented for the others.',
    objectives: [
      'Rotate to a 3+2 orientation without sweeping the part through the vice',
      'Position with DWO active and explain what DWO changes',
      'Cancel the rotary mode correctly before jogging',
    ],
    steps: [
      { text: 'Zero return Z, then X/Y, before any rotary motion.', lesson: 'F-B', module: 'M09' },
      { text: 'Position at B45 C120 and read the work coordinates after rotation.', lesson: 'F-C', module: 'M08' },
      { text: 'Activate G254 and position again; compare with the un-compensated result.', lesson: 'F-F', module: 'M10' },
      { text: 'Press HANDLE JOG and observe that G254 is cancelled before jogging.', lesson: 'F-A', module: 'M09' },
    ],
    checks: [
      'No collision is reported during the rotation (Z retracted first)',
      'DWO is active before the second positioning move',
      'The controller shows the DWO cancellation after HANDLE JOG',
    ],
    pitfalls: [
      'Rotating with Z down sweeps the part through the fixture',
      'Issuing G234 without the H-code on the same block is rejected',
    ],
    modules: ['M08', 'M09', 'M10'],
    sources: ['S2', 'S3'],
  },
  {
    id: 'CS-5',
    minutes: 25,
    level: 'intermediate',
    title: 'Recover from an E-stop mid-setup',
    scenario:
      'An E-stop is pressed while jogging during a setup. The part, tool and offsets already measured must survive the recovery.',
    objectives: [
      'Reach a safe state and clear the alarm in the documented order',
      'Show that measured offsets are not lost by the E-stop',
      'Re-establish position confidence before continuing',
    ],
    steps: [
      { text: 'Press E-stop while jogging and try to jog again.', module: 'M03' },
      { text: 'Release E-stop, then press RESET to clear the alarm.', module: 'M02' },
      { text: 'Read the position display and compare it with the last recorded value.', module: 'M01' },
      { text: 'Re-touch the affected axis before continuing the setup.', module: 'M06' },
    ],
    checks: [
      'Motion is refused until E-stop is released and RESET is pressed',
      'Previously stored tool and work offsets are unchanged',
      'The position after recovery matches the display before the E-stop',
    ],
    pitfalls: [
      'Pressing RESET before releasing the E-stop leaves the alarm active',
      'Continuing to cut without re-touching after a stopped move',
    ],
    modules: ['M01', 'M02', 'M03'],
    sources: ['S1'],
  },
  {
    id: 'CS-6',
    minutes: 30,
    level: 'intermediate',
    title: 'Prove the setup before cutting',
    scenario:
      'A colleague hands over a prepared machine with no notes. Before cutting, the setup has to be diagnosed and the result recorded for the supervisor.',
    objectives: [
      'Find an incorrect work offset from the coordinate evidence',
      'Diagnose a tool-length plus work-offset mistake',
      'Record the outcome as an exported assessment report',
    ],
    steps: [
      { text: 'Inspect G54 and the tool length, then position to a known point.', lesson: 'W-F', module: 'M06' },
      { text: 'Separate the tool-length error from the work-offset error.', lesson: 'W-G', module: 'M05' },
      { text: 'Correct the offsets and repeat the dry position check.', module: 'M03' },
      { text: 'Export the attempt history (CSV) and print the report from the dashboard.' },
    ],
    checks: [
      'The incorrect offset is identified from the evidence, not guessed',
      'The corrected position lands at the expected point',
      'The exported report lists the attempts with dates and scores',
    ],
    pitfalls: [
      'Compensating a datum error with tool wear hides the real mistake',
      'Reporting a score without the attempt evidence',
    ],
    modules: ['M05', 'M06'],
    sources: ['S1', 'S2'],
  },
];

export const caseById = (id: string | undefined) => CASES.find((c) => c.id === id);
export const CASE_LEVELS: CaseLevel[] = ['beginner', 'intermediate', 'advanced'];
