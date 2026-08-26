# Apply Progress — custom-payment-methods

> Phase: `sdd-apply` · Store: `openspec` · Change id: `custom-payment-methods`
> Branch: `feat/custom-payment-methods` (stacked-to-main)
> Strict TDD is ACTIVE (`pnpm test:unit --run` is the gate for every slice).
> Delivery strategy: chained PRs (stacked-to-main). Each slice is its own commit.

## Recovery note (apply re-execution)

The original `sdd-apply` executor timed out mid-S4B after completing S1–S4A with all
tests green, but it left `PaymentModal.vue`/`PaymentModal.test.ts` half-wired and
with a parse error, and committed nothing. Recovery path: the healthy S1–S4A work was
restored to HEAD, a `feat/custom-payment-methods` branch was created, and the healthy
slices + openspec artifacts were committed. S4B (partial/broken) was discarded and is
being re-implemented cleanly; S5A and S5B were never started.

Broken S4B diff backed up at `/tmp/custom-payment-methods-s4b-broken.diff` (reference only).

## Slice status (REAL, current branch state)

| Slice | Status | Notes |
|-------|--------|-------|
| S1 — Foundations (CASL + types + query keys + error map) | ✅ DONE | commited |
| S2A — Admin API + composables + view-mode | ✅ DONE | commited |
| S2B — Admin read view + route + nav | ✅ DONE | commited |
| S3A — Form state + actions utility | ✅ DONE | commited |
| S3B — Slideover + card grid + view-mod (isActive REVERSAL pinned) | ✅ DONE | commited |
| S4A — Tile identity util + POS projection + type extensions | ✅ DONE | commited |
| S4B — Modal integrations + entry util + catalogClearSignal | 🔄 IN PROGRESS | being re-implemented cleanly |
| S5A — Charge error map + dispatch short-circuit | ⬜ PENDING | not started |
| S5B — Sale detail + timeline display | ⬜ PENDING | not started |

## Verified green (baseline, before S4B)

- `pnpm test:unit --run src/features/POS/sales` → 71 files / 949 tests pass.
- `pnpm test:unit --run src/features/admin/payment-methods` → 11 files / 148 tests pass.
- `pnpm exec vue-tsc --noEmit` → clean (exit 0).

## Commit log (so far)

- `docs(sdd)` — cleanup fell into this commit; it also carries the healthy S1–S4A code
  (default branch staging captured everything). Functional state is green; commit is
  larger than ideal but NOT re-written (history preserved since the user pushes).

## Contract invariants that MUST hold (pinned by tests, per design §1/§11)

1. Tile identity keying: `paymentMethodId ?? method`; fixed tile matcher requires
   `entry.paymentMethodId === undefined` (customs of same category never collide).
2. `isActive` REVERSAL: `UpdatePaymentMethodRequest.isActive?`; `update()` FORWARDS
   `isActive`, omits `tenantId`; create NEVER sends `isActive`/`id`/`tenantId`.
3. `LegacyChargePayload.paymentMethodId?` REQUIRED (buildPayload flattens single entry).
4. POS projection uses `read:Sale` (NOT `read:PaymentMethod`).
5. Charge catalog errors short-circuit BEFORE legacy `getSalePaymentErrorAction`.
6. Admin CRUD mirrors `src/features/admin/payment-details/`.
