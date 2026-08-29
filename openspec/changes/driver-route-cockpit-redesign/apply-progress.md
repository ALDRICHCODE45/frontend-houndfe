# Apply progress — driver-route-cockpit-redesign

## S1 — Pure derivation selector (REMEDIATED, GREEN)

Compaction: prior commit breached the 600 all-inclusive cap (678 lines vs baseline `2425c17`); this file trimmed 70→10 and the spec tightened by ~32 lines (fixture/dividers/whitespace). **No production change, no test assertion weakened, all 41 tests + REQ-DCD-001..008 coverage preserved.**

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 41/41 pass · TRIANGULATE 8 `it.each` + 100-read side-effect spy · REFACTOR helpers named for S4–S10.

**Verify**: `pnpm test:unit --run .../cockpit` 41/41 · `pnpm test:unit --run` (full) 356 files / 5486 tests · `pnpm type-check` clean.

**Budget vs `2425c17`**: impl 146+/0-, spec ~422+/0-, tasks.md 4+/4-, apply-progress.md 10+/0- ⇒ **TOTAL ≤600 (additions+deletions, margin)**. Branch `feat/driver-route-cockpit-redesign-b1-foundations`; no push. S2 not started.