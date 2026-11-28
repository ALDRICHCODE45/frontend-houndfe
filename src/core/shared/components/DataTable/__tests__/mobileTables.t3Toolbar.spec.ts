import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DataTableToolbar from '../DataTableToolbar.vue'
import DataTableBulkActions from '../DataTableBulkActions.vue'

// mobile-tables T3 (S4, board 03): the phone toolbar (sticky search + «Filtros (N)») and the
// full-height «Filtros» sheet with «Limpiar (N)» and «Ver N resultados»; the docked bulk bar.

const isPhone = ref(true)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isPhone }) }
})

const slideoverStub = {
  props: ['open', 'side', 'inset', 'ui'],
  template: '<div data-testid="slideover" :data-side="side" :data-inset="String(!!inset)" :data-content="ui?.content"><slot name="content" /></div>',
}
const stubs = {
  UTooltip: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  USlideover: slideoverStub,
  Slideover: slideoverStub,
}
const ui = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const mobileCss = readFileSync('src/core/shared/components/DataTable/mobile-list.css', 'utf8')

function mountToolbar(props: Record<string, unknown> = {}) {
  return mount(DataTableToolbar, {
    props: { globalFilter: '', resultCount: 38, itemLabel: { one: 'cliente', other: 'clientes' }, ...props },
    slots: { filters: '<section data-testid="a-filter">F</section>' },
    global: { stubs },
  })
}

beforeEach(() => {
  isPhone.value = true
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('phone toolbar', () => {
  it('puts the search and «Filtros (N)» in one sticky block', () => {
    const wrapper = mountToolbar({ activeFilterCount: 3 })
    const sticky = wrapper.get('[data-testid="toolbar-mobile-sticky"]')
    expect(sticky.classes()).toContain('hf-mtool')
    expect(sticky.find('.hf-toolbar-search').exists()).toBe(true)
    const filtros = sticky.get('[data-testid="toolbar-filtros-button"]')
    expect(filtros.text()).toContain('Filtros')
    expect(filtros.get('[data-testid="toolbar-filtros-badge"]').text()).toBe('3')
    expect(filtros.attributes('aria-label')).toBe('Filtros, 3 activos')
  })

  it('makes .hf-mtool sticky in the stylesheet', () => {
    expect(mobileCss).toMatch(/\.hf-mtool\s*\{[^}]*position:\s*sticky/)
  })
})

describe('Filtros sheet (board 03)', () => {
  it('is a full-height bottom sheet (not inset) with the sheet class', () => {
    const wrapper = mountToolbar()
    const sheet = wrapper.findAll('[data-testid="slideover"]').find(node => node.find('[data-testid="toolbar-filters-layout"]').exists())!
    expect(sheet.attributes('data-side')).toBe('bottom')
    expect(sheet.attributes('data-inset')).toBe('false')
    expect(sheet.attributes('data-content')).toContain('hf-filters-sheet')
    expect(mobileCss).toMatch(/\.hf-filters-sheet\s*\{[^}]*border-radius:\s*var\(--hf-radius-sheet\) var\(--hf-radius-sheet\) 0 0/)
  })

  it('titles the sheet with the active filters and the server total', () => {
    const wrapper = mountToolbar({ activeFilterCount: 3 })
    const header = wrapper.get('[data-testid="toolbar-filters-header"]')
    expect(header.text()).toContain('Filtros')
    expect(header.text()).toContain('3 filtros activos · 38 clientes')
    expect(header.get('[data-testid="toolbar-filters-close"]').attributes('aria-label')).toBe('Cerrar filtros')
  })

  it('has a sticky footer «Limpiar (N)» + «Ver N resultados» from the current total', async () => {
    const wrapper = mountToolbar({ activeFilterCount: 2 })
    const footer = wrapper.get('[data-testid="toolbar-filters-footer"]')
    expect(footer.get('[data-testid="toolbar-filters-clear-all"]').text()).toBe('Limpiar (2)')
    expect(footer.get('[data-testid="toolbar-filters-apply"]').text()).toBe('Ver 38 clientes')
    await footer.get('[data-testid="toolbar-filters-clear-all"]').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
    await wrapper.setProps({ resultCount: 1 })
    expect(wrapper.get('[data-testid="toolbar-filters-apply"]').text()).toBe('Ver 1 cliente')
  })

  it('defaults the noun to «resultados» and disables «Limpiar» without active filters', () => {
    const wrapper = mount(DataTableToolbar, {
      props: { globalFilter: '', resultCount: 4 },
      slots: { filters: '<section>F</section>' },
      global: { stubs },
    })
    expect(wrapper.get('[data-testid="toolbar-filters-apply"]').text()).toBe('Ver 4 resultados')
    const clear = wrapper.get('[data-testid="toolbar-filters-clear-all"]')
    expect(clear.text()).toBe('Limpiar')
    expect(clear.attributes('disabled')).toBeDefined()
  })

  it('keeps the desktop toolbar unchanged (no sticky block, no sheet)', () => {
    isPhone.value = false
    const wrapper = mountToolbar()
    expect(wrapper.find('[data-testid="toolbar-mobile-sticky"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toolbar-filters-layout"]').exists()).toBe(false)
    expect(wrapper.find('.hf-toolbar-filters [data-testid="a-filter"]').exists()).toBe(true)
  })
})

describe('docked bulk bar', () => {
  const actions = [
    { id: 'csv', label: 'Exportar CSV', icon: 'i-lucide-download', onClick: () => {} },
    { id: 'pdf', label: 'Estados de cuenta PDF', onClick: () => {} },
  ]
  it('docks full width at the bottom with the count, ✕ and the actions on their own row', () => {
    const wrapper = mount(DataTableBulkActions, { props: { selectedCount: 3, totalCount: 86, actions, docked: true } })
    const bar = wrapper.get('.hf-bulk-bar')
    expect(bar.classes()).toContain('hf-bulk-bar--docked')
    expect(bar.attributes('style') ?? '').not.toContain('--hf-bulk-center')
    expect(bar.get('[data-testid="bulk-docked-head"]').text()).toContain('3')
    expect(bar.get('[data-testid="bulk-docked-actions"]').findAll('[data-bulk-action]')).toHaveLength(2)
    const dock = ui.match(/\.hf-ui \.hf-bulk-bar--docked\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(dock).toMatch(/left:\s*0/)
    expect(dock).toMatch(/right:\s*0/)
    expect(dock).toMatch(/bottom:\s*0/)
    expect(dock).toMatch(/border-radius:\s*var\(--hf-radius-sheet\) var\(--hf-radius-sheet\) 0 0/)
    expect(dock).toMatch(/env\(safe-area-inset-bottom/)
  })

  it('stays the floating bar without `docked`', () => {
    const wrapper = mount(DataTableBulkActions, {
      props: { selectedCount: 3, totalCount: 86, actions, anchor: { left: 0, width: 800 } },
    })
    const bar = wrapper.get('.hf-bulk-bar')
    expect(bar.classes()).not.toContain('hf-bulk-bar--docked')
    expect(bar.attributes('style')).toContain('--hf-bulk-center')
    expect(wrapper.find('[data-testid="bulk-docked-head"]').exists()).toBe(false)
  })
})
