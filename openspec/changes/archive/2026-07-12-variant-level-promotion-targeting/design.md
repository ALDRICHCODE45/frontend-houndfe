# Design: Variant-Level Promotion Targeting

## Technical Approach

Widen `PromotionTargetType` to add `'VARIANTS'` (single source of truth — REQ-1). The payload path is already generic: `toCreatePayload` (usePromotionForm.ts:168) picks only `{ targetType, targetId }`, so REQ-4 needs no payload code. Visible work concentrates in the target selector (REQ-3), the name resolver (REQ-5), and the error map (REQ-6). REQ-2 is already met by the existing `onAppliesToChange` reset (PromotionForm.vue:151). REQ-7 is an invariant — no POS code touched.

## Architecture Decisions

### Q(a) Variant entry shape → EXTEND with optional `productId?` / `productName?`

| Option | Tradeoff | Decision |
|---|---|---|
| Keep flat `{ targetId, name }` | Chips can't show product context across products (REQ-3 multi-product clarity) | Rejected |
| Extend with **optional** `productId?`, `productName?` | Backward compatible (CATEGORIES/BRANDS/PRODUCTS omit them); `toCreatePayload` already ignores extra keys → no payload leak | **Chosen** |

Optional fields never break existing entries and never reach the payload (the map at usePromotionForm.ts:168 destructures only `targetType`/`targetId`). Chip renders `"{productName} · {name}"` when `productName` present, else `name || targetId`.

### Q(b) Edit-mode hydration → resolvable-only, honest fallback to identifier

Backend `PromotionTargetItem` is `{ id, side, targetType, targetId }` — **no parent product**. `promotionToFormState` (usePromotionForm.ts:124) yields `{ targetId, name: '' }` with no `productId`. There is no `getVariantById`.

| Option | Tradeoff | Decision |
|---|---|---|
| Invent `getVariantById` | Endpoint does not exist | Rejected |
| Brute-force scan all products' variants | N network calls, fragile, slow | Rejected |
| Fall back to `targetId` when parent unknown | Simplest; REQ-5 explicitly allows unchanged fallback; never throws | **Chosen** |

The extended `productId` from Q(a) only survives **within a session** (creation → same-session edit before reload); a fresh edit-mode load from the backend has no productId, so those chips fall back to the variant id. `resolveTargetNames` gains a `case 'VARIANTS'`: entries carrying `productId` resolve names via `getVariants(productId)` (cached); entries without it are returned unchanged. Wrapped in try/catch like the existing `resolveProducts` — MUST NOT throw.

### Q(c) Selector interaction → EXTRACT `ProductVariantSelector.vue` child

| Option | Tradeoff | Decision |
|---|---|---|
| Inline both steps in `PromotionTargetItemsSection.vue` | File already ~193 lines + 3 queries; two-step logic pushes it past the 400-line budget and mixes concerns | Rejected |
| Extract `ProductVariantSelector.vue`, rendered only when `targetType === 'VARIANTS'` | Cohesive, SRP, independently testable; parent keeps its v-model wiring | **Chosen** |

