# Technical reference register
Official manuals index: https://www.haascnc.com/service/online-operator-manuals.html (HTML pages return 403 to automated fetch).

## Source S1 (verified 2026-11-24)
Haas Mill Operator's Manual, NGC, English, document 96-8210 **Revision N (2020)**.
URL: https://www.haascnc.com/content/dam/haascnc/en/service/manual/operator/english---mill-ngc---operator's-manual---2020.pdf
Manual mentions NGC software 100.19.000.1100 features; lab machine NGC version still UNKNOWN.
Page numbers are manual page labels.

### Keys (Control Pendant tables, pp. ~38-45)
- [RESET] "Clears alarms. Clears input text. Sets overrides to default values if Setting 88 is ON."
- [TOOL OFFSET MEASURE] "Records tool length offsets during part setup."
- [NEXT TOOL] "Selects the next tool from the tool changer."
- [OFFSET] "Displays the Tool Offset and Work Offset tabbed menu." [POSITION] "Selects the positions display."
- [UP]/[DOWN]/[LEFT]/[RIGHT] "Moves one item, block, or field in the associated direction."
- [PAGE UP]/[PAGE DOWN] "Used to change displays or move up/down one page when viewing a program."
- [ORIGIN] "Sets selected values to zero." [CANCEL] "Deletes the last character typed." [ENTER] "Answers prompts and writes input."
- [-] "Adds a minus (-) sign to the input line." [.] "Adds a decimal point to the input line."
- Jog increment keys [.0001 /.1], [.001 / 1.], [.01 / 10.], [.1 / 100.]; metric: .001 / .01 / .1 / 1 mm per handle click (Jog mode table, Settings section).
- Jog mode (4.16.1): [HANDLE JOG], axis key, increment; "Before you can jog an axis, the machine must establish its home position."

### Tool offsets display (4.16.2, pp. 164-168)
- Page 1: "Active Tool:", "Tool Offset (T)" list (max 200), "Length Geometry (H), Length Wear (H)" (tied to G43 H),
  "Diameter Geometry (D), Diameter Wear (D)" (G41 D), Coolant Position (only with programmable coolant option), function buttons.
- [RIGHT] page 2: Flutes, Actual Diameter, Tool Type (None, Drill, Tap, Shell Mill, End Mill, Spot Drill, Ball Nose, Probe),
  Tool Material, Tool Pocket ("read only"), Tool Category. Page 3: probe columns (Approximate Length = tip to spindle gauge line, ...).
- Value entry (work offsets text, p. 170): "Type in the desired ... offset value and press [F1] to set the value ... [F4] to toggle
  from work to tool offset tab. Type in a value and press [ENTER] to add to the current value."
  Same F1-set / ENTER-add for tool offsets per Haas Lathe manual (Part Setup) and Tooling U "Haas NGC: Entering Mill Offsets".

### Set a Tool Offset (p. 168-169) — VERIFIED PROCEDURE
"Tool Length Offset is measured from the tip of the tool to the top of the part" "With the Z Axis at its home position".
"When touching off tools ... make sure the tilt axis is at 0 degrees (A0 or B0)."
Steps: load tool; [HANDLE JOG]; [.1/100.]; jog X/Y near part centre; [+Z]; jog ~1" above part; [.0001/.1]; paper between tool and
part, move down "as close as possible, and still be able to move the paper"; [OFFSET] TOOL tab; highlight H Geometry for the row;
[TOOL OFFSET MEASURE] (popup if change > Setting 142, accept Y/N); [NEXT TOOL] ("causes the spindle to move rapidly in the Z Axis"); repeat.
- Setting 64 (T. Ofs Meas Uses Work): OFF -> "the tool offset equals the Z machine position"; ON -> measured + work Z offset.
- Setting 40 (Tool Offset Measure): RADIUS or DIAMETER for D geometry/wear display.
- Setting 142 (Offset Chng Tolerance): warns if an offset changes by more than 0-100 mm; "Accept (Y/N)?"


### Work offsets (S1 4.16.2 p.170-171, 6.12.4 p.~245, G-code G54-G59 p.343, 5.10.4)
- Work Offsets display: "1. G Code" column (all work offset G-codes), "2. X, Y, Z, Axis ... If rotary axis are enabled the offsets
  for these will be displayed", "3. Work Material". [F1] set, [F3] probing action, [F4] toggles work/tool tab, [ENTER] adds.
- Set a Work Offset (pointer): material in vise and tighten; pointer tool; [HANDLE JOG]; [.1/100.]; Z ~1" above part; [.001/1.];
  Z ~0.2" above; jog X/Y to upper-left corner; [OFFSET] > WORK tab, [DOWN] to activate page; navigate to G54 X;
  "[PART ZERO SET] to load the value into the X Axis column. The second press ... loads the value into the Y Axis column."
  CAUTION: "do not press [PART ZERO SET] a third time; this loads a value into the Z AXIS column" (crash / Z alarm).
- 6.12.4: "Press [PART ZERO SET] and the current machine position is automatically stored in that address."
  "If you use automatically generated tool length offsets, you should leave the Z-Axis work offset values at zero.
  Nonzero Z-Axis work offset values interfere with ... tool length offsets, and can cause a machine crash."
  "The X and Y work coordinate offsets are always given as negative values from machine zero ... type -2.0, and press [F1]".
- G54-G59: "All future references to axes positions will be interpreted using the new (G54 G59) coordinate system."
- 5.10.4: multiple fixtures use G54-G59; "Use an edge finder or an indicator to establish the zero point on each part.
  Use the part zero set key in the work offset page to record each X, Y location."
