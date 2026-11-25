/** Beginner explanations for rejected or blocked actions (simulator teaching text, keyed on engine messages). */
const RULES: [RegExp, string][] = [
  [/G255 before ANY rotary/, 'DWO assumes the rotary axes stay put. Haas requires G255 before any rotary motion, then G254 again after positioning.'],
  [/G234 cannot be used at the same time as G254/, 'TCPC (simultaneous) and DWO (3+2) are incompatible modes on Haas; cancel one before starting the other.'],
  [/H-code on the same block/, 'G234 cancels the previous H, so the H-code must be given on the same block (Haas UMC supplement).'],
  [/B-Axis value .* must be zero/, 'DWO computes the rotation itself; a B work offset would be applied twice.'],
  [/Rotary limit|ROTARY-LIMIT/, 'The UMC-500 B axis travels −35° to +120° (layout drawing). Choose an orientation inside that range.'],
  [/Over travel|OVERTRAVEL/, 'The target needs a linear axis beyond its travel. Rotated parts move points away from the spindle; pick another point or orientation.'],
  [/spindle head|Rotation (rejected|check)|Zero return stopped/, 'During rotation the whole part sweeps through space. Retract Z (or zero return Z) before rotating.'],
  [/not in Handle Jog/, 'Jog keys work in HANDLE JOG mode. Pressing HANDLE JOG also cancels G254/G234 (Haas).'],
  [/Probe is .* from the sphere|Load the spindle probe|Mount the calibration sphere/, 'The simulated calibration cycle starts from near the sphere with the probe loaded.'],
  [/Travel limit/, 'The move would pass the axis travel limit. Machine coordinates start at 0 (home) and run negative; jog the other way or use a smaller move.'],
  [/not clamped|would move/, 'Touching an unclamped workpiece would push it and ruin the setup. Clamp it before measuring.'],
  [/would hit the (workpiece|vice|parallel|clamp|platter)|Z retract blocked/, 'The physical tool (its full length, not just the tip) would occupy the same space as a part or fixture. Raise Z before moving across parts and use small increments near surfaces.'],
  [/E-stop (pressed|first)|Release E-stop|clear alarm with RESET|clear E-stop/, 'E-stop removes motion power. Release it, then press RESET to clear the alarm before moving.'],
  [/Unclamp/, 'A clamped workpiece cannot be moved. Unclamp, adjust, clamp again — then re-measure the datum.'],
  [/interferes|overhangs|already holds/, 'Workpieces and fixtures may not overlap each other or hang over the platter edge.'],
  [/Length Geometry/, 'TOOL OFFSET MEASURE writes the Z machine position into the highlighted H GEOM cell of the TOOL tab (Haas manual).'],
  [/WORK offset tab/, 'PART ZERO SET stores the machine position into the highlighted work offset cell, so open OFFSET and press F4 for the WORK tab first.'],
  [/OFFSET display first/, 'F1, ENTER, ORIGIN and F4 act on the offset display. Press OFFSET first.'],
  [/B0|tilt axis/, 'The Haas manual requires the tilt axis at 0° when touching off tools.'],
  [/Out of range|Invalid number/, 'The entry is not a valid number or is outside the allowed range. Check the sign and decimal point; CANCEL deletes the last character.'],
  [/Read-only/, 'Tool Type and Tool Pocket are read-only on this page.'],
  [/CAUTION: Z work offset/, 'With tool lengths measured to the part top, a nonzero Z work offset applies the part height twice (Haas caution). Clear it with ORIGIN unless you use the reference-tool method.'],
  [/Unload the tool/, 'Physical tool data can only be changed for tools that are not in the spindle.'],
];
export function explain(message: string): string | null {
  for (const [re, why] of RULES) if (re.test(message)) return why;
  return null;
}

/** Every mistake category the engine can report. Stored in attempts as an English key; the UI translates it. */
export const MISTAKE_CATEGORIES = [
  'Collision / contact', 'Travel limit', 'DWO / TCPC rule', 'E-stop / alarm handling', 'Wrong screen, tab or mode',
  'Invalid entry', 'Setup change rule', 'Tilt axis not at B0', 'Procedure order',
] as const;
export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];

/** Mistake category for incorrect actions (null = not a mistake). Dry-run checks are never mistakes. */
const CATS: [RegExp, MistakeCategory | ''][] = [
  [/^(Rotation|Move) check/, ''],
  [/would hit|would move|not clamped/, 'Collision / contact'],
  [/Travel limit|Over travel|Rotary limit/, 'Travel limit'],
  [/G255 before ANY rotary|G234 cannot be used|H-code on the same block|B-Axis value .* must be zero/, 'DWO / TCPC rule'],
  [/E-stop (pressed|first)|Release E-stop|clear alarm with RESET|clear E-stop|Clear E-stop/, 'E-stop / alarm handling'],
  [/OFFSET display first|Length Geometry|WORK offset tab|Read-only|Answer Y or N|ZERO RETURN mode first|not in Handle Jog/, 'Wrong screen, tab or mode'],
  [/Invalid number|Out of range|Invalid offset number|Invalid H\/D/, 'Invalid entry'],
  [/Unclamp|interferes|overhangs|already holds|Unload the tool/, 'Setup change rule'],
  [/Set the tilt axis to B0/, 'Tilt axis not at B0'],
  [/Tool .* not in library|No tool in spindle|Load the spindle probe|Mount the calibration|Probe is .* from the sphere|Need sphere measurements|face needs/, 'Procedure order'],
];
export function categorize(message: string): string | null {
  for (const [re, c] of CATS) if (re.test(message)) return c || null;
  return null;
}
