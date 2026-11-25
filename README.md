# Haas Virtual Lab

A browser-based training simulator for the **Haas UMC-500** (NGC control). It runs entirely offline in the
browser: no backend, no account, no paid API, and it never talks to a real machine.

- Machine: UMC-500, X 610 / Y 406 / Z 406 mm, B −35…+120°, Ø400 mm platter, 508 mm clearance
- Control: NGC-style keypad, POSITION / OFFSETS / SETUP screens, G54–G59, tool and work offsets, G43 checks
- Learning: 12 modules (M01–M12), lessons A–E, W-0…W-G, F-A…F-I, guided / practice / assessment modes
- Records: learning dashboard with competency breakdown, mistake analysis, CSV + JSON exports
- Languages: English and Bahasa Melayu
- Version: 1.0.0

## Quick start

```bash
npm install
npm run dev        # local development server
npm test           # 155 unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ at http://127.0.0.1:4173
```

End-to-end tests use Playwright and need a Chromium build:

```bash
PW_CHROMIUM=/path/to/chrome npm run e2e    # 11 tests
```

## What is implemented

| Area | Status |
| --- | --- |
| Machine geometry, travel, limits, E-stop, jogging, handle | done |
| Tool library T1–T7, tool offsets, NEXT TOOL, Setting 142 | done |
| Vice / parallels / part setup, datums, edge finder, gauge block | done |
| Five-axis: 3+2 orientations, DWO/TCPC, MRZP, simulated MDI, ZERO RETURN | done |
| Academy, lessons, quizzes, assessment scoring, variants | done |
| Dashboard, competency, revision suggestions, exports | done |
| English / Bahasa Melayu | done |
| Case studies, reference library, user guide, settings, keyboard shortcuts | done (v1.0) |
| Restricted G-code programs, MDI program entry, graphics, dry run | **not implemented** (Phase 6) |
| Wireless Intuitive Probing System | **not implemented** (Phase 4, needs installed hardware) |

Unavailable modules (M07 probing, M11 program entry, M12 full workflow) are shown as unavailable in the UI and
explained in the module page — the app never pretends a feature exists.

## Documentation

- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — how to use the simulator, the academy, the dashboard and shortcuts
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub Pages deployment, including the manual fallback
- [CHANGELOG.md](CHANGELOG.md) — release history
- [PROGRESS.md](PROGRESS.md) — phase-by-phase implementation record and measured performance
- [references/haas.md](references/haas.md) — source register (S1 mill manual 96-8210 Rev N, S2 UMC supplement
  96-8250 Rev L, S3 UMC-500 layout drawing 2019 Rev 1)

## Project structure

```
src/
  academy/    modules M01–M12, competency, exports, launch
  app/        hash router, shortcuts, version
  components/ shared UI (help overlay)
  config/     UMC-500 profile and machine data
  content/    case studies and reference library data
  controller/ NGC keypad, screens, POSITION/OFFSET/SETUP
  engine/     machine state machine, five-axis maths, variants, mistake categories
  i18n/       en.json, ms.json
  lessons/    lesson definitions and the lesson panel
  machine/    3D scene (React Three Fiber)
  pages/      home, academy, simulator, cases, assessment, dashboard, reference, guide, settings
  store/      zustand stores (machine, lesson, progress, ui)
tests/
  unit/       Vitest
  e2e/        Playwright
qa/           performance measurement scripts
```

## Scope, safety and accuracy

- Educational simulator only. It is **not** machine control and must not be used to drive real equipment.
- Dimensions and control behaviour come from the cited Haas manuals; anything unverified is listed explicitly
  in the in-app **Reference** page under "Simulated or unverified" rather than presented as fact.
- Physics, cutting forces, spindle load and surface finish are not simulated. Programs are not executed:
  Phase 6 is not implemented.
- Real machine training must be supervised and follow the manufacturer's manuals.

## Deployment

The build uses a relative base (`base: './'`), so the same `dist/` works at a domain root, at a GitHub Pages
project subpath (`/HaasVirtualLab/`) and from `file://`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
