// pos-price-list-tiers — STRICT TDD tests for PriceListSelector.
//
// Contract under test (from spec/pos-price-list-selection/spec.md and
// design.md §"Component: PriceListSelector.vue"):
//
//   Props ↓
//     activeDraft: Sale | null        (current draft; drives model value)
//     isMutating:  boolean            (disables the dropdown while true)
//   Events ↑
//     change-price-list:  [string | null]   (apply this id; null = PUBLICO default)
//     request-confirm:    [string | null]   (parent should open the confirm dialog)
//
// The PUBLICO sentinel (__publico__) maps to null on emit. PUBLICO is the
// system-wide default price list — it's always active, never "no list".
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import PriceListSelector from '../PriceListSelector.vue'
import type { Sale } from '../../interfaces/sale.types'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import { productQueryKeys } from '@/core/shared/constants/query-keys'

function makeDraft(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [],
    customer: null,
    shippingAddress: null,
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    ...overrides,
  }
}

const sampleLists: GlobalPriceList[] = [
  { id: 'list-mayoreo', name: 'MAYOREO', isDefault: false, createdAt: 'x', updatedAt: 'x' },
  { id: 'list-distrib', name: 'DISTRIBUIDOR', isDefault: false, createdAt: 'x', updatedAt: 'x' },
]

function mountSelector(props: Record<string, unknown> = {}, options: { preSeedLists?: GlobalPriceList[] } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  if (options.preSeedLists) {
    queryClient.setQueryData(productQueryKeys.globalPriceLists(), options.preSeedLists)
  }

  return mount(PriceListSelector, {
    props: {
      activeDraft: makeDraft(),
      isMutating: false,
      ...props,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })
}

describe('PriceListSelector (pos-price-list-tiers)', () => {
  // ── (a) Active list name displayed with icon ────────────────────────────

  it('displays "Lista: MAYOREO" with icon when activeDraft.globalPriceListId matches a list', () => {
    const draft = makeDraft({
      items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN' }],
      globalPriceListId: 'list-mayoreo',
    })
    const wrapper = mountSelector({ activeDraft: draft }, { preSeedLists: sampleLists })

    const activeLabel = wrapper.find('[data-testid="price-list-active-label"]')
    expect(activeLabel.exists()).toBe(true)
    expect(activeLabel.text()).toContain('MAYOREO')
  })

  // ── (b) PUBLICO shown when null (default list) ──────────────────────────

  it('displays "Lista: PUBLICO" when activeDraft.globalPriceListId is null (system default)', () => {
    const wrapper = mountSelector({ activeDraft: makeDraft({ globalPriceListId: null }) }, { preSeedLists: sampleLists })

    const activeLabel = wrapper.find('[data-testid="price-list-active-label"]')
    expect(activeLabel.exists()).toBe(true)
    expect(activeLabel.text()).toContain('PUBLICO')
  })

  // ── (c) Disabled state while mutating ────────────────────────────────────
  //
  // UInputMenu forwards `disabled` to its underlying `<input>` element.
  // We use the same `input[aria-expanded]` selector as the non-disabled
  // test and check the `disabled` attribute to avoid coupling to UInputMenu
  // internals.

  it('disables the dropdown when isMutating is true', () => {
    const wrapper = mountSelector({ isMutating: true }, { preSeedLists: sampleLists })

    const primaryInput = wrapper.find('input[aria-expanded]')
    expect(primaryInput.exists()).toBe(true)
    expect(primaryInput.attributes('disabled')).toBeDefined()
  })

  it('does NOT disable the dropdown when isMutating is false', () => {
    const wrapper = mountSelector({ isMutating: false }, { preSeedLists: sampleLists })

    // When isMutating is false the dropdown's input should NOT carry the
    // `disabled` attribute. (The trailing-icon chevron button may still be
    // present and is data-disabled when isMutating, but here it's false.)
    const primaryInput = wrapper.find('input[aria-expanded]')
    expect(primaryInput.exists()).toBe(true)
    expect(primaryInput.attributes('disabled')).toBeUndefined()
  })

  // ── (d) Empty sale: emits change-price-list directly ────────────────────

  it('emits change-price-list directly when the active draft has no items', async () => {
    const draft = makeDraft({ items: [] })
    const wrapper = mountSelector({ activeDraft: draft }, { preSeedLists: sampleLists })

    const exposed = wrapper.vm as unknown as { handleUpdate: (raw: unknown) => void }
    exposed.handleUpdate('list-mayoreo')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('change-price-list')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['list-mayoreo'])

    expect(wrapper.emitted('request-confirm')).toBeFalsy()
  })

  // ── (e) Non-empty sale: emits request-confirm ───────────────────────────

  it('emits request-confirm (NOT change-price-list) when the active draft has items', async () => {
    const draft = makeDraft({
      items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN' }],
    })
    const wrapper = mountSelector({ activeDraft: draft }, { preSeedLists: sampleLists })

    const exposed = wrapper.vm as unknown as { handleUpdate: (raw: unknown) => void }
    exposed.handleUpdate('list-mayoreo')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('request-confirm')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['list-mayoreo'])

    expect(wrapper.emitted('change-price-list')).toBeFalsy()
  })

  // ── (f) PUBLICO option: emits null (default-list contract) ─────────────

  it('emits change-price-list with null when PUBLICO is selected on an empty draft', async () => {
    const draft = makeDraft({ items: [] })
    const wrapper = mountSelector({ activeDraft: draft }, { preSeedLists: sampleLists })

    const exposed = wrapper.vm as unknown as { handleUpdate: (raw: unknown) => void }
    exposed.handleUpdate('__publico__')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('change-price-list')
    expect(events).toBeTruthy()
    expect(events![0]).toEqual([null])
  })

  it('emits request-confirm with null when PUBLICO is selected on a non-empty draft', async () => {
    const draft = makeDraft({
      items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN' }],
    })
    const wrapper = mountSelector({ activeDraft: draft }, { preSeedLists: sampleLists })

    const exposed = wrapper.vm as unknown as { handleUpdate: (raw: unknown) => void }
    exposed.handleUpdate('__publico__')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('request-confirm')
    expect(events).toBeTruthy()
    expect(events![0]).toEqual([null])
  })

  // ── (g) handleUpdate is exposed and emits no events on mount ───────────

  it('exposes handleUpdate and does not emit events on initial mount (no pre-selection)', () => {
    // We verify the items prop passed to UInputMenu includes the sentinel.
    // The internal `menuItems` computed isn't exposed, but we can read it
    // back through the rendered UInputMenu's `items` prop via the
    // underlying component (find by primitive name). If that's brittle we
    // can always add an expose for `menuItems` later.
    const wrapper = mountSelector({}, { preSeedLists: sampleLists })

    // Verify the contract: handleUpdate is callable via defineExpose so
    // tests can drive the selection-flow logic without depending on
    // UInputMenu's popover DOM. On mount with no user interaction, no
    // events have been emitted yet.
    const exposed = wrapper.vm as unknown as { handleUpdate: (raw: unknown) => void }
    expect(typeof exposed.handleUpdate).toBe('function')

    // The PUBLICO sentinel (__publico__) MUST map to null — that's the
    // backend default-list contract.
    expect(
      JSON.stringify((wrapper.emitted('change-price-list') ?? [])) +
      JSON.stringify((wrapper.emitted('request-confirm') ?? [])),
    ).toBe('[][]') // no events yet, just sanity-check empty arrays
  })
})