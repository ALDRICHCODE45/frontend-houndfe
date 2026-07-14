# Tasks: BUY_X_GET_Y promotion frontend alignment

## Review Workload Forecast

| Slice | Lines | 400-risk | Files | Decision before apply |
|-------|------:|----------|-------|-----------------------|
| A — getDiscountPercent semantics | ~80 | Low | 3 M (schema, usePromotionForm, PromotionForm) + 2 spec M | No |
| B — types + reward badge | ~90 | Low | 3 M (sale.types, SaleItemBadges, SaleDetailItemsList) + 3 spec M | No |
| C — validation + variants + error mapping | ~100 | Low | 2 M (schema, usePromotionForm partial) + 1 M (PromotionForm `:allow-variants`) + 3 spec M | No |
| D — draft cart line NET + reward badge + strikethrough fix | ~120 | Low | 2 M (sale.types SaleItem, SaleItemRow) + 2 spec M | No |
| **Total** | **~390** | **Low** | — | — |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A — single branch `feat/buy-x-get-y-promotion`, work-unit commits, merged to `main`
400-line budget risk: Low

Strict TDD: every behavioral task is RED-first (failing spec → GREEN impl). Runner: `pnpm test:unit`. Gate: `pnpm build`. Tests co-located in `__tests__/`. Extract-Before-Mock: `DISCOUNT_PERCENT_OPTIONS` + `BUY_X_GET_Y_PRESETS` live as exported data in `usePromotionForm.ts`.

## Slice A — getDiscountPercent semantics
*REQ-8 (BXGY bound 0..100), REQ-9 (ADVANCED regression 0..99), REQ-10 (locked presets)*

- [ ] **A.1 RED** `promotion.schema.test.ts`: flip the existing "rejects 100" test to ADVANCED (regression pin); add BXGY accepts `getDiscountPercent: 100`; assert message includes `100 = gratis`.
- [ ] **A.2 RED** `usePromotionForm.test.ts`: assert `DISCOUNT_PERCENT_OPTIONS` contains `{value:100,label:'Gratis'}` and NO `value:0` entry; assert preset table matches locked values (`2x1`→1/1/100, `3x2`→2/1/100, `Segundo al 50%`→1/1/50).
- [ ] **A.3 GREEN** `promotion.schema.ts` BXGY branch `:175-188`: bound `> 99` → `> 100`; message → `'El descuento debe estar entre 0 y 100 (100 = gratis)'`. ADVANCED branch untouched.
- [ ] **A.4 GREEN** `usePromotionForm.ts`: extract `DISCOUNT_PERCENT_OPTIONS` as exported const (5..95 in steps of 5 + `{label:'Gratis',value:100}`); replace `BUY_X_GET_Y_PRESETS` with the locked table.
- [ ] **A.5 GREEN** `PromotionForm.vue` `:22-28`: delete inline `DISCOUNT_PERCENT_OPTIONS`; import from `usePromotionForm`. `pnpm test:unit` green.

Commit A: `feat(promotions): align BXGY getDiscountPercent semantics and presets`

## Slice B — types + reward badge
*sales REQ-1 (union), sales REQ-2 (GRATIS reward badge)*

- [ ] **B.1 RED** `sale.types.test.ts`: assert `ApplicablePromotion.type` accepts `'BUY_X_GET_Y'`; assert `SaleDetailItem.rewardKind` accepts `'buy_x_get_y'` and `null`, optional.
- [ ] **B.2 RED** `SaleItemBadges.test.ts`: assert `data-testid="sale-item-reward-badge"` with label `GRATIS` renders when `rewardKind==='buy_x_get_y'`; absent when `null` or omitted.
- [ ] **B.3 RED** `SaleDetailItemsList.test.ts`: assert `rewardKind` is forwarded; reward line surfaces GRATIS badge.
- [ ] **B.4 GREEN** `sale.types.ts` `:377`: union += `'BUY_X_GET_Y'`; `SaleDetailItem` `:56-75` add `rewardKind?: 'buy_x_get_y' | null`.
- [ ] **B.5 GREEN** `SaleItemBadges.vue`: add `rewardKind?` prop, `computed isReward`, include in `hasAnyBadge`, render `<AppBadge tone="success" icon="i-lucide-gift" label="GRATIS" data-testid="sale-item-reward-badge">` when `isReward`.
- [ ] **B.6 GREEN** `SaleDetailItemsList.vue` `:86-95`: bind `:reward-kind="item.rewardKind"`. `pnpm test:unit` green.

Commit B: `feat(sales): surface BXGY reward badge on confirmed sale lines`

## Slice C — validation + variants + error mapping
*REQ-11 (BXGY target guard), REQ-12 (error mapping), REQ-1 MODIFIED (VARIANTS for BXGY)*

