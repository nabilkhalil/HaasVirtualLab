# Progress
Status: v1.0.0 — Phases 1–3, 5, 7A–7D complete (2026-11-26). Phase 6 (G-code/MDI) and Phase 4 (WIPS) NOT implemented.
Sources in references/haas.md: S1 Mill NGC 96-8210 Rev N, S2 UMC 96-8250 Rev L, S3 UMC-500 layout (2019 Rev 1).

## Phases 1–3 (summary)
1: shell, POSITION, E-stop/RESET, S1 jog increments, handle, limits, 3D views. 2: tools T1–T7, NGC offset page, keypad,
TOOL OFFSET MEASURE, NEXT TOOL, Setting 142, paper touch-off, G43 check. 3: vice/parallels/parts, datums, WORK tab G54–G59,
PART ZERO SET, edge finder, gauge block, reference tool, "Why:" explanations. Lessons A–E, W-0…W-G.

## Phase 5 — five-axis
- Profile from S3: X610/Y406/Z406, B −35…+120, platter Ø400, 508 mm clearance; B parallel to Y (S2 MRZP). engine/fiveaxis.ts:
  C→B transforms (true vs controller MRZP 255–257 + simulated error), DWO/TCPC targets, face solver, swept collision
  (≤2 mm / ≤1°, incl. spindle head), sphere MRZP fit, TCPC paths; ZERO RETURN/ALL/SINGLE, HANDLE JOG; simulated MDI
  (G00 B C / point, G254, G255, G234 H, G43 H) with S2 rules and alarms. 5-AXIS tab; lessons F-A…F-I.

## Phase 7A/7B — academy, assessment, dashboard
- Hash routing, lazy pages; academy/modules.ts M01–M12 (M07/M11/M12 unavailable: Phases 4/6), sourced quizzes, completion
  rules, W-0 exercise, step why/expected response, prev/next, resume (LocalStorage progressStore).
- variant.ts randomised practice/assessment; reduce() metrics; attempts with items, time, seed; competency.ts
  breakdown/mistakes/revision; #/assessment and #/dashboard (JSON backup/restore, CSV, print).

## Phase 7C — Bahasa Melayu + performance
- i18n/en.json + i18n/ms.json, useT(); navigation, home, academy, dashboard, assessment translated; language persisted.
  Haas key labels/screens and quiz/step texts stay English (stated in the BM UI).
- Gap fixes: recommend() returns typed reason data rendered via i18n; mistake.* covers all nine MISTAKE_CATEGORIES
  (drift guarded by a test); attemptsCSV takes a translated header, values stay canonical.
- Perf: FatLine keeps materials (2 shader re-links per action → 0), slice-only subscriptions, frameloop="demand",
  dpr ≤1.5, GL cleanup, debounced resume save, idle chunk prefetch. Re-measured: re-links 0; CPU 20 keypad presses
  0.306 s (wall 1.16 s); 30 jogs 0.517 s (wall 3.14 s); idle 3 s 0.002 s; home ready 215–248 ms; first paint 534–616 ms;
  Home→Simulator 422–487 ms. Bundles: index 380.9 kB (122 gz), Dashboard 11.3 kB, Simulator 1,025.1 kB (275 gz).

## Phase 7D + release 1.0.0 (2026-11-26)
- content/cases.ts: CS-1…CS-6 (vice plate, centre datum, two offsets, 3+2 bracket, E-stop recovery, prove-the-setup)
  with objectives, lesson-linked procedure, acceptance checks, pitfalls, modules, sources; #/cases list + detail.
- content/reference.ts: source register, control keys, travels, supported commands (G00/G254/G255/G234/G43 only — guarded
  by a test), glossary, explicit "simulated or unverified" list; #/reference.
- #/guide (in-app user guide + shortcut table), #/settings (language, panel width 45–85 %, arrow-key jog toggle,
  fullscreen, data reset, version). New: store/uiStore.ts, app/shortcuts.ts, app/version.ts, components/HelpOverlay.tsx.
- Simulator: draggable + keyboard (role=separator, aria-valuenow, ±2 %) machine/controller split, persisted; arrow keys
  jog X/Z, PageUp/PageDown jog Y, suppressed while typing. Global: ? shortcut modal, F fullscreen, Esc close.
- Docs: README.md, docs/USER_GUIDE.md, docs/DEPLOYMENT.md, CHANGELOG.md, .github/workflows/deploy.yml (Pages). Version
  1.0.0; git repository initialised, tagged v1.0.0.
- Fixed a route-change crash: drei <Html> labels sat in R3F's canvas wrapper, so leaving the simulator threw removeChild;
  labels now portal into a React-owned overlay (e2e guards it).
- BM verified in the browser (titles, scenarios, objectives, table headers); procedures/checks/pitfalls stay English.

## Tests (2026-11-26)
`npm test`: 155 unit, 12 files (was 139; +8 content integrity, +8 UI/shortcut/version). `npm run build` OK. `npm run e2e`
(SwiftShader Chromium): 11 tests (was 9; +case-study→simulator flow, reference, guide, settings persistence, shortcuts,
keyboard jog, divider resize). Deployment not published: no GitHub repo or credentials here — see docs/DEPLOYMENT.md.
