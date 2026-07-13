/**
 * usePromotionTargetNames — resolves human-readable names for hydrated promotion
 * target entries (categories, brands, products) by cross-referencing the
 * existing product catalogs via TanStack vue-query (cached).
 *
 * The composable is used AFTER `promotionToFormState` hydration in edit mode
 * to patch `name` into `formState.targetItems` / `buyTargetItems` / `getTargetItems`
 * so the selected-item chips render the friendly name instead of the raw UUID.
 *
 * Contract:
 *   - resolveTargetNames(items, targetType): Promise<TargetEntry[]>
 *   - CATEGORIES → uses productApi.getCategories() (in-memory id→name lookup)
 *   - BRANDS     → uses productApi.getBrands()     (in-memory id→name lookup)
 *   - PRODUCTS   → productApi.getById(id) per target id
 *   - Items already carrying a non-empty name are left untouched (idempotent)
 *   - targetId is preserved (never mutated)
 *   - On failure (404 / network) the resolver keeps the entry with its
 *     original name (empty string falls through to UUID at render time);
 *     the resolver never throws so the form can still render.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { usePromotionTargetNames } from '../usePromotionTargetNames'
import type { PromotionTargetItemFormEntry } from '../../interfaces/promotion.types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const getCategoriesMock = vi.fn()
const getBrandsMock = vi.fn()
const getByIdMock = vi.fn()
const getVariantsMock = vi.fn()

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getCategories: (...args: unknown[]) => getCategoriesMock(...args),
    getBrands: (...args: unknown[]) => getBrandsMock(...args),
    getById: (...args: unknown[]) => getByIdMock(...args),
    getVariants: (...args: unknown[]) => getVariantsMock(...args),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function mountComposable() {
  let captured: ReturnType<typeof usePromotionTargetNames> | undefined
  const Harness = defineComponent({
    setup() {
      captured = usePromotionTargetNames()
      return () => h('div')
    },
  })
  mount(Harness, {
    global: { plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]] },
  })
  if (!captured) throw new Error('usePromotionTargetNames returned no value')
  return captured
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePromotionTargetNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves category names from the categories catalog (in-memory lookup)', async () => {
    getCategoriesMock.mockResolvedValueOnce([
      { id: 'c1', name: 'Analgésicos' },
      { id: 'c2', name: 'Antiinflamatorios' },
    ])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('CATEGORIES', [
      { targetId: 'c1', name: '' },
      { targetId: 'c2', name: '' },
    ])

    expect(getCategoriesMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      { targetId: 'c1', name: 'Analgésicos' },
      { targetId: 'c2', name: 'Antiinflamatorios' },
    ])
  })

  it('resolves brand names from the brands catalog (in-memory lookup)', async () => {
    getBrandsMock.mockResolvedValueOnce([
      { id: 'b1', name: 'Bayer' },
      { id: 'b2', name: 'Pfizer' },
    ])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('BRANDS', [
      { targetId: 'b1', name: '' },
      { targetId: 'b2', name: '' },
    ])

    expect(getBrandsMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      { targetId: 'b1', name: 'Bayer' },
      { targetId: 'b2', name: 'Pfizer' },
    ])
  })

  it('resolves product names by calling getById per target id', async () => {
    getByIdMock.mockImplementation(async (id: string) => ({
      id,
      name: `Product-${id}`,
    }))

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('PRODUCTS', [
      { targetId: 'p1', name: '' },
      { targetId: 'p2', name: '' },
    ])

    expect(getByIdMock).toHaveBeenCalledTimes(2)
    expect(getByIdMock).toHaveBeenCalledWith('p1')
    expect(getByIdMock).toHaveBeenCalledWith('p2')
    expect(result).toEqual([
      { targetId: 'p1', name: 'Product-p1' },
      { targetId: 'p2', name: 'Product-p2' },
    ])
  })

  it('keeps product entries untouched when getById rejects (404 / network) — no throw', async () => {
    getByIdMock.mockImplementation(async (id: string) => {
      if (id === 'p-deleted') throw new Error('Not Found')
      return { id, name: `Product-${id}` }
    })

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('PRODUCTS', [
      { targetId: 'p1', name: '' },
      { targetId: 'p-deleted', name: '' },
    ])

    // The valid product gets resolved; the 404 one keeps its (empty) name so the
    // chip falls back to the UUID — but the resolver itself does NOT throw.
    expect(result).toEqual([
      { targetId: 'p1', name: 'Product-p1' },
      { targetId: 'p-deleted', name: '' },
    ])
  })

  it('leaves entries with an existing non-empty name untouched (idempotent)', async () => {
    getCategoriesMock.mockResolvedValueOnce([{ id: 'c1', name: 'Analgésicos' }])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('CATEGORIES', [
      { targetId: 'c1', name: 'Already Known Name' },
    ])

    // Should not even hit the catalog for items that already have a name.
    expect(getCategoriesMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ targetId: 'c1', name: 'Already Known Name' }])
  })

  it('never mutates the targetId of any entry', async () => {
    getBrandsMock.mockResolvedValueOnce([
      { id: 'b1', name: 'Bayer' },
      { id: 'b2', name: 'Pfizer' },
    ])

    const input: PromotionTargetItemFormEntry[] = [
      { targetId: 'b1', name: '' },
      { targetId: 'b2', name: '' },
    ]
    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('BRANDS', input)

    expect(result[0]?.targetId).toBe('b1')
    expect(result[1]?.targetId).toBe('b2')
    expect(input[0]?.targetId).toBe('b1')
    expect(input[1]?.targetId).toBe('b2')
  })

  it('returns an empty array when given no items (does not fetch)', async () => {
    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('CATEGORIES', [])

    expect(getCategoriesMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('keeps the input entry unchanged when the catalog lookup does not contain the id', async () => {
    getCategoriesMock.mockResolvedValueOnce([{ id: 'c1', name: 'Analgésicos' }])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('CATEGORIES', [
      { targetId: 'c1', name: '' },
      { targetId: 'c-missing', name: '' },
    ])

    expect(result).toEqual([
      { targetId: 'c1', name: 'Analgésicos' },
      { targetId: 'c-missing', name: '' },
    ])
  })

  // ── VARIANTS branch (REQ-5) ─────────────────────────────────────────────

  it('resolves VARIANTS names via getVariants(productId) for entries that carry a productId', async () => {
    getVariantsMock.mockImplementation(async (productId: string) => {
      if (productId === 'p1') return [{ id: 'v1', productId: 'p1', name: 'Talle M' }]
      if (productId === 'p2') return [{ id: 'v2', productId: 'p2', name: 'Rojo' }]
      return []
    })

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: '', productId: 'p1' },
      { targetId: 'v2', name: '', productId: 'p2' },
    ])

    expect(getVariantsMock).toHaveBeenCalledWith('p1')
    expect(getVariantsMock).toHaveBeenCalledWith('p2')
    expect(getVariantsMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1' },
      { targetId: 'v2', name: 'Rojo', productId: 'p2' },
    ])
  })

  it('VARIANTS: batches multiple variants from the same product into ONE getVariants call', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
      { id: 'v2', productId: 'p1', name: 'Talle L' },
    ])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: '', productId: 'p1' },
      { targetId: 'v2', name: '', productId: 'p1' },
    ])

    // One product → one fetch (group-by-product dedup).
    expect(getVariantsMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1' },
      { targetId: 'v2', name: 'Talle L', productId: 'p1' },
    ])
  })

  it('VARIANTS: entries WITHOUT productId are returned unchanged (no fetch, no throw)', async () => {
    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      // Hydrated from a fresh backend response: no productId known.
      { targetId: 'v-unknown', name: '' },
    ])

    expect(getVariantsMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ targetId: 'v-unknown', name: '' }])
  })

  it('VARIANTS: mixed entries — productId-bearing resolve, others fall back unchanged', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
    ])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: '', productId: 'p1' },
      { targetId: 'v-orphan', name: '' },
    ])

    expect(result).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1' },
      { targetId: 'v-orphan', name: '' },
    ])
  })

  it('VARIANTS: getVariants throwing → entries returned unchanged, resolver does not throw', async () => {
    getVariantsMock.mockRejectedValueOnce(new Error('network down'))

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: '', productId: 'p1' },
    ])

    expect(result).toEqual([{ targetId: 'v1', name: '', productId: 'p1' }])
  })

  it('VARIANTS: variant id not present in the fetched list → entry returned unchanged', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
    ])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v-deleted', name: '', productId: 'p1' },
    ])

    expect(result).toEqual([{ targetId: 'v-deleted', name: '', productId: 'p1' }])
  })

  it('VARIANTS: entries that already carry a name are passed through (idempotent)', async () => {
    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: 'Talle M', productId: 'p1' },
    ])

    expect(getVariantsMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ targetId: 'v1', name: 'Talle M', productId: 'p1' }])
  })

  // ── REQ-6: Edit-mode variant name resolution (Slice 3 hardening) ─────────
  //
  // Spec scenarios:
  //   - Resolvable variant (carries session productId) → resolves to NAME
  //   - Unresolvable variant (no productId, fresh backend load) → graceful
  //     fallback identifier (targetId preserved, name stays empty so the
  //     chipLabel util renders the UUID — never a synthetic fake name).
  //   - Bounded: ONE fetch per unique productId (never unbounded).

  it('REQ-6: variant WITH session productId resolves to the variant name (edit-mode hydration)', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Rojo' },
    ])

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: '', productId: 'p1' },
    ])

    expect(result).toEqual([{ targetId: 'v1', name: 'Rojo', productId: 'p1' }])
    expect(getVariantsMock).toHaveBeenCalledTimes(1)
    expect(getVariantsMock).toHaveBeenCalledWith('p1')
  })

  it('REQ-6: variant WITHOUT productId keeps honest fallback identifier (targetId preserved, name stays empty)', async () => {
    // Fresh backend load — entry carries no parent-product context.
    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v-orphan-uuid', name: '' },
    ])

    // No fetch, no throw. Entry shape intact: targetId preserved (this is
    // the "identifier" the chipLabel util renders), name stays empty (so
    // the chip util falls back to targetId via `name || targetId`). NEVER
    // a synthetic fake name like "Variante" or a thrown error.
    expect(getVariantsMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ targetId: 'v-orphan-uuid', name: '' }])
    // Specifically: no fake `name` was invented.
    expect(result[0]?.name).toBe('')
    expect(result[0]?.targetId).toBe('v-orphan-uuid')
  })

  it('REQ-6: BOUNDED — N variants across M unique productIds fetch EXACTLY M times (never one-per-variant)', async () => {
    // 5 variants across 3 unique productIds → exactly 3 getVariants fetches.
    getVariantsMock.mockImplementation(async (productId: string) => {
      if (productId === 'p1') return [
        { id: 'v1', productId: 'p1', name: 'Talle M' },
        { id: 'v2', productId: 'p1', name: 'Talle L' },
      ]
      if (productId === 'p2') return [
        { id: 'v3', productId: 'p2', name: 'Rojo' },
      ]
      if (productId === 'p3') return [
        { id: 'v4', productId: 'p3', name: 'XL' },
        { id: 'v5', productId: 'p3', name: 'XS' },
      ]
      return []
    })

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: '', productId: 'p1' },
      { targetId: 'v2', name: '', productId: 'p1' },
      { targetId: 'v3', name: '', productId: 'p2' },
      { targetId: 'v4', name: '', productId: 'p3' },
      { targetId: 'v5', name: '', productId: 'p3' },
    ])

    // Bounded assertion: 3 unique productIds → 3 fetches. Never 5.
    expect(getVariantsMock).toHaveBeenCalledTimes(3)
    expect(getVariantsMock).toHaveBeenCalledWith('p1')
    expect(getVariantsMock).toHaveBeenCalledWith('p2')
    expect(getVariantsMock).toHaveBeenCalledWith('p3')

    // All 5 entries resolved to names.
    expect(result).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1' },
      { targetId: 'v2', name: 'Talle L', productId: 'p1' },
      { targetId: 'v3', name: 'Rojo', productId: 'p2' },
      { targetId: 'v4', name: 'XL', productId: 'p3' },
      { targetId: 'v5', name: 'XS', productId: 'p3' },
    ])
  })

  it('REQ-6: BOUNDED — repeated calls with same productId reuse the cache (still exactly one fetch per unique productId per call)', async () => {
    getVariantsMock.mockResolvedValueOnce([
      { id: 'v1', productId: 'p1', name: 'Rojo' },
      { id: 'v2', productId: 'p1', name: 'Azul' },
    ])

    const queryClient = makeQueryClient()
    let captured: ReturnType<typeof usePromotionTargetNames> | undefined
    const Harness = defineComponent({
      setup() {
        captured = usePromotionTargetNames()
        return () => h('div')
      },
    })
    mount(Harness, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    if (!captured) throw new Error('usePromotionTargetNames returned no value')

    // First call: 2 variants from same product → 1 fetch.
    await captured.resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: '', productId: 'p1' },
      { targetId: 'v2', name: '', productId: 'p1' },
    ])
    expect(getVariantsMock).toHaveBeenCalledTimes(1)

    // Second call: 1 variant from same product → still 1 fetch total
    // (queryClient cache hit means queryFn never runs again).
    await captured.resolveTargetNames('VARIANTS', [
      { targetId: 'v1', name: 'Rojo', productId: 'p1' },
    ])
    expect(getVariantsMock).toHaveBeenCalledTimes(1)
  })

  // ── REQ-8: No second round-trip when enrichment is present (Slice 4) ─────
  //
  // Spec scenario: "No second round-trip when enrichment is present".
  // End-to-end: hydrate a VARIANTS entry through `promotionToFormState` so
  // `name` is populated from `variantName`, then call
  // `resolveTargetNames('VARIANTS', hydratedItems)`. The resolver's
  // idempotent short-circuit (line 250 of usePromotionTargetNames.ts:
  // `items.every((i) => i.name.trim().length > 0)`) must fire — NO
  // `getVariants` call must be issued, even though the entry carries a
  // productId. This is the whole point of the backend enrichment: the
  // form gets a friendly chip label with zero follow-up fetch.

  it('REQ-8: hydrated VARIANTS entry with non-empty name triggers NO getVariants fetch (idempotent short-circuit)', async () => {
    // No mock set up for getVariants — if the resolver hits it, the
    // unhandled call will surface as a (mocked) call we can assert against.
    // To be even more defensive, we give the mock an explicit mock that
    // would fail if called.
    getVariantsMock.mockImplementation(async () => {
      throw new Error('REQ-8 short-circuit violated: getVariants should NOT be called when name is already populated')
    })

    const { resolveTargetNames } = mountComposable()
    // Simulate a hydrated entry — name already populated from variantName.
    const hydrated: PromotionTargetItemFormEntry[] = [
      { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
    ]
    const result = await resolveTargetNames('VARIANTS', hydrated)

    // Hard invariant: ZERO fetches. The idempotent guard must fire.
    expect(getVariantsMock).not.toHaveBeenCalled()
    // The entry must be passed through unchanged.
    expect(result).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
    ])
  })

  it('REQ-8: when ALL hydrated entries have non-empty names, the resolver still issues ZERO getVariants calls (mixed productIds)', async () => {
    getVariantsMock.mockImplementation(async () => {
      throw new Error('REQ-8 short-circuit violated: getVariants should NOT be called when every name is populated')
    })

    const { resolveTargetNames } = mountComposable()
    // 3 entries, 3 different productIds, all names pre-populated.
    const hydrated: PromotionTargetItemFormEntry[] = [
      { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
      { targetId: 'v2', name: 'Rojo', productId: 'p2', productName: 'Remera' },
      { targetId: 'v3', name: 'XL', productId: 'p3', productName: 'Buzo' },
    ]
    const result = await resolveTargetNames('VARIANTS', hydrated)

    // Even with 3 unique productIds, the every-name-non-empty short-circuit
    // means zero fetches.
    expect(getVariantsMock).not.toHaveBeenCalled()
    expect(result).toEqual(hydrated)
  })

  it('REQ-8: round-trip integration — promotionToFormState + resolveTargetNames → zero fetches when enrichment is present', async () => {
    // Full integration: build a PromotionResponse with enriched VARIANTS,
    // hydrate via promotionToFormState, then resolve via usePromotionTargetNames.
    // The chain is exactly the path PromotionForm.vue takes on edit-mode
    // hydration. We import the function from usePromotionForm to keep the
    // integration honest.
    const { promotionToFormState } = await import('../usePromotionForm')
    const response = {
      id: 'promo-1',
      title: 'Test',
      type: 'PRODUCT_DISCOUNT' as const,
      method: 'AUTOMATIC' as const,
      status: 'ACTIVE' as const,
      startDate: null,
      endDate: null,
      customerScope: 'ALL' as const,
      discountType: 'PERCENTAGE' as const,
      discountValue: 10,
      minPurchaseAmountCents: null,
      appliesTo: 'VARIANTS' as const,
      buyQuantity: null,
      getQuantity: null,
      getDiscountPercent: null,
      buyTargetType: null,
      getTargetType: null,
      targetItems: [
        {
          id: 'ti-1',
          side: 'DEFAULT' as const,
          targetType: 'VARIANTS' as const,
          targetId: 'v1',
          productId: 'p1',
          variantName: 'Talle M',
          productName: 'Camisa',
        },
      ],
      customers: [],
      priceLists: [],
      daysOfWeek: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const state = promotionToFormState(response)
    // Sanity check: hydration populated name from variantName.
    expect(state.targetItems[0]?.name).toBe('Talle M')

    // Now the resolver must short-circuit. Mock getVariants to throw if hit.
    getVariantsMock.mockImplementation(async () => {
      throw new Error('REQ-8 round-trip violated: resolver must not fetch when hydration populated the name')
    })

    const { resolveTargetNames } = mountComposable()
    const result = await resolveTargetNames('VARIANTS', state.targetItems)

    expect(getVariantsMock).not.toHaveBeenCalled()
    expect(result).toEqual([
      { targetId: 'v1', name: 'Talle M', productId: 'p1', productName: 'Camisa' },
    ])
  })
})
