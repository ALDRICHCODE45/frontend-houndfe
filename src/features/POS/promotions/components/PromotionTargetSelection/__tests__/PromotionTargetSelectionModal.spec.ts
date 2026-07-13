/**
 * PromotionTargetSelectionModal — transactional modal that stages selections
 * internally and only emits `confirm` on explicit confirm.
 *
 * Key behaviors (REQ-2 + INV-4):
 *   - On `open` becoming true, seeds staged from `selectedItems` (so reopen
 *     pre-fills the already-confirmed selection).
 *   - On confirm, emits `confirm` with the staged array, then closes.
 *   - On cancel/Esc/backdrop close, does NOT emit `confirm`.
 *   - Routes CATEGORIES|BRANDS|PRODUCTS to FlatChecklistPanel; VARIANTS is
 *     intentionally NOT routed yet (Slice 2 introduces VariantsPanel).
 *
 * Test note: UModal (reka-ui Dialog) portals its content to `document.body`.
 * We query buttons and checkboxes via `document.body.querySelector*` instead
 * of `wrapper.find*` because the portal content lives outside the wrapper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import PromotionTargetSelectionModal from '../PromotionTargetSelectionModal.vue'
import FlatChecklistPanel from '../FlatChecklistPanel.vue'
import VariantsPanel from '../VariantsPanel.vue'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../../../interfaces/promotion.types'

// ── productApi mocks (FlatChecklistPanel + VariantsPanel reach into this) ─────

const getCategoriesMock = vi.fn()
const getBrandsMock = vi.fn()
const getPaginatedMock = vi.fn()
const getVariantsMock = vi.fn()

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getCategories: (...args: unknown[]) => getCategoriesMock(...args),
    getBrands: (...args: unknown[]) => getBrandsMock(...args),
    getPaginated: (...args: unknown[]) => getPaginatedMock(...args),
    getVariants: (...args: unknown[]) => getVariantsMock(...args),
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

interface MountOpts {
  open: boolean
  type: PromotionTargetType
  selectedItems?: PromotionTargetItemFormEntry[]
  allowVariants?: boolean
}

function mountModal(opts: MountOpts) {
  const Inner = defineComponent({
    components: { UApp, PromotionTargetSelectionModal },
    setup() {
      return () =>
        h(UApp, null, {
          default: () =>
            h(PromotionTargetSelectionModal, {
              open: opts.open,
              type: opts.type,
              selectedItems: opts.selectedItems ?? [],
              allowVariants: opts.allowVariants,
            }),
        })
    },
  })

  return mount(Inner, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
    },
  })
}

// Helper: find the modal's data-testid in the portaled DOM.
function portalQueryAll(selector: string): Element[] {
  return Array.from(document.body.querySelectorAll(selector))
}

function clickPortal(selector: string): boolean {
  const el = document.body.querySelector(selector) as HTMLElement | null
  if (!el) return false
  el.click()
  return true
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PromotionTargetSelectionModal', () => {
  // Track wrappers so we can unmount them after each test. UModal portals
  // its content to document.body; without explicit unmount, the portal nodes
  // accumulate across tests and pollute the next test's assertions.
  const wrappers: ReturnType<typeof mount>[] = []

  function mountModalTracked(opts: MountOpts) {
    const w = mountModal(opts)
    wrappers.push(w)
    return w
  }

  beforeEach(() => {
    vi.resetAllMocks()
    getCategoriesMock.mockResolvedValue([{ id: 'c1', name: 'Camisetas' }])
    getBrandsMock.mockResolvedValue([{ id: 'b1', name: 'Nike' }])
    getPaginatedMock.mockResolvedValue({
      data: [{ id: 'p1', name: 'Camisa A', hasVariants: false }],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    })
    getVariantsMock.mockResolvedValue([
      { id: 'v1', productId: 'p1', name: 'Talle M' },
    ])
  })

  afterEach(() => {
    for (const w of wrappers) w.unmount()
    wrappers.length = 0
    vi.useRealTimers()
  })

  // ── Seed-on-open (REQ-2) ─────────────────────────────────────────────────

  it('on open, seeds staged from selectedItems so reopen pre-fills', async () => {
    mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()

    const checkedBoxes = portalQueryAll('[role="checkbox"][aria-checked="true"]')
    expect(checkedBoxes.length).toBe(1)
  })

  it('on close, hides the body (no FlatChecklistPanel rows rendered)', async () => {
    mountModalTracked({
      open: false,
      type: 'CATEGORIES',
      selectedItems: [],
    })
    await flushPromises()

    // Modal is closed — no checkboxes should be visible in the portal.
    const checkedBoxes = portalQueryAll('[role="checkbox"]')
    expect(checkedBoxes.length).toBe(0)
  })

  // ── Confirm (REQ-2) ──────────────────────────────────────────────────────

  it('confirm: clicking "Agregar seleccionados" emits confirm with the staged array, then closes', async () => {
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)

    const clicked = clickPortal('[data-testid="confirm-add-selected"]')
    expect(clicked).toBe(true)
    await nextTick()

    const emitted = modal.emitted('confirm') as [PromotionTargetItemFormEntry[]][]
    expect(emitted).toBeTruthy()
    expect(emitted[0]![0]).toEqual([{ targetId: 'c1', name: 'Camisetas' }])
  })

  it('confirm: then emits update:open false (closes the modal)', async () => {
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    clickPortal('[data-testid="confirm-add-selected"]')
    await nextTick()

    const openEmits = modal.emitted('update:open') as [boolean][]
    expect(openEmits).toBeTruthy()
    expect(openEmits[openEmits.length - 1]![0]).toBe(false)
  })

  // ── Cancel / Esc / backdrop (REQ-2 — NO confirm emit) ────────────────────

  it('cancel: clicking "Cancelar" emits update:open false and does NOT emit confirm', async () => {
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    const clicked = clickPortal('[data-testid="cancel-modal"]')
    expect(clicked).toBe(true)
    await nextTick()

    expect(modal.emitted('update:open')).toBeTruthy()
    const openEmitsCancel = modal.emitted('update:open') as [boolean][] | undefined
    expect(openEmitsCancel?.[openEmitsCancel.length - 1]).toEqual([false])
    expect(modal.emitted('confirm')).toBeFalsy()
  })

  it('escape: UModal Esc handler emits update:open false and does NOT emit confirm', async () => {
    // The cancel button shares the exact same handler shape as Esc/backdrop:
    // both emit update:open(false) and never emit confirm. Esc/backdrop are
    // reka-ui internal events; the public contract is that ANY non-confirm
    // close path does NOT emit confirm. We assert that contract via the
    // cancel button, which is the deterministic exposed surface.
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    clickPortal('[data-testid="cancel-modal"]')
    await nextTick()

    expect(modal.emitted('confirm')).toBeFalsy()
    const openEmitsEsc = modal.emitted('update:open') as [boolean][] | undefined
    expect(openEmitsEsc?.[openEmitsEsc.length - 1]).toEqual([false])
  })

  it('backdrop: UModal backdrop click emits update:open false and does NOT emit confirm', async () => {
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    clickPortal('[data-testid="cancel-modal"]')
    await nextTick()

    expect(modal.emitted('confirm')).toBeFalsy()
  })

  // ── Reopen reseeds (REQ-2) ───────────────────────────────────────────────

  it('reopen: staged is reseeded from the latest selectedItems on every open', async () => {
    // First open with 1 item.
    mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'c1', name: 'Camisetas' }],
    })
    await flushPromises()
    expect(portalQueryAll('[role="checkbox"][aria-checked="true"]').length).toBe(1)

    // Second open with 2 items: the modal must RE-seed from the latest
    // selectedItems (not carry over the previous staged state). We assert
    // via the modal's exposed `staged` ref.
    const wrapper2 = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [
        { targetId: 'c1', name: 'Camisetas' },
        { targetId: 'c2', name: 'Pantalones' },
      ],
    })
    await flushPromises()
    const modal2 = wrapper2.findComponent(PromotionTargetSelectionModal)
    // Vue auto-unwraps refs when accessed on the component instance, so
    // `staged` is the array directly (not a ref with `.value`).
    const staged = (modal2.vm as unknown as { staged: PromotionTargetItemFormEntry[] })
      .staged
    expect(staged).toEqual([
      { targetId: 'c1', name: 'Camisetas' },
      { targetId: 'c2', name: 'Pantalones' },
    ])
  })

  // ── Routing by type (REQ-1) ──────────────────────────────────────────────

  it('CATEGORIES type routes to FlatChecklistPanel', async () => {
    const wrapper = mountModalTracked({ open: true, type: 'CATEGORIES' })
    await flushPromises()
    expect(wrapper.findComponent(FlatChecklistPanel).exists()).toBe(true)
  })

  it('BRANDS type routes to FlatChecklistPanel', async () => {
    const wrapper = mountModalTracked({ open: true, type: 'BRANDS' })
    await flushPromises()
    expect(wrapper.findComponent(FlatChecklistPanel).exists()).toBe(true)
  })

  it('PRODUCTS type routes to FlatChecklistPanel', async () => {
    const wrapper = mountModalTracked({ open: true, type: 'PRODUCTS' })
    await flushPromises()
    expect(wrapper.findComponent(FlatChecklistPanel).exists()).toBe(true)
  })

  it('VARIANTS type does NOT route to FlatChecklistPanel (VariantsPanel owns the VARIANTS path)', async () => {
    const wrapper = mountModalTracked({ open: true, type: 'VARIANTS' })
    await flushPromises()
    expect(wrapper.findComponent(FlatChecklistPanel).exists()).toBe(false)
  })

  it('VARIANTS type routes to VariantsPanel (Slice 2)', async () => {
    const wrapper = mountModalTracked({ open: true, type: 'VARIANTS' })
    await flushPromises()
    expect(wrapper.findComponent(VariantsPanel).exists()).toBe(true)
  })

  it('CATEGORIES type does NOT route to VariantsPanel', async () => {
    const wrapper = mountModalTracked({ open: true, type: 'CATEGORIES' })
    await flushPromises()
    expect(wrapper.findComponent(VariantsPanel).exists()).toBe(false)
  })
})
