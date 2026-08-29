# Apply progress — driver-route-cockpit-redesign

## S1 — Pure derivation selector (REMEDIATED, GREEN)

Compaction: prior commit breached the 600 all-inclusive cap (678 lines vs baseline `2425c17`); this file trimmed 70→10 and the spec tightened by ~32 lines (fixture/dividers/whitespace). **No production change, no test assertion weakened, all 41 tests + REQ-DCD-001..008 coverage preserved.**

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 41/41 pass · TRIANGULATE 8 `it.each` + 100-read side-effect spy · REFACTOR helpers named for S4–S10.

**Verify**: `pnpm test:unit --run .../cockpit` 41/41 · `pnpm test:unit --run` (full) 356 files / 5486 tests · `pnpm type-check` clean.

**Budget vs `2425c17`**: impl 146+/0-, spec ~422+/0-, tasks.md 4+/4-, apply-progress.md 10+/0- ⇒ **TOTAL ≤600 (additions+deletions, margin)**. Branch `feat/driver-route-cockpit-redesign-b1-foundations`; no push. S2 not started.

## S2 — Truthful quick-action predicates and guards (GREEN)

Co-located `driverCockpitQuickActions.ts` + spec. Predicates (`canOpenExternalMap`/`canCopyAddress`/`canOpenEmail`) are synchronous + pure; helpers (`openExternalMap`/`copyAddressToClipboard`/`openEmail`) return typed `QuickActionResult { ok, message }` and NEVER throw (SSR / blocked popup / clipboard rejection / `window.open` throw all return canonical failure copy).

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 41/41 pass (after parameterizing SSR + throwing cases) · TRIANGULATE 12/5/5 `it.each` + SSR / blocked / clipboard-rejection paths via `vi.stubGlobal('window'|'navigator', undefined)` · REFACTOR shared `encodeQuery` helper, `QUICK_ACTION_FAILURE_MESSAGES` exported for S3 to mirror into `copy.ts` `cockpit.quickActions` subtree.

**Verify**: `pnpm test:unit --run .../utils/cockpit` 41/41 · `pnpm test:unit --run` (full) green · `pnpm type-check` clean.

**Budget vs `4bd68a2`**: impl 108+/0-, spec 266+/0-, tasks.md 4+/0- (checkbox toggles), apply-progress.md 10+/0- ⇒ **TOTAL ≤390** (under 400 cap, under 370 aim + slack). Branch unchanged; no push. S3 not started.