/**
 * SupplierList — premium tables T9: the column layout (order, pinning, widths, visibility, density) is
 * persisted per user under `table-preferences-procurement-suppliers`, against the REAL AppDataTable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import SupplierList from '../SupplierList.vue'

const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const KEY = 'table-preferences-procurement-suppliers'

function mountList() {
  return mount(SupplierList, {
    props: { items: [], canEdit: true },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
}

beforeEach(() => localStorage.clear())

describe('SupplierList — persisted column layout', () => {
  it('restores the stored layout into every layout v-model and confirms saves', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      order: ['status', 'displayName'],
      pinning: { left: ['status'], right: [] },
      sizing: { status: 180 },
      visibility: { updatedAt: false },
      density: 'compact',
    }))
    const table = mountList().getComponent({ name: 'AppDataTable' })
    expect(table.props('persistLayout')).toBe(true)
    expect(table.props('columnOrder')).toEqual(['status', 'displayName', 'updatedAt', 'actions'])
    expect(table.props('columnPinning')).toEqual({ left: ['status'], right: ['actions'] })
    expect(table.props('columnSizing')).toEqual({ status: 180 })
    expect(table.props('columnVisibility')).toEqual({ updatedAt: false })
    expect(table.props('density')).toBe('compact')
  })

  it('saves a layout change and «Restablecer columnas» brings the defaults back', async () => {
    const table = mountList().getComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:columnSizing', { status: 200 })
    table.vm.$emit('update:density', 'normal')
    await nextTick()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(stored.sizing).toEqual({ status: 200 })
    expect(stored.density).toBe('normal')
    ;(table.props('onResetColumns') as () => void)()
    await nextTick()
    expect(table.props('columnSizing')).toEqual({})
    expect(table.props('density')).toBe('comfortable')
  })

  it('names every column for the «Columnas» panel and keeps the actions id', () => {
    const columns = mountList().getComponent({ name: 'AppDataTable' }).props('columns') as Array<{ id?: string; accessorKey?: string; header: unknown }>
    expect(columns.map(column => column.header)).toEqual(['Proveedor', 'Estado', 'Actualizado', 'Acciones'])
    expect(columns.every(column => typeof column.header === 'string' && column.header.length > 0)).toBe(true)
    expect(columns[columns.length - 1]!.id).toBe('actions')
  })
})
