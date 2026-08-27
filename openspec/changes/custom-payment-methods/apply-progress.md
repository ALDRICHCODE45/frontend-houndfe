# Apply Progress — custom-payment-methods

> Phase: `sdd-apply` · Store: `openspec` · Change id: `custom-payment-methods`
> Branch: `feat/custom-payment-methods` (stacked-to-main)
> Strict TDD is ACTIVE (`pnpm test:unit --run` is the gate for every slice).
> Delivery strategy: chained PRs (stacked-to-main) — user-chosen on the Review Workload Guard.

## Recovery note (apply re-execution)

The original `sdd-apply` executor timed out mid-S4B after completing S1–S4A with all
tests green, but it left `PaymentModal.vue`/`PaymentModal.test.ts` half-wired and
with a parse error, and committed nothing. Recovery path: the healthy S1–S4A work was
restored to HEAD, a `feat/custom-payment-methods` branch was created, and the healthy
slices + openspec artifacts were committed. S4B (partial/broken) was discarded and
re-implemented cleanly; S5A and S5B were implemented after it.

Broken S4B diff backed up at `/tmp/custom-payment-methods-s4b-broken.diff` (reference only).

## Slice status (FINAL — all complete)

| Slice | Status | Commit | Review |
|-------|--------|--------|--------|
| S1 — Foundations (CASL + types + query keys + error map) | ✅ DONE | (in docs(sdd) 8badb29) | — |
| S2A — Admin API + composables + view-mode | ✅ DONE | (in docs(sdd) 8badb29) | — |
| S2B — Admin read view + route + nav | ✅ DONE | (in docs(sdd) 8badb29) | — |
| S3A — Form state + actions utility | ✅ DONE | (in docs(sdd) 8badb29) | — |
| S3B — Slideover + card grid + view-mod (isActive REVERSAL pinned) | ✅ DONE | (in docs(sdd) 8badb29) | — |
| S4A — Tile identity util + POS projection + type extensions | ✅ DONE | (in docs(sdd) 8badb29) | — |
| S4B — Modal integrations + entry util + catalogClearSignal | ✅ DONE | 41117bc | review-2583aa39475891a3 approved |
| S5A — Charge error map + dispatch short-circuit | ✅ DONE | de85c10 | review-836102eef63a5494 approved |
| S5B — Sale detail + timeline display (snapshot preferred) | ✅ DONE | fb5acf4 | review-5bcdb35c10a7662c approved |
| Type-fix remediation (vue-tsc --build 14 errors) | ✅ DONE | b629a0c | review-2060ef7c24a1fb88 approved (CRITICAL refuted) |

## TDD Cycle Evidence

Each slice followed RED → GREEN → TRIANGULATE → REFACTOR with `pnpm test:unit --run`
as the gate. Evidence per slice (recorded at completion):

| Slice | RED (failing tests) | GREEN (passing) | TRIANGULATE | REFACTOR |
|-------|---------------------|-----------------|-------------|----------|
| S1 | 4 spec files failing (module not found) | 95 | 8 CASL cases | shared category primitive |
| S2A | 4 spec files failing | 51 | 9 cases | normalizeSubtitle shared |
| S2B | view spec failing | 13 + 1861 regression | 2 stub tweaks | — |
| S3A | 2 spec files failing | 26 | 6 cases | ALLOWED_EDIT_KEYS mirror |
| S3B | 4 spec files failing | 148 + 1912 regression | 12 cases | useSafeTenantId reuse |
| S4A | 4 spec files failing | 193 + 2360 regression | 11 cases | shared ActivePaymentMethodProjection |
| S4B | 15 failures (4 target specs) | 109 → 977 POS | idempotency-key, multi-payment, max-entries | tile-aware createDefaultEntry |
| S5A | 11 failures (3 files) | 80 → 1003 POS | unknown-code, exactly-once, tenant-at-error | shared applyCatalogChargeErrorAction |
| S5B | 10 failures (2 specs) | 45 → 1022 POS | null/whitespace subtitle, mixed list | shared paymentMethodMeta helpers |
| Type-fix | 14 vue-tsc --build errors | 4843 full suite | — | type-only, no behavior change |

## Verified green (final)

- `pnpm test:unit --run` (full suite) → 321 files / 4843 tests pass.
- `pnpm exec vue-tsc --build` (REAL type gate; `--noEmit` is a no-op here) → clean.
- `pnpm build` (type-check + vite build) → exit 0.

## Reviews (receipt-driven, RDD global ON)

Each medium-risk candidate (S4B/S5A/S5B/type-fix) went through a native ordinary
review: `start` (consent granted) → `lens-context` (provider_command) →
`review-reliability` lens over the frozen candidate → `capture-result` (admitted) →
`finalize --captured-results` → `capture-evidence` (real tests, outcome passed) →
`finalize --captured-evidence` (approved) → `validate --gate pre-commit` (allow) →
commit. The type-fix review's single CRITICAL finding (watch reactivity) was REFUTED
by the refuter role (open is defineModel → watch correct). All lens findings were
advisory/informational (see verify-report §7).

## Contract invariants that MUST hold (pinned by tests, per design §1/§11)

1. Tile identity keying: `paymentMethodId ?? method`; fixed tile matcher requires
   `entry.paymentMethodId === undefined` (customs of same category never collide).
2. `isActive` REVERSAL: `UpdatePaymentMethodRequest.isActive?`; `update()` FORWARDS
   `isActive`, omits `tenantId`; create NEVER sends `isActive`/`id`/`tenantId`.
3. `LegacyChargePayload.paymentMethodId?` REQUIRED (buildPayload flattens single entry).
4. POS projection uses `read:Sale` (NOT `read:PaymentMethod`).
5. Charge catalog errors short-circuit BEFORE legacy `getSalePaymentErrorAction`.
6. Admin CRUD mirrors `src/features/admin/payment-details/`.
