import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DataTableToolbar from '../DataTableToolbar.vue'

/**
 * Mirrors the AppDataTable.spec.ts stub pattern: a single mutable ref controls
 * whether `useBreakpoints().smaller('md')` reports mobile.
 *
 * Stubs only cover the components Nuxt UI's internals cannot render in jsdom
 * (USlideover, UDropdownMenu, UTooltip) or that would explode on missing
 * dependencies (UBadge has its own data-testid via attrs, so we forward it).
 * UButton, UInput, UIcon are left to their real implementations because Vue
 * Test Utils' stub matching uses the unprefixed instance name `Button` /
 * `Icon` / etc. — easier to pin the test on stable `data-testid` attrs than
 * to mirror every Nuxt UI internal.
 */
const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useBreakpoints: () => ({
      smaller: () => isBelowBreakpoint,
    }),
  }
})

const baseStubs = {
  UTooltip: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  UDropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenu: { template: '<div><slot /></div>' },
  USlideover: {
    props: ['open', 'side'],
    template:
      '<div data-testid="slideover" :data-open="String(open)" :data-side="side"><slot name="content" /></div>',
  },
  Slideover: {
    props: ['open', 'side'],
    template:
      '<div data-testid="slideover" :data-open="String(open)" :data-side="side"><slot name="content" /></div>',
  },
  UBadge: {
    props: ['label', 'color'],
    template:
      '<span :data-testid="$attrs[\'data-testid\']" :data-label="String(label)"><slot /></span>',
  },
  Badge: {
    props: ['label', 'color'],
    template:
      '<span :data-testid="$attrs[\'data-testid\']" :data-label="String(label)"><slot /></span>',
  },
}

type ToolbarProps = Record<string, unknown>

function mountToolbar(
  propsOverride: ToolbarProps = {},
  slots: Record<string, string> = {},
) {
  return mount(DataTableToolbar, {
    props: {
      globalFilter: '',
      ...propsOverride,
    },
    slots,
    global: {
      stubs: baseStubs,
    },
  })
}

describe('DataTableToolbar — testid pass-through (REQ-QAF-016)', () => {
  it('does not render a data-testid on the refresh button by default', () => {
    const wrapper = mountToolbar({ showRefresh: true })

    const refreshIcon = wrapper.get('svg[data-slot="leadingIcon"]')
    const refreshButton = refreshIcon.element.parentElement as HTMLElement
    expect(refreshButton).toBeTruthy()
    expect(refreshButton.hasAttribute('data-testid')).toBe(false)
  })

  it('renders refreshButtonTestId on the refresh button when provided', () => {
    const wrapper = mountToolbar({
      showRefresh: true,
      refreshButtonTestId: 'refresh-quotations-button',
    })

    const refreshButton = wrapper.get('[data-testid="refresh-quotations-button"]')
    expect(refreshButton.find('svg[data-slot="leadingIcon"]').exists()).toBe(true)
  })

  it('does not render a data-testid on the add button by default', () => {
    const wrapper = mountToolbar({ showAddButton: true, addButtonText: 'Nueva cotización' })

    const addButton = wrapper
      .findAll('button')
      .find(b => b.text().includes('Nueva cotización'))
    expect(addButton).toBeTruthy()
    expect(addButton!.attributes('data-testid')).toBeUndefined()
  })

  it('renders addButtonTestId on the add button when provided', () => {
    const wrapper = mountToolbar({
      showAddButton: true,
      addButtonText: 'Nueva cotización',
      addButtonTestId: 'new-quotation-button',
    })

    const add = wrapper.get('[data-testid="new-quotation-button"]')
    expect(add.text()).toContain('Nueva cotización')
  })
})

// ─── Mobile three-region layout ───────────────────────────────────────────────
// Below `md`, the toolbar renders three stacked regions in fixed order:
// search full-width (row 1), actions cluster (row 2), "Filtros" button
// (row 3). Requirements live in the proposal and the spec
// (data-table-toolbar/spec.md → Requirement: Mobile three-region layout).

