import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DataTablePagination from '../DataTablePagination.vue'
import DataTableToolbar from '../DataTableToolbar.vue'
import FilterSectionCard from '../FilterSectionCard.vue'

// mobile-tables T1 (S2 a/b). jsdom has no layout, so the structure and the stylesheet rules that
// fix what the 390–407px browser run showed are pinned here; geometry stays in
// e2e/responsive/specs/mobile-tables.spec.ts.

const isBelowBreakpoint = ref(true)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const slideoverStub = { props: ['open', 'side'], template: '<div data-testid="slideover" :data-side="side"><slot name="content" /></div>' }
const stubs = {
  UTooltip: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  UDropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenu: { template: '<div><slot /></div>' },
  USlideover: slideoverStub,
  Slideover: slideoverStub,
  UBadge: { props: ['label'], template: '<span />' },
  Badge: { props: ['label'], template: '<span />' },
}

// mobile-tables T3: the sheet rules moved to the DataTable phone stylesheet (teleported, unscoped).
const mobileCss = readFileSync('src/core/shared/components/DataTable/mobile-list.css', 'utf8')

/** The declarations of the first rule whose selector list contains `selector`. */
function rule(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`(?:^|[},/]\\s*)[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`, 'm'))?.[1] ?? ''
}

describe('Filtros sheet — the #filters row stacks inside the sheet (S2a)', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = true
  })

  // The views write one desktop row: `flex flex-wrap` with the filters in a `flex-1 min-w-0
  // overflow-hidden` region and the sort beside it. In the 407px sheet the region's 0 basis left
  // it a ~20px sliver that clipped every section to an empty bordered box.
  const customersLikeRow = `
    <div data-testid="row" class="flex w-full flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap">
      <div data-testid="filters-region" class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"><section>F</section></div>
      <div class="hidden h-5 w-px shrink-0 bg-default md:block" />
      <div data-testid="sort-region" class="flex shrink-0 items-center gap-2"><label>Ordenar:</label></div>
    </div>`

  it('marks the sheet body as the stacking boundary and keeps the scroll + footer contract', () => {
    const wrapper = mount(DataTableToolbar, { props: { globalFilter: '' }, slots: { filters: customersLikeRow }, global: { stubs } })
    const body = wrapper.get('[data-testid="toolbar-filters-body"]')
    expect(body.classes()).toEqual(expect.arrayContaining(['hf-filters-sheet__body', 'min-h-0', 'flex-1', 'overflow-y-auto']))
    expect(body.find('[data-testid="filters-region"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="toolbar-filters-footer"]').classes()).toContain('shrink-0')
  })

  it('stacks a flex row passed to the sheet and gives every region the full width, unclipped', () => {
    const row = rule(mobileCss, '.hf-filters-sheet__body > :where(.flex)')
    expect(row).toMatch(/flex-direction: column/)
    expect(row).toMatch(/flex-wrap: nowrap/)
    expect(row).toMatch(/align-items: stretch/)
    const region = rule(mobileCss, '.hf-filters-sheet__body > :where(.flex) > *')
    expect(region).toMatch(/flex: 0 0 auto/)
    expect(region).toMatch(/width: 100%/)
    expect(region).toMatch(/overflow: visible/)
  })
})

describe('FilterSectionCard — a titled group, not a nested card (S2a, design/system.md «No nested decorative cards»)', () => {
  it('separates groups with a hairline on mobile and still dissolves on md+', () => {
    const classes = mount(FilterSectionCard, { props: { title: 'Estado' } }).get('div').classes()
    expect(classes).toContain('md:contents')
    expect(classes).not.toContain('rounded-lg')
    expect(classes).not.toContain('border')
    expect(classes).not.toContain('bg-elevated/30')
    expect(classes).toEqual(expect.arrayContaining(['border-t', 'border-default', 'first:border-t-0']))
  })
})

describe('DataTablePagination — compact pager below sm (S2b)', () => {
  const sizeMenuStub = { template: '<div data-testid="size-menu"><slot /></div>' }
  const navigationStub = { props: ['page'], template: '<ul data-testid="pagination-list" v-bind="$attrs" />' }
  function mountPager(props: Record<string, unknown> = {}) {
    return mount(DataTablePagination, {
      props: { pageIndex: 2, pageSize: 5, pageCount: 9, totalCount: 45, showingFrom: 11, showingTo: 15, ...props },
      global: { stubs: { UDropdownMenu: sizeMenuStub, DropdownMenu: sizeMenuStub, UPagination: navigationStub, Pagination: navigationStub } },
    })
  }

  it('puts the range and an auto-width page size on one row that may wrap, never a stacked column', () => {
    const root = mountPager().classes()
    expect(root).not.toContain('flex-col')
    expect(root).toEqual(expect.arrayContaining(['flex-wrap', 'items-center', 'justify-between', 'sm:flex-nowrap', 'sm:flex-row']))
    const controls = mountPager().get('[data-testid="pagination-controls"]').classes()
    // Below sm the controls box dissolves so the size control sits beside the range.
    expect(controls).toContain('contents')
    expect(controls).toEqual(expect.arrayContaining(['sm:flex', 'sm:flex-row', 'sm:flex-1', 'sm:w-auto']))
    expect(mountPager().get('.hf-pagination-size').classes()).not.toContain('w-full')
  })

  it('hides the numbered list below sm and shows first/prev, «Página 3 de 9», next/last instead', async () => {
    const wrapper = mountPager()
    expect(wrapper.get('[data-testid="pagination-list"]').classes()).toContain('max-sm:hidden')
    const compact = wrapper.get('[data-testid="pagination-compact"]')
    expect(compact.element.tagName).toBe('NAV')
    expect(compact.classes()).toEqual(expect.arrayContaining(['sm:hidden', 'w-full']))
    expect(compact.get('[data-testid="pagination-compact-status"]').text()).toBe('Página 3 de 9')
    const labels = compact.findAll('button').map((button) => button.attributes('aria-label'))
    expect(labels).toEqual(['Primera página', 'Página anterior', 'Página siguiente', 'Última página'])

    await compact.get('button[aria-label="Página siguiente"]').trigger('click')
    await compact.get('button[aria-label="Última página"]').trigger('click')
    await compact.get('button[aria-label="Página anterior"]').trigger('click')
    await compact.get('button[aria-label="Primera página"]').trigger('click')
    expect(wrapper.emitted('update:pageIndex')).toEqual([[3], [8], [1], [0]])
  })

  it('disables the edges at the first and last page and while fetching', () => {
    const first = mountPager({ pageIndex: 0 }).get('[data-testid="pagination-compact"]')
    expect(first.get('button[aria-label="Primera página"]').attributes('disabled')).toBeDefined()
    expect(first.get('button[aria-label="Página anterior"]').attributes('disabled')).toBeDefined()
    expect(first.get('button[aria-label="Página siguiente"]').attributes('disabled')).toBeUndefined()
    const last = mountPager({ pageIndex: 8 }).get('[data-testid="pagination-compact"]')
    expect(last.get('button[aria-label="Última página"]').attributes('disabled')).toBeDefined()
    const fetching = mountPager({ fetching: true }).get('[data-testid="pagination-compact"]')
    expect(fetching.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('renders no compact navigation for a single page', () => {
    expect(mountPager({ pageIndex: 0, pageCount: 1, totalCount: 4, showingFrom: 1, showingTo: 4 }).find('[data-testid="pagination-compact"]').exists()).toBe(false)
  })
})
