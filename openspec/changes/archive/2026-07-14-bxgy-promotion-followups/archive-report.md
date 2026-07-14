---
artifact: archive-report
change: bxgy-promotion-followups
project: frontend-houndfe
verdict: PASS_WITH_WARNINGS
mode: openspec
branch: feat/bxgy-promotion-followups (2 commits, local-only)
archived: 2026-07-14
authored_by_phase: sdd-archive
---

# Archive Report — bxgy-promotion-followups

**Change**: `bxgy-promotion-followups`
**Status**: ✅ **COMPLETE, VERIFIED, AND ARCHIVED**
**Archived**: 2026-07-14
**Artifact Mode**: OpenSpec (filesystem) + Engram mirror
**Branch**: `feat/bxgy-promotion-followups` @ `467d751` (2 commits: `0af90fe` F-1, `467d751` F-2)
**Working tree at archive time**: clean (artifacts untracked → committed via this archive)

---

## 1. Executive Summary

`bxgy-promotion-followups` is a complete and verified SDD change that closed two frontend-only follow-ups (F-1 + F-2) to the merged `buy-x-get-y-promotion` work. Backend contracts already shipped; the UI now consumes them: cashiers see **why** a BXGY promo is or isn't applicable (eligibility gate + localized `requiere N unidad(es) más` hint), and confirmed-sale lines now display **which** promotion produced the `discountTitle` (promo-name chip forwarded from `SaleDetailItem.promotionId`). Both slices landed surgical, RED-first, and are coveraged by 118 passing runtime tests; the authoritative `pnpm build` gate is green with zero regressions.

The spec reconciliation pass tightened two words that drifted between the original delta and the verified implementation: **REQ-5** uses strict `=== false` (not loose `!eligible`) on the Aplicar disable gate, and **REQ-8** explicitly carries the defensive `"Promoción"` fallback label for the confirmed-sale chip when `discountTitle` is empty. Both reconciliations were already present in the delta spec read at archive time and are now promoted verbatim to the source-of-truth.

The single WARNING is the pre-existing repo-wide test baseline (18 failures in 5 unrelated files, proven identical on `main`); out of scope for this change and carried forward as a separate work item. Branch is local-only pending remote/PR creation (environmental — no SSH/remote access from the dev machine).

---

## 2. What Shipped

### Slice F-1 — Eligibility UX in PromocionesDisponibles Accordion

| Requirement | Behavior | Surface |
|---|---|---|
| REQ-4 | `ApplicablePromotion` accepts 5 OPTIONAL + nullable fields: `eligible?`, `buyQuantity?`, `getQuantity?`, `unitsNeeded?`, `method?`. Legacy fixtures omitting all five still type-check. | `src/features/POS/sales/interfaces/sale.types.ts` L403-410 |
| REQ-5 | `Aplicar` UButton binds `:disabled="promo.eligible === false"` — STRICT `=== false`. Only an explicit `false` disables; `undefined` and `true` keep the button enabled. Gate is GENERIC on `eligible`, never branches on `promo.type`. | `components/PromocionesDisponiblesAccordion.vue` L166 |
| REQ-6 | When `unitsNeeded != null`, the accordion renders a hint under the title (`promo-hint-${id}` testid) with text `"2x1 · requiere N unidad(es) más"`. Singular/plural agreement on N. Pure helper `buildBxgyHint()` in `utils/promotion.utils.ts`. | `utils/promotion.utils.ts`, accordion L150-159 |

### Slice F-2 — promotionId Forwarding on Confirmed Sale

| Requirement | Behavior | Surface |
|---|---|---|
| REQ-7 | `SaleDetailItem` accepts `promotionId?: string \| null`. Legacy fixtures omitting it still type-check. | `interfaces/sale.types.ts` L84 |
| REQ-8 | `SaleDetailItemsList` forwards `:promotion-id="item.promotionId"` to `SaleItemBadges`. The chip is gated on `hasPromotion = promotionId != null`; falls back to a defensive `"Promoción"` label when `discountTitle` is empty. The `sale-item-remove-promo` button is NOT rendered (confirmed sale never sets `removable`). `SaleItemBadges.vue` was provably UNCHANGED. | `SaleDetailItemsList.vue` L96, `SaleItemBadges.vue` empty git diff |

---

## 3. Commits

| SHA | Type | Subject |
|---|---|---|
| `0af90fe` | feat | `feat(bxgy): surface eligibility + units-needed hint in promotions accordion` (F-1) |
| `467d751` | feat | `feat(bxgy): forward promotionId to confirmed-sale item badges` (F-2) |

Both commits follow the conventional-commit format used by the repo. No AI attribution. No `Co-Authored-By` trailers.

---

## 4. Verification Verdict

**`PASS_WITH_WARNINGS`** — see `verify-report.md` for the full evidence.

