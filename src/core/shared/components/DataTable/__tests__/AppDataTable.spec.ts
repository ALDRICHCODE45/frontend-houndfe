import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'

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

type Row = { id: number; name: string }

const columns = [{ accessorKey: 'name', header: 'Name' }]
const data: Row[] = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]

function mountComponent(overrideProps: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: {
      columns,
      data,
      totalCount: data.length,
      pageCount: 1,
      ...overrideProps,
    },
    slots: {
      'mobile-card': ({ row, index }) =>
        h('article', { 'data-testid': 'mobile-card' }, `${index}:${row.name}`),
    },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /><slot name="actions" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableBulkActions: { template: '<div data-testid="bulk-actions" />' },
        UTable: { template: '<div data-testid="table" v-bind="$attrs" />' },
      },
    },
  })
}

describe('AppDataTable mobile rendering', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = false
  })

  it('keeps default behavior as table rendering', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-card"]').exists()).toBe(false)
  })

  it('renders mobile-card slot when mobileRender is cards and below breakpoint', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards' })

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="mobile-card"]')).toHaveLength(2)
  })

  it('renders table when mobileRender is cards and viewport is above breakpoint', () => {
    isBelowBreakpoint.value = false
    const wrapper = mountComponent({ mobileRender: 'cards' })

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-card"]').exists()).toBe(false)
  })

  it('shows loading skeleton cards in cards mode on mobile', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards', loading: true, data: [] })

    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
  })

  it('shows empty message in cards mode when there is no data', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards', data: [], totalCount: 0 })

    expect(wrapper.find('[data-testid="mobile-empty-state"]').text()).toContain('No se encontraron resultados')
  })

  it('keeps pagination visible in cards mode', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards' })

    expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(true)
  })
})
