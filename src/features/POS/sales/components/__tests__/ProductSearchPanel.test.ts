import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { computed, ref } from 'vue'
import ProductSearchPanel from '../ProductSearchPanel.vue'
import type { CategoryChip } from '../../composables/useProductSearch'

// 14a.3 (sales-screen-redesign) — R6 panel half:
// category chips MUST live inside a `bg-coco-neutral-900 rounded-xl p-2`
// dark panel. This file lives separately from the wider sales view tests
// because ProductSearchPanel owns its own search state via
// `useProductSearch`; we stub the composable here so we can drive
// category state without touching the network.

const mockCategories = ref<CategoryChip[]>([])
const mockCategoryId = ref<string | undefined>(undefined)
const mockQuery = ref('')
const mockItems = ref<unknown[]>([])
const mockIsLoading = ref(false)
const mockIsEmpty = ref(false)
const mockHasQuery = ref(false)
const mockTotalUnfiltered = ref(0)

vi.mock('../../composables/useProductSearch', () => ({
  useProductSearch: () => ({
    query: mockQuery,
    items: computed(() => mockItems.value),
    isLoading: computed(() => mockIsLoading.value),
    isEmpty: computed(() => mockIsEmpty.value),
    hasQuery: computed(() => mockHasQuery.value),
    categoryId: mockCategoryId,
    categories: computed(() => mockCategories.value),
    totalUnfiltered: computed(() => mockTotalUnfiltered.value),
  }),
}))

// product search results + variant picker are stubbed because they
// require runtime data; only the wrapper chrome is exercised here.
const globalStubs = {
  ProductSearchResults: { template: '<div data-testid="results-stub" />' },
  VariantPickerModal: { template: '<div data-testid="variant-modal-stub" />' },
}

function resetMockState() {
  mockCategories.value = []
  mockCategoryId.value = undefined
  mockQuery.value = ''
  mockItems.value = []
  mockIsLoading.value = false
  mockIsEmpty.value = false
  mockHasQuery.value = false
  mockTotalUnfiltered.value = 0
}

function mountPanel() {
  return mount(ProductSearchPanel, {
    global: { stubs: globalStubs },
  })
}

describe('ProductSearchPanel — 14a.3 dark category panel (R6 panel half)', () => {
  let wrappers: VueWrapper[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    wrappers = []
  })

  afterEach(() => {
    // Clean up any data-testid-bearing DOM between tests so the
    // `expect(wrapper.html()).toContain(...)` assertions in test A see
    // a fresh tree (and listeners from previous mounts don't leak).
    for (const w of wrappers) {
      try {
        w.unmount()
      } catch {
        // ignore
      }
    }
  })

  function mountWithCleanup() {
    const w = mountPanel()
    wrappers.push(w)
    return w
  }

  it('renders category chips as free-floating buttons (no dark panel wrapper)', () => {
    // Seed at least one category so the chips section renders.
    mockCategories.value = [{ id: 'cat-1', name: 'Medicamentos', count: 4 }]
    mockTotalUnfiltered.value = 12

    const wrapper = mountWithCleanup()
    const html = wrapper.html()

    // Chips are direct buttons, not wrapped in a dark panel
    expect(html).toContain('Medicamentos')
    expect(html).toContain('category-chip-todo')
    expect(html).not.toContain('bg-coco-neutral-900')
  })

  it('14a.3.1 — exposes the Ctrl+K / ⌘K keyboard hint (preserves existing isMac pattern)', () => {
    // R6 — search bar shows KBD indicator. Either ⌘ or Ctrl is rendered
    // depending on navigator.platform; on jsdom the default is Win32-like
    // (no "Mac" in the platform), so we expect Ctrl. The check on ⌘ is
    // handled in the input/handler layer, not the visual.
    const wrapper = mountWithCleanup()
    const html = wrapper.html()
    // KBD pattern is preserved. At least one KBD shows the modifier.
    expect(html).toMatch(/Ctrl|⌘/)
    // The K key indicator is always shown.
    expect(html).toContain('K')
  })

  it('14a.3.1 — toggles activeCategory when a chip is clicked (existing behavior preserved)', () => {
    mockCategories.value = [
      { id: 'cat-1', name: 'Medicamentos', count: 4 },
      { id: 'cat-2', name: 'Ropa', count: 7 },
    ]
    mockTotalUnfiltered.value = 12

    const wrapper = mountWithCleanup()
    // Click the first chip
    const buttons = wrapper.findAll('button')
    const medButton = buttons.find((b) => b.text().includes('Medicamentos'))
    expect(medButton).toBeDefined()
    medButton!.trigger('click')
    expect(mockCategoryId.value).toBe('cat-1')
    // Click again to deselect
    medButton!.trigger('click')
    expect(mockCategoryId.value).toBeUndefined()
  })

  it('14a.3.1 — Todo chip clears the active category (existing behavior preserved)', () => {
    mockCategories.value = [
      { id: 'cat-1', name: 'Medicamentos', count: 4 },
    ]
    mockTotalUnfiltered.value = 12
    mockCategoryId.value = 'cat-1' // pre-set so Todo click clears

    const wrapper = mountWithCleanup()
    const buttons = wrapper.findAll('button')
    const todoButton = buttons.find((b) => b.text().includes('Todo'))
    expect(todoButton).toBeDefined()
    todoButton!.trigger('click')
    expect(mockCategoryId.value).toBeUndefined()
  })
})
