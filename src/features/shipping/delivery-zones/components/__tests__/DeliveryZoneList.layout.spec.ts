/**
 * DeliveryZoneList — premium tables T9: the column layout (order, pinning, widths, visibility, density) is
 * persisted per user under `table-preferences-shipping-delivery-zones`, against the REAL AppDataTable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import DeliveryZoneList from '../DeliveryZoneList.vue'

const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const KEY = 'table-preferences-shipping-delivery-zones'

function mountList() {
  return mount(DeliveryZoneList, {
    props: { zones: [], canManage: true, totalCount: 0, pageCount: 0, pagination: { pageIndex: 0, pageSize: 20 } },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
}

beforeEach(() => localStorage.clear())

describe('DeliveryZoneList — persisted column layout', () => {
  it('restores the stored layout into every layout v-model and confirms saves', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      order: ['type', 'zipCode'],
      pinning: { left: ['type'], right: [] },
      sizing: { type: 180 },
      visibility: { approvedBy: false },
      density: 'compact',
    }))
    const table = mountList().getComponent({ name: 'AppDataTable' })
    expect(table.props('persistLayout')).toBe(true)
    expect(table.props('columnOrder')).toEqual(['type', 'zipCode', 'surchargeCents', 'etaDays', 'approvedBy', 'actions'])
    expect(table.props('columnPinning')).toEqual({ left: ['type'], right: ['actions'] })
    expect(table.props('columnSizing')).toEqual({ type: 180 })
    expect(table.props('columnVisibility')).toEqual({ approvedBy: false })
    expect(table.props('density')).toBe('compact')
  })

  it('saves a layout change and «Restablecer columnas» brings the defaults back', async () => {
    const table = mountList().getComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:columnSizing', { type: 200 })
    table.vm.$emit('update:density', 'normal')
    await nextTick()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(stored.sizing).toEqual({ type: 200 })
    expect(stored.density).toBe('normal')
    ;(table.props('onResetColumns') as () => void)()
    await nextTick()
    expect(table.props('columnSizing')).toEqual({})
    expect(table.props('density')).toBe('comfortable')
  })

  it('names every column for the «Columnas» panel and keeps the actions id', () => {
    const columns = mountList().getComponent({ name: 'AppDataTable' }).props('columns') as Array<{ id?: string; accessorKey?: string; header: unknown }>
    expect(columns.map(column => column.header)).toEqual(['Código postal', 'Tipo', 'Cargo', 'Entrega', 'Guardada por', 'Acciones'])
    expect(columns.every(column => typeof column.header === 'string' && column.header.length > 0)).toBe(true)
    expect(columns[columns.length - 1]!.id).toBe('actions')
  })
})