- [ ] **C.1 RED** `promotion.schema.test.ts`: assert BXGY with `appliesTo:''` issues `path:['appliesTo']` msg `'Debe seleccionar a qué se aplica la promoción'`; `targetItems:[]` issues `path:['targetItems']` msg `'Debe seleccionar al menos un producto'`.
- [ ] **C.2 RED** `usePromotionForm.test.ts`: add three cases — `mapApiErrorToFields({error:'FORBIDDEN_FIELD'})` → Spanish toast, zero field errors; `INVALID_FIELD_CHANGE` → its Spanish toast; `duplicate_target` (lowercase) maps identically to `DUPLICATE_TARGET` (case-insensitive).
- [ ] **C.3 RED** `PromotionForm.test.ts`: assert BXGY card's `PromotionTargetItemsSection` receives `allowVariants: true`.
- [ ] **C.4 GREEN** `promotion.schema.ts` BXGY branch: add `!data.appliesTo` guard and `targetItems.length === 0` guard with the Spanish messages.
- [ ] **C.5 GREEN** `usePromotionForm.ts` `mapApiErrorToFields`: normalize code with `.toUpperCase()` once at top; add `FORBIDDEN_FIELD` toast `'No se permite modificar ese campo para este tipo de promoción.'`; add `INVALID_FIELD_CHANGE` toast `'No se puede cambiar el tipo de una promoción existente.'`; compare `DUPLICATE_TARGET` against canonical.
- [ ] **C.6 GREEN** `PromotionForm.vue` BXGY card `:426-432`: add `:allow-variants="true"` to `PromotionTargetItemsSection`. `pnpm test:unit` green.

Commit C: `feat(promotions): harden BXGY target validation and error mapping`

## Slice D — draft cart line NET + reward badge + strikethrough fix
*sales REQ-3 (unified NET contract + reward badge on draft cart line)*

The backend now ADDITIVELY returns `subtotalCents` (NET per line) and `rewardKind` on every draft sale line response (`GET /sales/drafts/:id` + every mutation). Backend semantics: `unitPriceCents === prePriceCentsBeforeDiscount` on BXGY lines (the reward is line-level, not unit-level); strike the unit price ONLY when `unitPriceCents < prePriceCentsBeforeDiscount`; use `rewardKind === 'buy_x_get_y'` for the reward/GRATIS badge.

- [ ] **D.1 RED** `sale.types.test.ts`: assert `SaleItem` accepts `subtotalCents: number | null` and `rewardKind: 'buy_x_get_y' | null` (3 cases: BXGY with both fields, non-reward with null rewardKind, legacy omitted).
- [ ] **D.2 RED** `SaleItemRow.test.ts`: 4 cases — BXGY (NET $200, struck $400, NO unit-strike, GRATIS badge), cashier discount (NET $80, struck $96, unit-strike present, NO GRATIS), no-discount (NET $100, no struck, no unit-strike, no GRATIS), pre-deploy fallback (gross renders when subtotalCents missing).
- [ ] **D.3 GREEN** `sale.types.ts` `SaleItem`: add `subtotalCents?: number | null` and `rewardKind?: 'buy_x_get_y' | null` (both optional + nullable for pre-deploy backward compat, mirroring `SaleDetailItem`).
- [ ] **D.4 GREEN** `SaleItemRow.vue`: introduce `lineDisplay` computed with the unified contract (`grossPerUnit`/`grossLine`/`netLine`/`showStruckGross`); add `data-testid="sale-item-line-net"` on bold, `data-testid="sale-item-line-gross-strike"` on struck; tighten `showPriceOrigin` to require `originalPriceCents > unitPriceCents`; tighten `showDiscountOrigin` to require `prePriceCentsBeforeDiscount > unitPriceCents`; add `data-testid="sale-item-unit-strike-original"` and `data-testid="sale-item-unit-strike-pre-discount"`; forward `:reward-kind="item.rewardKind"` to `SaleItemBadges`. `pnpm test:unit` green.
- [ ] **D.5** spec.md: append REQ-3 (unified contract + 5 scenarios). tasks.md: add Slice D section.

Commit D: `feat(sales): render draft BXGY line NET and reward badge from backend fields`

## Final Verification

- [ ] V.1 `pnpm test:unit` — all 8 affected specs green, no pending RED cases.
- [ ] V.2 `pnpm build` — type-check + bundle pass.
- [ ] V.3 Manual: create `2x1` BXGY end-to-end; payload emits `getDiscountPercent: 100`; sale line shows GRATIS badge; draft cart line shows NET + struck gross without unit-price strikethrough.
- [ ] V.4 `git status` clean per slice; each slice is one conventional commit (no AI attribution).
- [ ] V.5 Merge `feat/buy-x-get-y-promotion` → `main` (single merge at branch end).