| Metric | Value |
|---|---|
| Requirements | 5/5 (REQ-4..REQ-8) |
| Scenarios | 14/14 (13 ✅ full + 1 ⚠️ partial at integration layer, SUGGESTION-only) |
| Build (`pnpm build`) | ✅ exit 0 |
| Targeted tests (5 files) | ✅ 118/118 pass |
| Full repo `pnpm test:unit` | ⚠️ 2523 pass / 18 fail (5 unrelated files — PRE-EXISTING on `main` @ `6122196`) |
| CRITICAL findings | 0 |
| Coherence with design decisions | ✅ 6/6 |
| TDD compliance | ✅ 6/6 |
| Assertion quality | ✅ 0 critical, 0 warning |

**Spec reconciliation at verify time**:
- REQ-5 wording tightened to strict `=== false` (test scenario 3 requires `undefined` stays enabled, so `!eligible` would be wrong).
- REQ-8 carries the defensive `"Promoción"` fallback chip label as accepted user behavior.

Both reconciliations were incorporated into the delta spec before this archive run; the source-of-truth now mirrors them verbatim.

---

## 5. Source-of-Truth Updates (delta sync)

| Domain | File | Action | Details |
|---|---|---|---|
| `sales` | `openspec/specs/sales/spec.md` | EXTENDED | REQ-1..REQ-3 preserved verbatim. REQ-4..REQ-8 APPENDED before the UI Copy section (no renumbering, no collisions). UI Copy section gained 2 new strings: `2x1 · requiere N unidad(es) más` and `Promoción`. |

No other source-of-truth spec was touched. No new domain was created. The delta spec is preserved verbatim under `archive/2026-07-14-bxgy-promotion-followups/specs/sales/spec.md` as the audit trail.

---

## 6. Carry-Forward Notes (WARNINGS — NON-BLOCKING)

1. **W-1 (repo baseline, out-of-scope)**: Full `pnpm test:unit` exits 1 with 18 pre-existing failures in 5 unrelated files:
   - `auth/stores/__tests__/useAuthStore.spec.ts` (2)
   - `POS/promotions/composables/__tests__/usePromotionColumns.test.ts` (2)
   - `POS/sales/components/__tests__/DebtPaymentModal.test.ts` (9)
   - `POS/sales/components/__tests__/SaleDetailMetadataCard.spec.ts` (1)
   - `POS/sales/composables/__tests__/useDebtPayment.test.ts` (4)

   Proven pre-existing on `main @ 6122196` — NOT caused by this change. Keep tracked as a separate work item (proposed follow-up: `sdd-propose` to clean repo-wide test baseline).

2. **W-2 (branch / PR)**: `feat/bxgy-promotion-followups` is local-only. No SSH/remote access from this dev machine, so push + PR creation remain as the user's manual step. The orchestrator must NOT auto-push.

3. **S-1 (REQ-8 scenario 2 — partial coverage, optional)**: The empty-`discountTitle` integration test asserts `promotionId` forwarding + absence of the remove button, but does NOT directly assert the `"Promoción"` fallback chip label at the list layer. The fallback is guaranteed by unchanged `SaleItemBadges.vue` code (L113-130) + build. Optionally add one assertion in `SaleDetailItemsList.test.ts` to make scenario 2 fully covered at the integration layer — non-blocking.

---

## 7. Archive Contents

`openspec/changes/archive/2026-07-14-bxgy-promotion-followups/`:

- ✅ `proposal.md` — Intent, motivation, scope, accepted decisions
- ✅ `design.md` — Architecture decisions, file changes, helper snippet, slice boundaries
- ✅ `explore.md` — Claim-by-claim verification, drift notes
- ✅ `tasks.md` — 27/27 tasks ticked (all implementation complete + environmental steps marked)
- ✅ `verify-report.md` — PASS WITH WARNINGS, evidence sha256 hashes
- ✅ `specs/sales/spec.md` — Delta spec REQ-4..REQ-8 (verbatim, audit trail)
- ✅ `archive-report.md` — This report

Active changes directory no longer contains `bxgy-promotion-followups/`.

---

## 8. SDD Cycle Complete

The change has been fully:

1. **Explored** — claim-by-claim code verification + drift notes captured in `explore.md`
2. **Proposed** — intent, scope, and 5-accepted decisions documented in `proposal.md`
3. **Specified** — delta requirements REQ-4..REQ-8 with scenarios in `specs/sales/spec.md`
4. **Designed** — file changes, helper signature, and design decisions in `design.md`
5. **Tasked** — 27 atomic RED→GREEN→commit tasks in `tasks.md`
6. **Implemented** — `0af90fe` (F-1) + `467d751` (F-2) per `work-unit-commits`
7. **Verified** — `pnpm build` exit 0, 118/118 change-gate tests pass, 5/5 requirements compliant
8. **Archived** — delta synced to source-of-truth, change folder moved to `archive/2026-07-14-bxgy-promotion-followups/`, this report persisted

Ready for the next change.

---

## 9. Engram Mirror

This archive report is mirrored to Engram as `architecture` observation, scope `project`, topic_key `sdd/bxgy-promotion-followups/archive-report`, project `frontend-houndfe`, with `capture_prompt: false` per the SDD artifact rule.
