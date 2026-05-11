---
name: feature-implementation
description: Use when implementing a scoped feature, product behavior change, API change, or UI change in this repository.
---

Follow this workflow:

1. Restate the requested feature in concrete terms.
2. Identify the likely files and code paths.
3. Inspect the relevant code before editing.
4. Propose a short plan.
5. Make the smallest coherent change.
6. Add or update tests.
7. Run the narrowest relevant test command.
8. Run lint/typecheck/build when the change touches files or code paths that the repository normally validates with those checks, or when it affects build or configuration behavior.
9. Summarize:
   - files changed
   - behavior changed
   - tests run
   - risks or follow-ups

Rules:
- If these rules conflict, prioritize preserving public APIs and avoiding unrelated code changes.
- Do not rewrite unrelated code.
- Do not add dependencies unless needed.
- Preserve public APIs unless the task requires changing them.
- Prefer existing project patterns over new abstractions when they do not conflict with the rules above.
