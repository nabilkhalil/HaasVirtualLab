# HaasVirtualLab
Build a browser-based educational Haas UMC-500 NGC simulator for beginners. Offline simulation only; never connect to physical machinery. Training does not replace supervised machine instruction.

Stack: React, TypeScript, Vite, React Three Fiber, Drei, Zustand, Vitest, Playwright. GitHub Pages deployment. No backend or paid APIs.

Use one deterministic machine state shared by controller and 3D scene. Use mm internally. Separate physical tool length, stored H/D offsets, physical datum, stored G54–G59 offsets, programmed position and actual tool tip. Verify signs and reference planes. Never invent Haas button behavior or machine calibration. Disable unsupported controls. Record sources and NGC version in references/haas.md. Use official manuals at https://www.haascnc.com/service/online-operator-manuals.html and actual lab machine photographs when supplied.

Machine profile: UMC-500, X/Y/Z/B/C; verify spindle, travels, rotary pivots and installed WIPS before claiming fidelity. Start with procedural geometry, then optional GLB. Include spindle, holder, trunnion, platter, vice, stock, datum markers and camera views.

## Phases (one per session)
1. Scaffold app; 3D machine, NGC-style controller shell, axis selection, jog increments, manual jogging, position display, simulated reset/E-stop and travel limits. Test state and motion. Unverified controls disabled.
2. Tool library, H/D geometry and wear, manual measurement, tool compensation and error visualization.
3. Workholding, datum selection, manual G54–G59 setup, coordinate transforms and verification.
4. Optional WIPS tool setter and workpiece probe workflows, only after verifying installed equipment and documentation.
5. B/C kinematics, MRZP visualization, 3+2 positioning; DWO/TCPC only after verified implementation.
6. Restricted G-code parser, MDI, graphics, single block, simulated dry run; reject unsupported commands. Swept collision checks before program motion.
7. Guided/practice/assessment modes, lessons, local progress, GitHub Pages deployment.

## Architecture
src/engine (pure calculations and controller state), src/controller (functional keypad/screens), src/machine (3D), src/config (machine profile), src/lessons, src/store, tests, references.

## Working rules
Read PROGRESS.md first. Load only relevant skills and source files. Do not repeatedly read full manuals; cache verified facts with section and version. Use targeted tests, small edits, no unnecessary dependencies. Do not print full code in chat. Update PROGRESS.md under 50 lines after each phase. Report changed files, tests, preview URL and blockers. Stop after requested phase.
