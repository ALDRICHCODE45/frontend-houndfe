# P0 demo deactivation — correction progress

- **Status/actionContext:** explicit authorized remediation supersedes stale completion; repo-local docs/evidence stayed within allowed surfaces. Parent supplied the active token; no acquire/reset ran.
- **Completed tasks:** every P0 checklist item is visibly checked, including responsive RED/GREEN; P0 remains a preparatory candidate, not anonymous D1.
- **Files:** five catalog SFCs, focused unit, responsive spec, `tasks.md`, `delivery-map.md`, and this file; router/main/auth/API/layout and legacy mock/store/modal/cart files remain untouched.

## TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| P0 correction | Unit + browser | unit 3/3; browser 2/2 | corrected dark-initial assertion | disabled shell green | theme directions, sentinel/no-demo | composition only |

- Historical Pinia crash remains dependency RED evidence only, not clean-base proof.

## Verification and accounting

- PASS: `CI=true pnpm install --frozen-lockfile`; package/lock hashes unchanged.
- PASS: `pnpm type-check:responsive`; focused Playwright spec (2/2).
- Evidence: `artifacts/responsive/local-run/html/data/0ddbbf2320033cf17ac378c37f3d3c13f2b84bc3.png`, `artifacts/responsive/local-run/html/data/cfa1f2468cbc479ac3d4aba190afc7a77301e131.png`, and `artifacts/responsive/local-run/evidence/summary.json`.
- PASS: `git diff --check`; exact authored accounting including this file: **154 additions + 235 deletions = 389 changed lines** (generated evidence and `.gentle-ai-instance` excluded).
- **Remaining P0 checklist:** none. This is local P0 evidence only; final verification, D1, delivery, commit and push remain out of scope.
- **Workload/PR:** single P0 boundary, under the 400-line hard cap; no commit or push.