- Position display (T2.22): WORK (G54) "relative to part zero ... On power-up ... uses work offset G54 automatically ... relative
  to the most recently-used work offset"; DIST TO GO; MACHINE "relative to machine zero"; OPERATOR "distance you have jogged".

### Phase 3 simulator assumptions (NOT in S1)
- Active work offset chosen by a simulator selector standing in for an MDI G54-G59 command (MDI arrives in Phase 6).
- PART ZERO SET advances the cursor X->Y->Z (inferred from the 1st/2nd/3rd-press text); no advance after Z.
- WORK position = machine - active work offset (tool length offset not included). Rows shown: G54-G59 only (G52/G154 omitted).
- Edge finder Ø6.000 tip, kick within 0.005 mm, 1 mm compliance; gauge block default 25.000 mm; spindle not modelled.
- Vice geometry, parallels, clamps, misalignment model, workpiece B on platter are illustrative.


## Source S2 (verified 2026-11-24): UMC Operator's Manual Supplement 96-8250 Rev L (Feb 2020)
URL: https://www.haascnc.com/content/dam/haascnc/en/service/manual/supplement/english---umc-operator%27s-manual-supplement---2020.pdf
- 3.3 MRZP: Settings 255 (B-axis rotary centre relative to X home), 256 (C-axis rotary centre relative to Y home),
  257 (B-axis rotary centre relative to Z home); "distance from the home position of a linear axis to the center of rotation";
  "set at the factory". => B axis is parallel to Y; C axis passes through the B centre (simulator geometry follows this).
- 4.1 G234 TCPC (Group 08): for simultaneous 4/5-axis; combines MRZP + active work offset; coordinate system stays fixed to
  the table. Cancelled by [EMERGENCY STOP], [RESET], [HANDLE JOG], [LIST PROGRAM], M02, M30, G43, G44, G49 (not M00/M01).
  "G234 invokes TCPC and cancels G43"; "G43 and G234 cannot be active at the same time"; "An H-code must ... be placed on the
  same block as G234"; "G234 cannot be used at the same time as G254"; "An active work offset ... is required"; invoking G234
  near travel limits can cause over travel — move near the table centre first. G28/G29/G53/M06 ignore G234.
- 5.1 G254 DWO (Group 23): for 3+1/3+2 positioning, not simultaneous. "The B-Axis value of the work offset you use with G254
  MUST be zero." Invoke after the work offset and after rotary positioning. After G254 specify X/Y then Z before cutting.
  Use G53 to retract before rotary motion. Cancelled by E-STOP, RESET, HANDLE JOG, LIST PROGRAM, G255, M02, M30.
  Notes: active work offset required; all rotary motion complete before G254; "Cancel G254 with G255 immediately after use
  and before ANY rotary motion"; cancel for simultaneous work; cancel and retract before repositioning the workpiece.
- 6.1/6.2 B/C work offsets recorded with [PART ZERO SET] in the B/C column; no B offset with G254.
- 6.3 manual X/Y: [PART ZERO SET] X, again for Y (confirms cursor advance X->Y).
- 7.1 Quick Rotary G28 needs Setting 108 ON (not simulated).

## Source S3 (verified 2026-11-24): UMC-500/SS Machine Layout Drawing, 15 July 2019, Revision 1 (Haas Automation UK)
URL: https://www.haas.co.uk/wp-content/uploads/2019/10/UMC-500_MLD_2019_07_r1.pdf
- Table (platter) 400 mm (15.7 in). X travel 610 mm, Y 406 mm, Z 406 mm.
- Rotation (B): "-35 Min +120 Max". C: rotary platter (continuous rotation per Haas listings; not on the MLD).
- Z clearance at B0 (spindle to top of table): max 508 mm (20.0 in), min 102 mm (4.0 in).
- Y travel centred on the table (203 / 203). X travel split 356 / 254 about the table (which side is X0: UNVERIFIED).

## S1 additions (Mill NGC manual): [ZERO RETURN] "Selects Zero Return mode"; [ALL] "Returns all axes to machine zero";
[SINGLE] "Returns one axis ... Press the desired axis letter ... and then press [SINGLE]"; [HANDLE JOG] "Enters Jog mode".

## Phase 5 simulator assumptions (NOT verified)
- Positive B / C rotation sense (right-hand rule about +Y / +Z); B pivot depth below platter top (0 mm); MRZP true values
  derived from the simulator geometry; gauge line taken as the spindle nose (508 mm clearance).
- Controller relation between tool length, tool-set plane and MRZP assumed exact; only settings 255–257 carry calibration error.
- Rotary jog increments reuse the jog keys as degrees. Zero return order: Z first, then X/Y, then B/C.
- Axis letter for [SINGLE] chosen with the axis-select buttons (alpha keyboard not modelled).
- G254/G234/G255/G43 and rotary/linear positioning are issued from a "simulated MDI" panel until Phase 6.
- MRZP calibration is a demonstration with a virtual sphere and simulated probe hits (not the WIPS cycle).

## Simulator assumptions (NOT verified)
- Lab NGC version, rotary pivots (true MRZP), ATC pocket count, holder types.
- Setting 64 = OFF, Setting 40 = DIAMETER, Setting 142 default 10 mm (simulator choice), G54 Z = 0 in Phase 2.
- Total length offset = geometry + wear (standard practice; not quoted in S1).
- Offset cursor does NOT auto-follow the active tool after [NEXT TOOL]; "next tool" = next tool number in the library.
- [TOOL OFFSET MEASURE] only accepted with cursor on a Length Geometry cell; [ORIGIN] zeroes the selected cell only.
- Paper thickness 0.10 mm; tool change retracts Z to machine zero first.
- Simulator messages/alarms (SIM-*) are not Haas alarm numbers.
