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
## S3 — Cockpit/drawer/confirmation/refresh copy source (GREEN)

Additive `cockpit.*` subtree on `copy.ts` (header / operational / drawer / quickActions / confirm / footer) + `toasts.refreshFailed` for the manual-refresh path. `actions.checkIn` reused verbatim (no duplicate `Marcar entregada` key); `QUICK_ACTION_FAILURE_MESSAGES` cross-imported so any drift in either file fails the spec immediately.

**TDD**: RED 9 cockpit assertions fail on `cockpit`/`refreshFailed` undefined · GREEN 17/17 · TRIANGULATE live-import cross-pin of `QUICK_ACTION_FAILURE_MESSAGES` + `it.each` over `{customer}`/`{N}`/`{folio}` + `{completed}`/`{total}` template order · REFACTOR consolidated two quick-action failure tests into one cross-import test; tightened copy.ts S3 comments to single-line REQ annotations.

**Verify**: `pnpm test:unit --run .../__tests__/copy.spec.ts` 19/19 (8 existing + 11 new) · `pnpm test:unit --run` (full) 357 files / 5538 tests green · `pnpm type-check` clean.

**Budget vs `196848f`**: impl 59+/0-, spec 107+/0-, tasks.md 4+/4- (S3 checkboxes), apply-progress.md ~12+/0- ⇒ **TOTAL ≈ 190** (under 200 cap, slightly over 170 aim by ~20 lines from the cross-import + REQ comments). Branch unchanged; no push. S4 not started.

