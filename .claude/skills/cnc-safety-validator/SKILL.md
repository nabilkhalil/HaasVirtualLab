---
name: cnc-safety-validator
description: Validate simulation motion, alarms and safety states.
---

# Rules
Offline only. Implement simulated E-stop, reset, mode checks, travel limits and swept collision checks before program motion. Distinguish simulated alarms from verified Haas alarms. Reject unsupported commands. Test interlocks and collision cases.

# Completion
- Check relevant requirements in CLAUDE.md.
- Add or update focused tests.
- Record unresolved assumptions in PROGRESS.md.
