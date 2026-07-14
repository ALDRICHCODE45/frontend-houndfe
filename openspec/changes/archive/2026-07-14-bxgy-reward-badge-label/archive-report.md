---
artifact: archive-report
change: bxgy-reward-badge-label
project: frontend-houndfe
verdict: PASS_WITH_WARNINGS
mode: openspec
branch: feat/bxgy-reward-badge-label (2 implementation commits, local-only)
archived: 2026-07-14
authored_by_phase: sdd-archive
---

# Archive Report — bxgy-reward-badge-label

**Change**: `bxgy-reward-badge-label`
**Status**: **COMPLETE, VERIFIED, AND ARCHIVED**
**Artifact mode**: OpenSpec filesystem with Engram mirror
**Branch**: `feat/bxgy-reward-badge-label`
**Archive date**: 2026-07-14

## Executive Summary

`bxgy-reward-badge-label` replaces the hardcoded BXGY reward badge label with a
percent-aware rule driven by the backend-provided `rewardDiscountPercent` field.
Both `SaleItem` and `SaleDetailItem` now carry the optional, nullable field;
`SaleItemBadges` computes the label through the pure `getRewardBadgeLabel`
helper; and both draft-cart and confirmed-sale surfaces forward the field.

The shipped behavior is deterministic: a 100% BXGY reward renders `GRATIS`, a
positive partial discount renders `-N%` (for example `-50%`), and a null,
omitted, zero, or negative percent renders no reward badge. The existing green
`success` tone, `i-lucide-gift` icon, test id, and backend-provided NET subtotal
behavior remain unchanged.

The change passed verification. The five target test files pass **146/146**;
the branch adds **+12 net passing tests** compared with `main`, with **0 new
failures**. The full-suite failures are the same 18 pre-existing failures on
both branch and `main`.

## What Shipped

| Requirement | Delivered behavior | Surface/files |
|---|---|---|
| REQ-2 (modified) | Confirmed-sale reward labels are driven by `rewardDiscountPercent`: 100 → `GRATIS`, positive partial → `-N%`, null/omitted/invalid non-positive → no badge; NET `subtotalCents` remains backend-authoritative. | `SaleDetailItemsList.vue`, `SaleItemBadges.vue` |
| REQ-3 (modified) | Draft cart accepts and forwards the percent field while retaining the unified NET/gross and unit-strikethrough contract. | `SaleItemRow.vue`, `sale.types.ts` |
| REQ-9 (added) | `SaleItem` and `SaleDetailItem` accept mirrored `rewardDiscountPercent?: number \| null`. | `interfaces/sale.types.ts` |
| REQ-10 (added) | Pure `getRewardBadgeLabel` helper drives the badge and preserves tone, icon, and test id. | `utils/promotion.utils.ts`, `SaleItemBadges.vue` |
| REQ-11 (added) | Draft and confirmed surfaces forward the field and render identical labels for identical payloads. | `SaleItemRow.vue`, `SaleDetailItemsList.vue` |

### Explicit product decision

`rewardDiscountPercent <= 0` returns `null` from `getRewardBadgeLabel` and
therefore renders no reward badge. This is the authoritative defensive rule for
this change: never render `-0%`, never assume `GRATIS` when the field is absent,
and never infer the reward label from client-side price math.

## Implementation Commits

| SHA | Type | Subject |
|---|---|---|
| `0665ce3` | feat | `feat(sales): make BXGY reward badge percent-aware` |
| `6252b48` | style | `style(sales): fix badge prop indentation in sale item rows` |

Both implementation commits are conventional commits. Neither contains AI
attribution or a `Co-Authored-By` trailer. This archive phase creates one
additional conventional documentation commit containing the synced spec,
ticked tasks, archive report, and moved change folder. The branch remains
unmerged and unpushed; SSH/remote access is unavailable and merge/PR handling
belongs to the orchestrator/user.

## Verification Verdict

**PASS** — no CRITICAL or WARNING findings. The verify report recorded one
non-blocking cosmetic indentation suggestion; it was addressed by `6252b48`.

