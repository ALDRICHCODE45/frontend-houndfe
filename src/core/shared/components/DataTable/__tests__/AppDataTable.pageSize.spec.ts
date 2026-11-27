import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDataTable from '../AppDataTable.vue'

type Row = { id: number; name: string }

const paginationProbe = {
  name: 'DataTablePagination',
  props: ['pageSizeOptions', 'pageSize', 'pageIndex'],
  emits: ['update:pageSize', 'update:pageIndex'],
  template: `<div data-testid="pagination" :data-options="pageSizeOptions.join(',')" :data-size="pageSize">
    <button data-testid="choose-35" type="button" @click="$emit('update:pageSize', 35)" />
  </div>`,
}

function mountTable(props: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: {
      columns: [{ accessorKey: 'name', header: 'Name' }],
      data: [{ id: 1, name: 'Alpha' }],
      totalCount: 120,
      pageCount: 12,
      showToolbar: false,
      ...props,
    },
    global: { stubs: { DataTablePagination: paginationProbe } },
  })
}

describe('AppDataTable — page size options', () => {
  it('offers 5 to 50 in steps of 5 by default', () => {
    const wrapper = mountTable()
    expect(wrapper.get('[data-testid="pagination"]').attributes('data-options')).toBe(
      '5,10,15,20,25,30,35,40,45,50',
    )
  })

  it('keeps the options a table passes', () => {
    const wrapper = mountTable({ pageSizeOptions: [20, 50, 100] })
    expect(wrapper.get('[data-testid="pagination"]').attributes('data-options')).toBe('20,50,100')
  })

  it('emits the chosen size with the page recalculated as today', async () => {
    const wrapper = mountTable({ pagination: { pageIndex: 3, pageSize: 10 } })
    await wrapper.get('[data-testid="choose-35"]').trigger('click')
    const emitted = wrapper.emitted('update:pagination') ?? []
    expect(emitted[emitted.length - 1]).toEqual([{ pageIndex: 0, pageSize: 35 }])
  })
})
