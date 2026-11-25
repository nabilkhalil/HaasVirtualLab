# Changelog

All notable changes to Haas Virtual Lab. The project follows semantic versioning.

## 1.0.0 — 2026-11-26

First complete release of the teaching simulator: Phases 1–3, 5, 7A–7D.

### Added
- **Case studies** (`src/content/cases.ts`, `#/cases`): six synthetic industrial scenarios (CS-1…CS-6) with
  objectives, procedures linked to real lessons, acceptance checks, common mistakes, related modules and cited
  sources; list and detail views, previous/next navigation.
- **Reference library** (`src/content/reference.ts`, `#/reference`): the source register (S1 mill manual
  96-8210 Rev N, S2 UMC supplement 96-8250 Rev L, S3 UMC-500 layout drawing), control keys, travels and
  increments, the program commands the simulator actually supports, a glossary and an explicit
  "simulated or unverified" list.
- **User guide** (`#/guide`, `docs/USER_GUIDE.md`): learning modes, controller screens, case studies,
  dashboard exports, keyboard shortcuts, data handling, limits and troubleshooting.
- **Settings page** (`#/settings`): language, controller panel width, arrow-key jogging, fullscreen, data
  reset, version.
- **Resizable simulator panel**: draggable divider with `role="separator"`, `aria-valuenow`, arrow-key
  adjustment (±2 %) and double-click reset; width persisted (`hvl-ui`).
- **Keyboard shortcuts**: `?` shortcut list, `F` fullscreen, `Esc` close, arrow keys jog X/Z,
  PageUp/PageDown jog Y — suppressed while typing in a field or select; overlay is a modal dialog.
- **Version badge** injected from `package.json` at build time (`__APP_VERSION__`).
- Fullscreen toggle with a safe fallback where the API is unavailable.
- Docs: `README.md`, `docs/USER_GUIDE.md`, `docs/DEPLOYMENT.md`, this changelog, and a GitHub Pages
  workflow (`.github/workflows/deploy.yml`).

### Fixed
- **Crash on leaving the simulator:** every navigation away from `#/simulator` threw
  `NotFoundError: removeChild` because drei's `<Html>` labels were appended into R3F's canvas wrapper, which React
  owns and removes during commit. All scene labels and the workpiece toolbar are now portalled into a stable,
  React-owned `.labels` overlay inside the scene (`LabelsPortal` context), so unmounting is clean. Guarded by an
  end-to-end test that fails on any page error while navigating in and out of the simulator.

### Changed
- Home tiles for cases, reference, guide and settings are live instead of "planned".
- `toggleFullscreen` resolves its target lazily so an environment without a DOM returns `false` instead of
  throwing.

### Tests
- 155 unit tests (was 139): +8 for panel/shortcut/version behaviour, +8 for case-study and reference
  integrity (lesson and module references exist, sources are registered, only implemented G-codes are listed,
  Bahasa Melayu coverage).
- 11 Playwright end-to-end tests (was 9): new coverage for the case-study flow into the simulator, reference
  tables, guide, settings persistence, shortcut overlay, keyboard jogging and divider resizing.

## 0.7.3 — 2026-11-25

Phase 7C re-verified and its bilingual gaps closed.

### Fixed
- Dashboard leaked English in Bahasa Melayu: recommendation reasons are now typed data
  (`quiz | practical | category | mistake`) rendered through i18n, and mistake bars use `mistake.*` labels
  covering all nine `MISTAKE_CATEGORIES` (drift guarded by a unit test).
- CSV header now follows the UI language (`attemptsCSV(attempts, header)`); values stay canonical English so
  exports from both languages merge.
- `reason.category` wording (`{category} is weak ({pct} %)` / `{category} lemah ({pct} %)`).

### Performance (re-measured, preview + SwiftShader)
- Shader re-links per jog: 0 (was 2 before 7C). CPU for 20 keypad presses 0.306 s (wall 1.16 s); 30 jogs
  0.517 s (wall 3.14 s); idle 3 s 0.002 s; home ready 215–248 ms; first paint of the simulator 534–616 ms.

## 0.7.2 — Phase 7A/7B

- Academy with modules M01–M12 (M07/M11/M12 unavailable), sourced quizzes, completion rules, resume.
- Assessment engine with randomised variants, scored metrics, mistake categories and attempt history.
- Dashboard with competency breakdown, common mistakes, revision suggestions, JSON backup/restore, CSV and
  print exports.

## 0.5.0 — Phase 5

- Five-axis UMC-500 profile, C→B transforms, MRZP, DWO/TCPC targets, swept collision, ZERO RETURN and HANDLE
  JOG, simulated MDI (G00 B/C, G254, G255, G234 H, G43 H), lessons F-A…F-I.

## 0.3.0 — Phase 3

- Vice, parallels and part setup, datums, G54–G59, PART ZERO SET, edge finder, gauge block, reference tool,
  "Why:" explanations, lessons A–E and W-0…W-G.

## 0.2.0 — Phase 2

- Tools T1–T7, NGC offset page, keypad entry, TOOL OFFSET MEASURE, NEXT TOOL, Setting 142 prompt, paper
  touch-off, G43 check.

## 0.1.0 — Phase 1

- Application shell, POSITION screen, E-stop and RESET, jog increments from the manual, handle jog, travel
  limits, 3D machine views.