describe('DataTableToolbar — mobile three-region layout', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = true
  })

  it('renders search → actions → filters row order on a full mobile toolbar', () => {
    const wrapper = mountToolbar(
      {
        showAddButton: true,
        addButtonText: 'Agregar',
        showRefresh: true,
        showColumnVisibility: true,
        activeFilterCount: 2,
      },
      {
        filters: '<span data-testid="fake-filter">F</span>',
        actions: '<span data-testid="fake-action">A</span>',
      },
    )

    const regions = wrapper.findAll('[data-testid^="toolbar-mobile-"]')
    expect(regions.length).toBe(3)
    expect(regions[0]?.attributes('data-testid')).toBe('toolbar-mobile-search-row')
    expect(regions[1]?.attributes('data-testid')).toBe('toolbar-mobile-actions-row')
    expect(regions[2]?.attributes('data-testid')).toBe('toolbar-mobile-filters-row')
  })

  it('renders only the search row when there are no actions or filters on mobile', () => {
    const wrapper = mountToolbar({})

    expect(wrapper.find('[data-testid="toolbar-mobile-search-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toolbar-mobile-actions-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toolbar-mobile-filters-row"]').exists()).toBe(false)
  })

  it('uses flex-wrap on the mobile actions cluster so nothing clips at 360px', () => {
    const wrapper = mountToolbar(
      {
        showAddButton: true,
        showRefresh: true,
        showColumnVisibility: true,
      },
      { actions: '<span>ViewToggle</span>' },
    )

    const actionsRow = wrapper.get('[data-testid="toolbar-mobile-actions-row"]')
    const classes = (actionsRow.element.getAttribute('class') ?? '').split(/\s+/)
    expect(classes).toContain('flex-wrap')
    expect(classes).toContain('gap-2')
  })

  it('hides "Columnas" when the toolbar receives showColumnVisibility=false (card mode)', () => {
    // AppDataTable folds `isCardsMode` into `showColumnVisibility` before forwarding.
    // At the toolbar boundary, `showColumnVisibility: false` simulates the card-mode
    // scenario from the spec (Card mode hides column visibility).
    const wrapper = mountToolbar({ showColumnVisibility: false })
    expect(wrapper.text()).not.toContain('Columnas')
  })

  it('renders add → refresh → actions slot in fixed order on mobile when Columnas is absent', () => {
    const wrapper = mountToolbar(
      {
        showAddButton: true,
        addButtonTestId: 'add-btn',
        addButtonText: 'Agregar',
        showRefresh: true,
        refreshButtonTestId: 'refresh-btn',
      },
      {
        actions: '<span data-testid="fake-action">SlotAction</span>',
      },
    )

    const html = wrapper.html()
    const addIdx = html.indexOf('data-testid="add-btn"')
    const refreshIdx = html.indexOf('data-testid="refresh-btn"')
    const slotIdx = html.indexOf('data-testid="fake-action"')

    expect(addIdx).toBeGreaterThan(-1)
    expect(refreshIdx).toBeGreaterThan(addIdx)
    expect(slotIdx).toBeGreaterThan(refreshIdx)
    // Columnas dropdown is gated on `tableApi`; it doesn't render in the unit
    // mount without AppDataTable wiring. The integration test (in the
    // AppDataTable suite) covers the column-visibility presence.
    expect(html).not.toContain('data-testid="toolbar-mobile-columns-button"')
  })
})

// ─── Filters collapse to bottom-sheet ────────────────────────────────────────

