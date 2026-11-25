# Haas Virtual Lab — User Guide (v1.0.0)

A training simulator for the Haas UMC-500. Everything runs in your browser; there is no sign-in and no server.

## 1. Start here

Open the app and pick a starting point from the home page:

| Tile | What it does |
| --- | --- |
| **Academy** | Staged path M01–M12: outcomes, theory, demonstration, guided steps, practice, quiz |
| **Simulator** | The full machine: 3D view, NGC controller, lesson panel |
| **Case studies** | Six synthetic jobs that chain the lessons, with acceptance checks |
| **Assessment** | Independent scored exercises with randomised parameters |
| **Dashboard** | Progress, competency, common mistakes, revision advice, exports |
| **Reference** | Sources, control keys, travels, supported commands, glossary, unverified list |
| **Guide** | This document, condensed, inside the app |
| **Settings** | Language, controller panel width, keyboard jogging, fullscreen, data |

Your progress, language and display settings are stored in this browser's local storage. Nothing is uploaded.

## 2. Learning modes

- **Guided** — every step is shown with what to press, why it matters and what to expect. Steps advance only
  when you perform the right action.
- **Practice** — the answers are hidden; you are scored on the actions you take, with hints available (hints
  reduce the score).
- **Assessment** — practice with randomised physical parameters (part size, datum position, tool lengths), so
  the same exercise cannot be memorised. The variant seed is recorded with the attempt.

Use the lesson panel on the left of the simulator to choose an exercise, read the step help, and submit for
scoring. **Resume** on the home page returns you to the last lesson you left.

## 3. The controller

The right-hand panel is an NGC-style control:

- **POSITION** — axis position, distance to go, active work offset, tool.
- **OFFSETS** — length and diameter geometry/wear for T1–T7, H and D codes, G54–G59 work offsets.
- **SETUP** — tool loading, vice/parallels/part, datum and part-zero setting.
- **CONTROL** — jog increment, axis selection, handle jog, E-stop, RESET, and the 5-axis tab.

Acting on the wrong screen, or in the wrong order, produces a real recorded mistake rather than a silent no-op —
mistake categories are what the dashboard analyses.

## 4. Case studies

Six scenarios, each with objectives, a procedure, acceptance checks and the mistakes that usually cost marks:

| ID | Scenario | Level |
| --- | --- | --- |
| CS-1 | First plate in a vice | Beginner |
| CS-2 | Centre datum with an edge finder | Beginner |
| CS-3 | Two parts, two offsets | Intermediate |
| CS-4 | 3+2 bracket on the trunnion | Intermediate |
| CS-5 | Recover from an E-stop mid-setup | Advanced |
| CS-6 | Prove the setup before cutting | Advanced |

Procedures, acceptance checks and pitfalls are kept in English because they use Haas technical wording; the
titles, scenarios and objectives are translated in Bahasa Melayu.

## 5. Dashboard and exports

The dashboard shows overall completion, competency per category (setup, offsets, five-axis, safety), your most
common mistakes, revision suggestions with reason, and the full attempt history.

- **CSV** — one row per attempt. The header follows the UI language; values (mode, module id, mistake category)
  stay canonical English so exports from both languages merge in a spreadsheet.
- **JSON backup** — complete state, restorable on another machine or after clearing storage.
- **Print** — a clean printable report (no navigation or controller).

## 6. Keyboard and accessibility

| Keys | Action |
| --- | --- |
| `?` | Open or close the shortcut list |
| `F` | Toggle fullscreen |
| `Esc` | Close the shortcut list |
| `←` `→` | Simulator: jog X − / X + |
| `↑` `↓` | Simulator: jog Z + / Z − |
| `PgUp` `PgDn` | Simulator: jog Y + / Y − |
| `←` `→` on the focused divider | Resize the controller panel by 2 % |

Shortcuts never fire while you are typing in a field or select. Every control is a real focusable button, so the
whole app is usable from the keyboard. The divider is a `separator` with `aria-valuenow`, movable with the arrow
keys as well as by dragging.

## 7. Settings

- **Language** — English or Bahasa Melayu, applied immediately and remembered.
- **Controller panel width** — 45–85 % of the window, the same value the divider sets.
- **Arrow keys jog the selected axis** — turn this off if you use the arrow keys for scrolling.
- **Fullscreen** — for demonstrations and labs.
- **Reset progress** — clears attempts and module status; export a JSON backup first.

## 8. Limits of the simulation

- No material removal, cutting forces, spindle load or surface finish.
- No program execution: restricted G-code and MDI program entry are **not implemented** (Phase 6). Only the
  simulated five-axis MDI commands (G00 B/C, G254, G255, G234 H, G43 H) are supported.
- No probing (Phase 4).
- Machine data that could not be verified against the manuals is flagged in the in-app **Reference** page.
- This is a teaching aid, not machine control. Supervised, manufacturer-documented training is still required
  before running a real UMC-500.

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| 3D view shows "WebGL unavailable" | Enable hardware acceleration, or use a browser with WebGL 2 |
| Progress disappeared | Browser storage was cleared; restore a JSON backup from the dashboard |
| Arrow keys scroll instead of jogging | You are outside the simulator, or the arrow-key jog setting is off |
| Scores look wrong for a variant | The attempt is tied to its randomised seed; start a new attempt for a fresh variant |
