/** Default "why" and "expected machine response" for a guided step, keyed on the highlighted control. */
const H: [RegExp, string, string][] = [
  [/^inc-/, 'Coarse increments travel fast; fine increments near a surface or target prevent overshoot and contact.', 'The increment key lights; each jog click moves exactly that amount.'],
  [/^jog-[XYZ]/, 'Moves the axis toward the target shown in the step.', 'POSITION display and the 3D machine move one increment per click.'],
  [/^jog-[BC]/, 'Rotary axes are jogged in degrees with the same increment keys.', 'B tilts the trunnion / C turns the platter by one increment per click.'],
  [/^sel-/, 'Jog keys and the handle act on the selected axis.', 'The axis row is highlighted on the position screen.'],
  [/^key-OFFSET/, 'Offsets are read and entered on the OFFSET display.', 'The offset table appears on the screen.'],
  [/^key-F4/, 'Tool and work offsets share the OFFSET display; F4 toggles the tab (Haas manual).', 'The other tab (TOOL / WORK) is shown.'],
  [/^key-(UP|DOWN|LEFT|RIGHT|PAGE)/, 'Values are written only into the highlighted cell.', 'The highlight moves.'],
  [/^key-PART_ZERO_SET/, 'Stores the current machine position in the highlighted work offset cell (Haas manual).', 'The cell shows the machine position and the cursor advances X → Y.'],
  [/^key-TOOL_OFFSET_MEASURE/, 'Stores the Z machine position as H geometry (Setting 64 OFF).', 'H GEOM shows the current Z machine position.'],
  [/^key-F1/, 'F1 sets (replaces) the highlighted value.', 'The cell shows the typed value and the input line clears.'],
  [/^key-ENTER/, 'ENTER adds the typed value to the highlighted value.', 'The cell changes by the typed amount.'],
  [/^key-Y/, 'Setting 142 asks you to confirm large offset changes.', 'The change is written.'],
  [/^key-ORIGIN/, 'Zeroes the highlighted value.', 'The cell shows 0.000.'],
  [/^key-CANCEL/, 'Deletes the last typed character.', 'The input line gets shorter.'],
  [/^(key-NEXT_TOOL|load-|tab-SETUP,load)/, 'The exercise needs a different tool in the spindle; Z retracts first.', 'Active Tool changes and the 3D tool shape updates.'],
  [/^key-HANDLE_JOG/, 'Jog keys work only in HANDLE JOG; it also cancels G254 / G234.', 'MODE shows HANDLE JOG.'],
  [/^key-(ZERO_RETURN|SINGLE|ALL)/, 'Returning to machine zero gives clearance before other moves.', 'The selected axes move to 0.'],
  [/mdi-/, 'Simulated MDI command (the real MDI parser arrives in Phase 6).', 'The 5-AXIS status and report update.'],
  [/probe-sphere|apply-mrzp/, 'Each sphere measurement at a new orientation constrains the rotary centres.', 'A measurement or the estimate appears in the MRZP list.'],
  [/face-/, 'Each face needs its own B/C orientation so the tool axis is normal to it.', 'The platter turns and tilts; the face normal points up.'],
  [/lesson-q-|lesson-record|lesson-submit/, 'Check your understanding using the displays.', 'Your answer is recorded.'],
  [/keypad/, 'Type the value on the input line.', 'The input line shows the number.'],
  [/clamp|parallels|size-|align|tab-SETUP/, 'Workholding is changed only while unclamped, then clamped before measuring.', 'The 3D workpiece and setup warnings update.'],
  [/wcs-|chk-/, 'Selects what the controller uses for the comparison.', 'Coordinate displays update.'],
];
export function stepHelp(target?: string): { why: string; expect: string } | null {
  if (!target) return null;
  const t = target.split(',').pop()!;
  const hit = H.find(([re]) => re.test(t) || re.test(target));
  return hit ? { why: hit[1], expect: hit[2] } : null;
}
