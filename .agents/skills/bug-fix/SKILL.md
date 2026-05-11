---
name: bug-fix
description: Use when diagnosing and fixing a bug, failing test, runtime error, regression, or incorrect behavior.
---

Follow this workflow:

1. Reproduce the bug, or if you cannot reproduce it, reason through the available evidence and document the observed symptoms and context.
2. Identify the smallest affected code path.
3. Find the root cause before editing. 
4. Add or update a regression test unless the bug is not testable in this repository or an equivalent regression test already covers it.
5. Make the minimal fix.
6. Run the failing test or narrowest relevant test.
7. Summarize root cause, fix, and validation.

Rules:
- If these rules conflict, prioritize correctness and test integrity over minimizing scope.
- Do not paper over symptoms.
- Do not weaken tests to make them pass.
- Avoid changing unrelated behavior unless it is required to fix the bug correctly.
