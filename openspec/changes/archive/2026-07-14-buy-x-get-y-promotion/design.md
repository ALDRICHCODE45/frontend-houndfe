# Design: BUY_X_GET_Y promotion frontend alignment

## Technical Approach

Surgical, frontend-only realignment to the live BXGY engine. No payload-builder or
opt-in-flow changes beyond a type union. Fix flows through six files: schema bound +
guard, form option list + presets, sales types, badge component, list wiring, and the
error mapper. Extract the option list and preset table into `usePromotionForm.ts` so
they are pure, unit-testable data (Extract-Before-Mock). Strict TDD: update the six
existing specs RED-first, then GREEN. Spanish copy, English identifiers.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| `DISCOUNT_PERCENT_OPTIONS` location | Move from `PromotionForm.vue` into `usePromotionForm.ts` as an exported const | Keep inline in SFC | Testable as pure data without mounting; badge/preset semantics unit-covered |
| One option list vs. BXGY/ADVANCED split | Single BXGY-correct list (`0..100`, "Gratis"→100) shared by both selects | Factory producing two lists | ADVANCED is disabled/out-of-scope; its `0..99` guard stays in the schema (bound is enforced there, not by the label list). A shared list keeps blast radius minimal. If ADVANCED is ever re-enabled, add a `capAt99` factory then — not now |
| `rewardKind` badge as prop | Add `rewardKind?` prop to `SaleItemBadges.vue`; render pure, no fetch | Compute inside list | Keeps badge component pure and prop-driven (parity with existing badges) |
| Backward-compat fields | `rewardKind` optional/nullable, mirroring existing nullable traceability fields | Required field | Pre-deploy responses omit it; optional avoids runtime breakage |

## Data Flow

    SaleDetail DTO ──rewardKind──▶ SaleDetailItemsList ──:reward-kind──▶ SaleItemBadges ──▶ GRATIS badge
    Form state ──getDiscountPercent(0..100)──▶ schema(guard) ──▶ toCreatePayload (unchanged) ──▶ POST

## File Change Contracts

**1. `promotion.schema.ts`** (BXGY branch only; ADVANCED untouched)
- Line `:181` bound: `> 99` → `> 100`. Message → `'El descuento debe estar entre 0 y 100 (100 = gratis)'`.
- Add BXGY target guard inside `if (type === 'BUY_X_GET_Y')`: if `!data.appliesTo` → issue `path: ['appliesTo']`, msg `'Debe seleccionar a qué se aplica la promoción'`; if `data.targetItems.length === 0` → issue `path: ['targetItems']`, msg `'Debe seleccionar al menos un producto'`.
- ADVANCED branch `:226-231` stays `0..99` — do NOT touch.

**2. `usePromotionForm.ts`**
- New export `DISCOUNT_PERCENT_OPTIONS` (moved from SFC): `{ label: '5% OFF', value: 5 } … { label: '95% OFF', value: 95 }` in steps of 5, plus `{ label: 'Gratis', value: 100 }`. Drop the inverted `value: 0 → 'Gratis'`.
- `BUY_X_GET_Y_PRESETS` → locked table: `2x1` buy1/get1/100; `3x2` buy2/get1/100; `Segundo al 50%` buy1/get1/50.
- `mapApiErrorToFields`: normalize `const code = input.error?.toUpperCase()` (canonical). Change `DUPLICATE_TARGET` match to compare against canonical (covers `duplicate_target`). Add `FORBIDDEN_FIELD` (toast: `'No se permite modificar ese campo para este tipo de promoción.'`) and `INVALID_FIELD_CHANGE` (toast: `'No se puede cambiar el tipo de una promoción existente.'`).

**3. `PromotionForm.vue`**
- Remove inline `DISCOUNT_PERCENT_OPTIONS` (`:22-28`); import from composable.
- BXGY `PromotionTargetItemsSection` (`:426`): add `:allow-variants="true"` (parity with PRODUCT_DISCOUNT `:323`).

**4. `sale.types.ts`**
- `ApplicablePromotion.type` (`:377`): add `| 'BUY_X_GET_Y'`.
- `SaleDetailItem` (`:56-75`): add `rewardKind?: 'buy_x_get_y' | null`.

**5. `SaleItemBadges.vue`**
- Add prop `rewardKind?: 'buy_x_get_y' | null`. `computed isReward = rewardKind === 'buy_x_get_y'`. Include in `hasAnyBadge`. Render `<AppBadge tone="success" icon="i-lucide-gift" label="GRATIS" data-testid="sale-item-reward-badge">` when `isReward`. Label: `GRATIS`.

**6. `SaleDetailItemsList.vue`**
- Pass `:reward-kind="item.rewardKind"` to `SaleItemBadges` (`:86-95`). No math change — `subtotalCents` already NET.

## Test Strategy (RED-first order)

| Spec file | New cases |
|---|---|
| `promotion.schema.test.ts` | BXGY accepts 100; rejects 101/-1; ADVANCED still rejects 100; missing `appliesTo`/empty `targetItems` → issues |
| `usePromotionForm.test.ts` | `DISCOUNT_PERCENT_OPTIONS` has `{value:100,label:'Gratis'}`, no `value:0`; presets match locked table; `mapApiErrorToFields` FORBIDDEN_FIELD, INVALID_FIELD_CHANGE, case-insensitive `duplicate_target` |
| `PromotionForm.test.ts` | BXGY select can emit 100; BXGY card has `allow-variants` |
| `sale.types.test.ts` | union includes `BUY_X_GET_Y`; `rewardKind` type accepts `'buy_x_get_y'`/`null` |
| `SaleItemBadges.test.ts` | GRATIS badge on `rewardKind==='buy_x_get_y'`; absent otherwise |
| `SaleDetailItemsList.test.ts` | passes `rewardKind` through; reward line renders badge |

## Slicing Suggestion (for sdd-tasks)

- **Slice A — getDiscountPercent semantics**: schema bound/message, `DISCOUNT_PERCENT_OPTIONS` extraction+100, presets. (files 1 partial, 2 partial, 3 partial)
- **Slice B — types + reward badge**: `sale.types.ts` union+`rewardKind`, `SaleItemBadges` badge, `SaleDetailItemsList` wiring. (files 4, 5, 6)
- **Slice C — validation + variants + error mapping**: BXGY target guard, `:allow-variants`, `mapApiErrorToFields` cases. (files 1 partial, 2 partial, 3 partial)

Each slice < 400 changed lines; independently testable.

## Open Questions

None blocking. `duplicate_target` casing confirmed handled via case-insensitive normalization; verify actual backend casing during sdd-verify.
