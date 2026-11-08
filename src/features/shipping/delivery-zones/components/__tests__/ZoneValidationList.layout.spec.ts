/**
 * ZoneValidationList — premium tables T9: the column layout (order, pinning, widths, visibility, density) is
 * persisted per user under `table-preferences-shipping-zone-validations`, against the REAL AppDataTable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import ZoneValidationList from '../ZoneValidationList.vue'

const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const KEY = 'table-preferences-shipping-zone-validations'

function mountList() {
  return mount(ZoneValidationList, {
    props: { validations: [], now: 0, totalCount: 0, pageCount: 0, pagination: { pageIndex: 0, pageSize: 20 } },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
}

beforeEach(() => localStorage.clear())

describe('ZoneValidationList — persisted column layout', () => {
  it('restores the stored layout into every layout v-model and confirms saves', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      order: ['urgency', 'zipCode'],
      pinning: { left: ['urgency'], right: [] },
      sizing: { urgency: 180 },
      visibility: { lastCustomerMessageAt: false },
      density: 'compact',
    }))
    const table = mountList().getComponent({ name: 'AppDataTable' })
    expect(table.props('persistLayout')).toBe(true)
    expect(table.props('columnOrder')).toEqual(['urgency', 'zipCode', 'requesterCount', 'lastCustomerMessageAt'])
    expect(table.props('columnPinning')).toEqual({ left: ['urgency'], right: [] })
    expect(table.props('columnSizing')).toEqual({ urgency: 180 })
    expect(table.props('columnVisibility')).toEqual({ lastCustomerMessageAt: false })
    expect(table.props('density')).toBe('compact')
  })

  it('saves a layout change and «Restablecer columnas» brings the defaults back', async () => {
    const table = mountList().getComponent({ name: 'AppDataTable' })
    table.vm.$emit('update:columnSizing', { urgency: 200 })
    table.vm.$emit('update:density', 'normal')
    await nextTick()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(stored.sizing).toEqual({ urgency: 200 })
    expect(stored.density).toBe('normal')
    ;(table.props('onResetColumns') as () => void)()
    await nextTick()
    expect(table.props('columnSizing')).toEqual({})
    expect(table.props('density')).toBe('comfortable')
  })

  it('names every column for the «Columnas» panel and keeps the actions id', () => {
    const columns = mountList().getComponent({ name: 'AppDataTable' }).props('columns') as Array<{ id?: string; accessorKey?: string; header: unknown }>
    expect(columns.map(column => column.header)).toEqual(['Código postal', 'Plazo', 'Clientes', 'Último mensaje'])
    expect(columns.every(column => typeof column.header === 'string' && column.header.length > 0)).toBe(true)
  })
})
