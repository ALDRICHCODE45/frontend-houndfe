/**
 * ShippingBoxList — premium tables T9: the column layout (order, pinning, widths, visibility, density) is
 * persisted per user under `table-preferences-shipping-boxes`, against the REAL AppDataTable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import ShippingBoxList from '../ShippingBoxList.vue'

const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const KEY = 'table-preferences-shipping-boxes'

function mountList() {
  return mount(ShippingBoxList, {
    props: { boxes: [], canUpdate: true },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
}

beforeEach(() => localStorage.clear())

describe('ShippingBoxList — persisted column layout', () => {
  it('restores the stored layout into every layout v-model and confirms saves', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      order: ['weight', 'name'],
      pinning: { left: ['weight'], right: [] },
      sizing: { weight: 180 },
      visibility: { isActive: false },
      density: 'compact',
    }))
    const table = mountList().getComponent({ name: 'AppDataTable' })
    expect(table.props('persistLayout')).toBe(true)
    expect(table.props('columnOrder')).toEqual(['weight', 'name', 'capacity', 'isActive', 'actions'])
    expect(table.props('columnPinning')).toEqual({ left: ['weight'], right: ['actions'] })
    expect(table.props('columnSizing')).toEqual({ weight: 180 })
    expect(table.props('columnVisibility')).toEqual({ isActive: false })
    expect(table.props('density')).toBe('compact')
  })

  it('saves a layout change and «Restablecer columnas» brings the defaults back', async () => {
    const table = mountList().getComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:columnSizing', { weight: 200 })
    table.vm.$emit('update:density', 'normal')
    await nextTick()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(stored.sizing).toEqual({ weight: 200 })
    expect(stored.density).toBe('normal')
    ;(table.props('onResetColumns') as () => void)()
    await nextTick()
    expect(table.props('columnSizing')).toEqual({})
    expect(table.props('density')).toBe('comfortable')
  })

  it('names every column for the «Columnas» panel and keeps the actions id', () => {
    const columns = mountList().getComponent({ name: 'AppDataTable' }).props('columns') as Array<{ id?: string; accessorKey?: string; header: unknown }>
    expect(columns.map(column => column.header)).toEqual(['Caja', 'Peso de la caja', 'Carga hasta', 'Estado', 'Acciones'])
    expect(columns.every(column => typeof column.header === 'string' && column.header.length > 0)).toBe(true)
    expect(columns[columns.length - 1]!.id).toBe('actions')
  })
})