| Gate/evidence | Result |
|---|---|
| Focused target tests (5 files) | **146/146 passed** |
| Full branch unit suite | 2535 passed / 18 failed / 2553 total |
| `main` baseline unit suite | 2523 passed / 18 failed / 2541 total |
| Net test delta | **+12 passing tests**, **0 new regressions** |
| `pnpm build` | **PASS** (`✓ built in 12.10s`) |
| Requirement verdict | REQ-2, REQ-3, REQ-9, REQ-10, REQ-11: **5/5 PASS** |

The 18 failures are identical on branch and `main`, confined to unrelated
baseline files (`useAuthStore.spec.ts`, `usePromotionColumns.test.ts`,
`useDebtPayment.test.ts`, `DebtPaymentModal.test.ts`, and
`SaleDetailMetadataCard.spec.ts`). They are not attributable to this change.

## Source-of-Truth Spec Sync

| Domain | Action | Details |
|---|---|---|
| `sales` | **MODIFIED + EXTENDED** | REQ-2 and REQ-3 were replaced with the percent-aware wording from the delta. REQ-9, REQ-10, and REQ-11 were appended after REQ-8 and before UI Copy. Existing REQ-1 and REQ-4..REQ-8 were preserved; no requirement was renumbered. |
| `sales` UI Copy | **EXTENDED** | Added the `-N%` partial-discount reward label alongside `GRATIS`; existing Spanish copy remains intact. |

The delta spec remains verbatim in the archived change folder as the audit
trail. No source code was changed during the archive phase.

## Task Completion Reconciliation

`tasks.md` initially contained stale unchecked Phase 3 boxes (3.1–3.4), while
`verify-report.md` independently proved the refactor, test gate, build gate, and
implementation commit were complete. Per the orchestrator's explicit archive
instruction, those four boxes were marked `[x]` before the folder move. The
reconciliation is mechanical only and is backed by the PASS verification
report, 146/146 focused tests, green build, and implementation commits
`0665ce3` and `6252b48`. The archived task artifact contains no unchecked
implementation tasks.

## Carry-Forward Notes

1. **W-1 — pre-existing test baseline**: The 18 unrelated full-suite failures
   remain documented and unchanged. They were reproduced on `main` and are not
   regressions from this change.
2. **W-2 — branch/PR**: `feat/bxgy-reward-badge-label` is local-only pending
   remote push and PR creation. Do not push from this environment; the
   orchestrator/user owns that step and the merge.
3. **B-1 — undecided backlog**: `reapply-removed-auto-promo` (#2846) remains a
   product backlog item and is explicitly not implemented here. It concerns
   re-applying an auto-applied promotion after the cashier removes it from a
   sale line; it requires a separate decision and SDD cycle.
4. The two earlier BXGY product follow-ups (insufficient-quantity opt-in UX and
   confirmed-line promotion naming) belong to the already archived
   `bxgy-promotion-followups` change and are not reopened by this archive.

## Archive Contents

`openspec/changes/archive/2026-07-14-bxgy-reward-badge-label/` contains:

- `proposal.md` — intent, scope, and accepted decisions
- `design.md` — helper, data-flow, and architecture decisions
- `tasks.md` — all Phase 1–3 tasks checked
- `verify-report.md` — independent PASS evidence
- `specs/sales/spec.md` — delta spec preserved verbatim
- `archive-report.md` — this report

The active changes directory no longer contains
`bxgy-reward-badge-label/` after the archive move.

## SDD Cycle Complete

The change has been planned, specified, designed, implemented, verified, and
archived. The canonical sales specification now reflects percent-aware BXGY
reward labels, and the complete OpenSpec change history is preserved under the
ISO-dated archive folder.

## Engram Mirror

This report is mirrored to Engram as an `architecture` observation in project
`frontend-houndfe`, scope `project`, with topic key
`sdd/bxgy-reward-badge-label/archive-report` and `capture_prompt: false`.
