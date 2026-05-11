---
name: refactor-safely
description: Use when restructuring, simplifying, renaming, or extracting code without intentionally changing behavior.
---

Follow this workflow:

1. Identify current behavior and boundaries.
2. Confirm tests that protect the behavior.
3. Make one small refactor at a time.
4. Run tests after each meaningful change, and if tests fail, debug the change or revert it before continuing.
5. Avoid mixing refactors with feature changes.
6. Summarize before/after structure and validation.

Rules:
- Preserve behavior, even if that requires broader changes; prefer smaller changes when they still preserve behavior.
- Avoid broad rewrites unless they are needed to preserve behavior.
- Prefer mechanical changes.
- Do not change public APIs unless the prompt explicitly asks you to do so.
