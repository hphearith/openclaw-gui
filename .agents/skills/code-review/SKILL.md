---
name: code-review
description: Use when reviewing a diff, branch, pull request, or recently modified files for correctness, maintainability, security, and test coverage.
---

Review in this order:

1. Correctness bugs.
2. Security or data-loss risks.
3. API compatibility.
4. Edge cases.
5. Test coverage.
6. Simplicity and maintainability.
7. Documentation needs.

While reviewing in the specified order, immediately report any critical issue before continuing with lower-severity categories.

Output:
- Critical issues first.
- Include file paths and exact reasoning.
- Suggest concrete fixes.
- If no serious issues are found, say so clearly.

Rules:
- Do not comment on stylistic preferences such as line length or bracket placement unless they directly affect readability or maintainability.
- Do not suggest large rewrites unless necessary.
