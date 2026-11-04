import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'

// A list with no filters must not show a mobile "Filtros" control. AppDataTable used to forward
// `<template #filters><slot name="filters" /></template> unconditionally, so the toolbar saw a slot
// that rendered an empty fragment and drew a button that opened an empty sheet.
const isBelowBreakpoint = ref(true)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

type Row = { id: number; name: string }
const columns = [{ accessorKey: 'name', header: 'Nombre' }]
const rows: Row[] = [{ id: 1, name: 'Alpha' }]

function mountTable(slots: Record<string, () => unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: { columns, data: rows, totalCount: 1, pageCount: 1, mobileRender: 'cards' },
    slots: { 'mobile-card': () => h('article', 'card'), ...slots },
    global: {
      stubs: {
        UTooltip: { template: '<div><slot /></div>' },
        UDropdownMenu: { template: '<div><slot /></div>' },
        USlideover: { template: '<div data-testid="slideover"><slot name="content" /></div>' },
        DataTablePagination: { template: '<div />' },
        DataTableBulkActions: { template: '<div />' },
      },
    },
  })
}
const filtros = (wrapper: ReturnType<typeof mountTable>) => wrapper.find('[data-testid="toolbar-filtros-button"]')

describe('AppDataTable toolbar slots on mobile', () => {
  beforeEach(() => { isBelowBreakpoint.value = true })

  it('shows no Filtros control when the screen has no #filters', () => {
    const wrapper = mountTable()
    expect(filtros(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-testid="toolbar-mobile-filters-row"]').exists()).toBe(false)
  })

  it('shows no empty controls row when there are neither filters nor actions', () => {
    const wrapper = mountTable()
    expect(wrapper.find('[data-testid="toolbar-mobile-controls-row"]').exists()).toBe(false)
  })

  it('shows Filtros once a screen provides #filters', () => {
    const wrapper = mountTable({ filters: () => h('span', { 'data-testid': 'a-filter' }, 'f') })
    expect(filtros(wrapper).exists()).toBe(true)
  })

  it('keeps the actions slot and shows the controls row only when it is provided', () => {
    const wrapper = mountTable({ actions: () => h('button', { 'data-testid': 'an-action' }, 'Nuevo') })
    expect(wrapper.find('[data-testid="an-action"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toolbar-mobile-controls-row"]').exists()).toBe(true)
    expect(filtros(wrapper).exists()).toBe(false)
  })

  it('does the same on desktop: no filters region content without #filters', () => {
    isBelowBreakpoint.value = false
    const wrapper = mountTable()
    expect(wrapper.find('.hf-toolbar-filters').element?.children.length ?? 0).toBe(0)
  })
})