describe('DataTableToolbar — filters collapse to bottom-sheet on mobile', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = true
  })

  it('opens USlideover side="bottom" with a scrollable body region', () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 1 },
      { filters: '<span data-testid="fake-filter" />' },
    )

    const filtrosBtn = wrapper.find('[data-testid="toolbar-filtros-button"]')
    expect(filtrosBtn.exists()).toBe(true)

    const slideover = wrapper.find('[data-testid="slideover"]')
    expect(slideover.exists()).toBe(true)
    expect(slideover.attributes('data-side')).toBe('bottom')

    // Scrollable height class is present on the body region (landscape overflow).
    const scrollRegion = wrapper.find('[data-testid="toolbar-filters-body"]')
    expect(scrollRegion.exists()).toBe(true)
    const scrollClasses = (scrollRegion.element.getAttribute('class') ?? '').split(/\s+/)
    expect(scrollClasses).toContain('overflow-y-auto')
    expect(scrollClasses.some(c => c.startsWith('h-[85vh]'))).toBe(true)
    expect(scrollClasses.some(c => c.startsWith('max-h-[85vh]'))).toBe(true)
  })

  it('opens the sheet when the Filtros button is clicked', async () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 1 },
      { filters: '<span data-testid="fake-filter" />' },
    )

    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('false')
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('true')
  })

  it('keeps the filters slot content mounted while the sheet is open', async () => {
    // The slot is rendered inside the slideover body; Vue keeps the
    // underlying filter state intact across open/close cycles because the
    // `#filters` slot's vnodes are not torn down.
    const wrapper = mountToolbar(
      { activeFilterCount: 1 },
      {
        filters:
          '<input data-testid="persisted-filter-input" value="cached" />',
      },
    )

    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('true')
    // The filter input is mounted inside the open sheet.
    expect(wrapper.find('[data-testid="persisted-filter-input"]').exists()).toBe(true)
  })
})

// ─── Mobile filters bottom-sheet polish (REQ-2 / REQ-3 / REQ-4 / WU-2) ───────
// The sheet is now three regions: a sticky header (Filtros + active-count
// badge + Limpiar todo), a scrollable body (each #filters child wrapped in a
// card section), and a sticky footer (Cerrar). The #filters-title slot
// overrides the default "Filtros" label.

describe('DataTableToolbar — mobile filters bottom-sheet polish (REQ-2..4 / WU-2)', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = true
  })

  it('renders a sticky header with title "Filtros", badge, and "Limpiar todo" when activeFilterCount > 0', async () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 2 },
      { filters: '<span data-testid="fake-filter" />' },
    )
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')

    const header = wrapper.get('[data-testid="toolbar-filters-header"]')
    expect(header.text()).toContain('Filtros')
    expect(header.text()).toContain('Limpiar todo')
    // The badge with the count is rendered with the existing
    // toolbar-filtros-badge testid (already used for the trigger button)
    // — inside the header it carries the count as data-label.
    const headerBadge = header.find('[data-testid="toolbar-filtros-badge"]')
    expect(headerBadge.exists()).toBe(true)
    expect(headerBadge.attributes('data-label')).toBe('2')
  })

  it('renders header without badge or "Limpiar todo" when activeFilterCount is 0', async () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 0 },
      { filters: '<span data-testid="fake-filter" />' },
    )
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')

    const header = wrapper.get('[data-testid="toolbar-filters-header"]')
    expect(header.text()).toContain('Filtros')
    expect(header.find('[data-testid="toolbar-filtros-badge"]').exists()).toBe(false)
    expect(header.text()).not.toContain('Limpiar todo')
  })

  it('renders the #filters slot directly inside the sheet body (no vnode capture/re-render)', async () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 1 },
      {
        filters: `
          <div data-testid="fake-filter">A</div>
          <div data-testid="fake-filter">B</div>
        `,
        'filters-title': 'Filtros de ventas',
      },
    )
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')

    const body = wrapper.get('[data-testid="toolbar-filters-body"]')
    // Card sections are owned by the views (FilterSectionCard), so the
    // toolbar MUST NOT emit per-child section wrappers anymore — the slot
    // children render as-is inside the body.
    expect(body.findAll('[data-testid^="toolbar-filters-section-"]').length).toBe(0)
    const filters = body.findAll('[data-testid="fake-filter"]')
    expect(filters.length).toBe(2)
  })

  it('emits clear-filters when "Limpiar todo" is clicked', async () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 2 },
      { filters: '<span data-testid="fake-filter" />' },
    )
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')

    const clearBtn = wrapper.find('[data-testid="toolbar-filters-clear-all"]')
    expect(clearBtn.exists()).toBe(true)
    await clearBtn.trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
  })

  it('renders a sticky footer with "Cerrar" that closes the sheet', async () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 1 },
      { filters: '<span data-testid="fake-filter" />' },
    )
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('true')

    const footer = wrapper.get('[data-testid="toolbar-filters-footer"]')
    expect(footer.text()).toContain('Cerrar')

    const closeBtn = footer.find('button')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')

    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('false')
  })

  it('#filters-title slot overrides the default "Filtros" header label', async () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 0 },
      {
        filters: '<span data-testid="fake-filter" />',
        'filters-title': 'Búsqueda avanzada',
      },
    )
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')

    const header = wrapper.get('[data-testid="toolbar-filters-header"]')
    expect(header.text()).toContain('Búsqueda avanzada')
    // The default "Filtros" label must NOT appear when the slot overrides it.
    expect(header.text()).not.toContain('Filtros')
  })
})

