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

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getCategories: (...args: unknown[]) => getCategoriesMock(...args),
    getBrands: (...args: unknown[]) => getBrandsMock(...args),
    getById: (...args: unknown[]) => getByIdMock(...args),
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
})
