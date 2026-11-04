import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'

// The toolbar must not change shape between states: "Columnas" stays in the loading skeleton and
// in the error block (disabled, there is no table to configure) and works again with data.
const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

type Row = { id: number; name: string }
const columns = [{ accessorKey: 'name', header: 'Nombre' }]
const rows: Row[] = [{ id: 1, name: 'Alpha' }]

function mountTable(props: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: {
      columns,
      data: rows,
      totalCount: 1,
      pageCount: 1,
      enableColumnVisibility: true,
      ...props,
    },
    global: {
      stubs: {
        UTooltip: { template: '<div><slot /></div>' },
        USlideover: { template: '<div><slot name="content" /></div>' },
        DataTablePagination: { template: '<div />' },
        DataTableBulkActions: { template: '<div />' },
      },
    },
  })
}

const desktopColumns = (w: ReturnType<typeof mountTable>) =>
  w.findAll('button').filter(b => b.text().includes('Columnas'))
const mobileColumns = (w: ReturnType<typeof mountTable>) =>
  w.find('[data-testid="toolbar-mobile-columns-button"]')

describe('AppDataTable "Columnas" across states (desktop)', () => {
  beforeEach(() => { isBelowBreakpoint.value = false })

  it('shows a disabled Columnas control while the first load shows the skeleton', () => {
    const wrapper = mountTable({ loading: true, data: [], totalCount: 0, pageCount: 0 })
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(true)
    const buttons = desktopColumns(wrapper)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
  })

  it('shows a disabled Columnas control in the error state', () => {
    const wrapper = mountTable({ error: true, errorMessage: 'No pudimos cargar', data: [] })
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    const buttons = desktopColumns(wrapper)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
  })

  it('enables Columnas once the table renders with data', async () => {
    const wrapper = mountTable()
    await wrapper.vm.$nextTick()
    const buttons = desktopColumns(wrapper)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.attributes('disabled')).toBeUndefined()
  })

  it('does not add the control when the feature does not enable column visibility', () => {
    const wrapper = mountTable({ enableColumnVisibility: false, error: true, data: [] })
    expect(desktopColumns(wrapper)).toHaveLength(0)
  })
})

describe('AppDataTable "Columnas" across states (mobile table)', () => {
  beforeEach(() => { isBelowBreakpoint.value = true })

  it('keeps a disabled Columnas control in loading and error', () => {
    const loading = mountTable({ loading: true, data: [], totalCount: 0, pageCount: 0 })
    expect(mobileColumns(loading).exists()).toBe(true)
    expect(mobileColumns(loading).attributes('disabled')).toBeDefined()

    const failed = mountTable({ error: true, data: [] })
    expect(mobileColumns(failed).exists()).toBe(true)
    expect(mobileColumns(failed).attributes('disabled')).toBeDefined()
  })
})