// ─── Active-filter-count contract ────────────────────────────────────────────

describe('DataTableToolbar — active-filter-count contract', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = true
  })

  it('renders a UBadge with the count when activeFilterCount > 0', () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 2 },
      { filters: '<span data-testid="fake-filter" />' },
    )

    const badge = wrapper.find('[data-testid="toolbar-filtros-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('2')
  })

  it('does not render the badge when activeFilterCount is 0', () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 0 },
      { filters: '<span data-testid="fake-filter" />' },
    )

    expect(wrapper.find('[data-testid="toolbar-filtros-badge"]').exists()).toBe(false)
  })

  it('defaults activeFilterCount to 0 when omitted', () => {
    const wrapper = mountToolbar({}, { filters: '<span data-testid="fake-filter" />' })

    expect(wrapper.find('[data-testid="toolbar-filtros-badge"]').exists()).toBe(false)
  })
})

// ─── Filtros button visibility ───────────────────────────────────────────────

describe('DataTableToolbar — Filtros button visibility', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = true
  })

  it('hides the Filtros button when the #filters slot is empty', () => {
    const wrapper = mountToolbar({ activeFilterCount: 5 })
    expect(wrapper.find('[data-testid="toolbar-filtros-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toolbar-mobile-filters-row"]').exists()).toBe(false)
  })

  it('shows the Filtros button (without a badge) when the slot is populated but count is 0', () => {
    const wrapper = mountToolbar(
      { activeFilterCount: 0 },
      { filters: '<span data-testid="fake-filter" />' },
    )

    expect(wrapper.find('[data-testid="toolbar-filtros-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toolbar-filtros-badge"]').exists()).toBe(false)
  })
})

// ─── Desktop layout invariance ───────────────────────────────────────────────

describe('DataTableToolbar — desktop layout invariance', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = false
  })

  it('does not render mobile region markers at md+', () => {
    const wrapper = mountToolbar(
      { showAddButton: true, showRefresh: true },
      { filters: '<span data-testid="fake-filter" />' },
    )

    expect(wrapper.find('[data-testid="toolbar-mobile-search-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toolbar-mobile-actions-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toolbar-mobile-filters-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toolbar-filtros-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)

    // Filters render inline (the #filters slot is in the rendered tree, not
    // gated behind any sheet trigger).
    expect(wrapper.html()).toContain('data-testid="fake-filter"')
  })

  it('keeps the desktop refresh-button testid when showRefresh+refreshButtonTestId are set', () => {
    const wrapper = mountToolbar({
      showRefresh: true,
      refreshButtonTestId: 'refresh-x',
    })

    expect(wrapper.exists()).toBe(true)
    const refresh = wrapper.find('[data-testid="refresh-x"]')
    expect(refresh.exists()).toBe(true)
  })
})
