---
name: cnc-offset-engine
description: Implement tool and work offsets or coordinate calculations.
---

# Rules
Separate physical geometry from stored offsets. Use explicit reference planes, mm units and signed transforms. Test correct and incorrect H values, G54 changes, geometry/wear and absolute/incremental coordinates. Do not mix measurement conventions.

# Completion
- Check relevant requirements in CLAUDE.md.
- Add or update focused tests.
- Record unresolved assumptions in PROGRESS.md.