**Contract**: `ProductVariantSelector.vue`
- Props: `selectedItems: PromotionTargetItemFormEntry[]`
- Emits: `update:selectedItems: [items: PromotionTargetItemFormEntry[]]` (identical shape to parent's existing wiring — parent renders it in the `VARIANTS` branch and forwards the event unchanged).
- Internal: product-search query (client-side `hasVariants` filter) → on product pick, variant query → add/remove appends `{ targetId, name, productId, productName }`.

## Data Flow

    URadioGroup(VARIANTS) ─→ onAppliesToChange ─→ appliesTo='VARIANTS', targetItems=[]
    Section ─(VARIANTS)→ ProductVariantSelector
        product step: getPaginated ─→ filter hasVariants===true
        variant step: getVariants(productId) ─→ add {targetId,name,productId,productName}
        emit update:selectedItems ─→ Section ─→ PromotionForm.formState.targetItems
    submit ─→ toCreatePayload ─→ [{ targetType:'VARIANTS', targetId }]

## File Changes

| File | Action | Description |
|---|---|---|
| `interfaces/promotion.types.ts` | Modify | Add `'VARIANTS'` to `PromotionTargetType`; add optional `productId?`/`productName?` to `PromotionTargetItemFormEntry` |
| `composables/usePromotionForm.ts` | Modify | Add `VARIANTS` to `TARGET_TYPE_OPTIONS` ("Variantes"); add `INVALID_TARGET` branch in `mapApiErrorToFields` |
| `components/PromotionTargetItemsSection.vue` | Modify | Add `VARIANTS` to `emptyStateLabel` record + search placeholder ternary (build breaks otherwise); render `ProductVariantSelector` in VARIANTS branch |
| `components/ProductVariantSelector.vue` | Create | Two-step product→variant picker; client-side `hasVariants` filter |
| `composables/usePromotionTargetNames.ts` | Modify | Add `case 'VARIANTS'` in `resolveTargetNames` + `resolveVariants` helper + query key |

## Interfaces / Contracts

```ts
export type PromotionTargetType = 'CATEGORIES' | 'BRANDS' | 'PRODUCTS' | 'VARIANTS'

export interface PromotionTargetItemFormEntry {
  targetId: string
  name: string
  productId?: string   // session-only context, never in payload
  productName?: string
}
```

**Design decisions locked:**
1. **`hasVariants` filter → CLIENT-SIDE** on `Product.hasVariants === true`. `getPaginated` strips non-whitelisted params (product.api.ts:262 note); no evidence backend accepts `hasVariants`. Filter the returned rows.
2. **Query keys**: `['promotions','variants-by-product', productId]`, `staleTime: 60_000` — consistent with `promotionTargetNameQueryKeys.product` (60s) and the section's search keys.
3. **`INVALID_TARGET` location**: `mapApiErrorToFields` (usePromotionForm.ts), returning a **field-level** error on `path: 'targetItems'` — mirrors the existing `DUPLICATE_TARGET` branch (usePromotionForm.ts:347). Form stays editable automatically via UForm `:errors` (no new pattern). Message: `"La variante seleccionada no existe o no pertenece a tu comercio"`.

## Testing Strategy (Strict TDD — RED first)

| REQ | RED test file | Assertion |
|---|---|---|
| REQ-1 | `__tests__/usePromotionForm.test.ts` | `TARGET_TYPE_OPTIONS` includes VARIANTS |
| REQ-4 | `__tests__/usePromotionForm.test.ts` | payload = `[{targetType:'VARIANTS',targetId}]`, no `side`/`id`/`productId` |
| REQ-6 | `__tests__/usePromotionForm.test.ts` | `mapApiErrorToFields({error:'INVALID_TARGET'})` → targetItems field error, Spanish |
| REQ-3 | `components/__tests__/ProductVariantSelector.test.ts` (new) | hasVariants-only search; add variant emits entry; multi-product |
| REQ-2/3 | `__tests__/PromotionTargetItemsSection.test.ts` | VARIANTS renders selector; switch clears items |
| REQ-5 | `__tests__/usePromotionTargetNames.test.ts` | resolvable name shows; unresolvable unchanged; never throws |

Use `src/test/mountWithUApp.ts` — NOT `vi.stubGlobal('useToast')` (@nuxt/ui auto-import shadows it).

## Review-Budget Forecast

Rough estimate: types ~6, options+errormap ~20, section wiring ~30, `ProductVariantSelector.vue` ~140, resolver branch ~30, tests ~120 → **~350 authored lines**. Fits under 400 in **one slice**. If the selector grows, fall back to the proposal's split: (1) types+options+payload+errormap+tests, (2) selector UI+tests, (3) hydration+tests.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Single feature branch, revert removes every `VARIANTS` reference.

## Open Questions

- [ ] Verify `mapApiErrorToFields` receives `error.response.data.error` for `INVALID_TARGET` (confirmed for DUPLICATE_TARGET via PromotionDetailView.vue:120 during apply).
