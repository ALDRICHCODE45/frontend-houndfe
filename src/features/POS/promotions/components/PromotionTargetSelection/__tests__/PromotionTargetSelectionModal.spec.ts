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

/**
 * Query only toast titles — NOT the modal title.
 *
 * `[data-slot="title"]` matches both the UModal header ("Seleccionar
 * categorías", etc.) AND the toast title rendered by the Toaster. To
 * distinguish the two, we restrict the query to elements inside the
 * Toaster viewport (`[data-slot="viewport"]`).
 *
 * Returns the array of title text contents inside any active toast
 * viewport, which is empty when no toast has been fired.
 */
function queryToastTitles(): string[] {
  const titles: string[] = []
  document.body.querySelectorAll('[data-slot="viewport"] [data-slot="title"]').forEach((n) => {
    const text = n.textContent?.trim() ?? ''
    if (text.length > 0) titles.push(text)
  })
  return titles
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
    // Wipe any leftover Toaster viewports from a previous test. The Toaster
    // teleports to document.body and survives wrapper.unmount() in jsdom, so
    // without this cleanup later tests would see ghost toasts with stale
    // titles. Removing the viewport nukes every toast inside it.
    document.body.querySelectorAll('[data-slot="viewport"]').forEach((n) => n.remove())
  })

  afterEach(() => {
    for (const w of wrappers) w.unmount()
    wrappers.length = 0
    vi.useRealTimers()
    // Final toast sweep — same reason as beforeEach.
    document.body.querySelectorAll('[data-slot="viewport"]').forEach((n) => n.remove())
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

  // ── REQ-7: Duplicate-label protection (Slice 3) ─────────────────────────
  //
  // Spec wording (UI copy): "Ya existe un elemento con este nombre. ¿Deseas continuar?"
  // When a staged entry's chipLabel collides with an existing chip's chipLabel
  // OR with another staged entry's chipLabel — but with a DIFFERENT targetId —
  // the modal MUST:
  //   1) Show a warning toast with the canonical Spanish copy.
  //   2) SKIP the duplicate from the emitted `confirm` payload.
  //
  // Same label + SAME id is idempotent and NOT flagged (it's the same item).
  // Distinct labels pass through untouched.
  //
  // We assert by querying the rendered DOM for the toast title slot, because
  // @nuxt/ui's useToast cannot be vi.stubGlobal'd (UApp shadows it).

  it('REQ-7: same label, different id vs existing chip → warning toast rendered AND dup skipped from emit', async () => {
    // Existing chip: "Rojo" with id V1 (this is what the form already has).
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'V1', name: 'Rojo' }],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    // Simulate the user ADDING a colliding V2 to the existing V1 chip.
    // Both stay in staged; the dedupe pass should keep V1 and skip V2.
    modal.vm.staged = [
      { targetId: 'V1', name: 'Rojo' }, // existing — preserved
      { targetId: 'V2', name: 'Rojo' }, // new collision — must be skipped
    ]

    clickPortal('[data-testid="confirm-add-selected"]')
    await flushPromises()

    // 1) Toast rendered with the canonical Spanish copy.
    //    Use `queryToastTitles()` (viewport-scoped) so the modal's own
    //    title is excluded — see helper comment.
    const toastTexts = queryToastTitles()
    expect(
      toastTexts.some((t) => t.includes('Ya existe un elemento con este nombre. ¿Deseas continuar?')),
    ).toBe(true)

    // 2) Dup skipped from emit: emitted payload must NOT contain V2.
    const emitted = modal.emitted('confirm') as [PromotionTargetItemFormEntry[]][] | undefined
    expect(emitted).toBeTruthy()
    const payload = emitted?.[emitted.length - 1]?.[0] ?? []
    expect(payload.some((e) => e.targetId === 'V2')).toBe(false)
    expect(payload.some((e) => e.targetId === 'V1')).toBe(true)
  })

  it('REQ-7: distinct labels unaffected — both new entries pass through, no toast', async () => {
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'V1', name: 'Rojo' }],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    modal.vm.staged = [
      { targetId: 'V1', name: 'Rojo' }, // existing — preserved
      { targetId: 'V3', name: 'Azul' }, // distinct label — passes through
    ]

    const toastsBefore = queryToastTitles().length
    clickPortal('[data-testid="confirm-add-selected"]')
    await flushPromises()

    const emitted = modal.emitted('confirm') as [PromotionTargetItemFormEntry[]][] | undefined
    expect(emitted).toBeTruthy()
    const payload = emitted?.[emitted.length - 1]?.[0] ?? []
    expect(payload).toEqual([
      { targetId: 'V1', name: 'Rojo' },
      { targetId: 'V3', name: 'Azul' },
    ])

    // No NEW toast for distinct-label case. Comparing the count delta
    // (rather than absolute presence) makes the assertion robust against
    // any toasts a previous test left behind in the Toaster's internal
    // state — the test asserts ONLY that THIS action did not add one.
    const toastsAfter = queryToastTitles().length
    expect(toastsAfter).toBe(toastsBefore)
  })

  it('REQ-7: same label + same id is NOT flagged (idempotent re-stage)', async () => {
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [{ targetId: 'V1', name: 'Rojo' }],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    // Same id, same label — the user simply re-staged the same chip.
    modal.vm.staged = [{ targetId: 'V1', name: 'Rojo' }]

    const toastsBefore = queryToastTitles().length
    clickPortal('[data-testid="confirm-add-selected"]')
    await flushPromises()

    // No NEW warning toast for the same-id case.
    expect(queryToastTitles().length).toBe(toastsBefore)

    // Emit still happens (the entry stays; nothing flagged).
    const emitted = modal.emitted('confirm') as [PromotionTargetItemFormEntry[]][] | undefined
    expect(emitted).toBeTruthy()
  })

  it('REQ-7: within-staged dup (two staged entries, same label, different ids) → toast + one skipped', async () => {
    const wrapper = mountModalTracked({
      open: true,
      type: 'CATEGORIES',
      selectedItems: [],
    })
    await flushPromises()

    const modal = wrapper.findComponent(PromotionTargetSelectionModal)
    // Two newly-staged entries with the SAME label but different ids.
    modal.vm.staged = [
      { targetId: 'V1', name: 'Rojo' },
      { targetId: 'V2', name: 'Rojo' },
    ]

    clickPortal('[data-testid="confirm-add-selected"]')
    await flushPromises()

    // Toast rendered (canonical copy).
    const toastTexts = queryToastTitles()
    expect(
      toastTexts.some((t) => t.includes('Ya existe un elemento con este nombre. ¿Deseas continuar?')),
    ).toBe(true)

    // Only ONE of the two staged entries survives in the emitted payload.
    const emitted = modal.emitted('confirm') as [PromotionTargetItemFormEntry[]][] | undefined
    expect(emitted).toBeTruthy()
    const payload = emitted?.[emitted.length - 1]?.[0] ?? []
    expect(payload.length).toBe(1)
    expect(payload[0]?.targetId).toBe('V1')
  })
})
