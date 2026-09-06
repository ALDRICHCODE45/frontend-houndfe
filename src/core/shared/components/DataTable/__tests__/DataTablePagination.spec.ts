import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTablePagination from '../DataTablePagination.vue'

// S1 contract tests. jsdom asserts class/DOM/emit contracts only — no
// geometry claims. The zero-based pageIndex / page-size bridge and both
// update events are existing semantics and must not change.

function menuStub() {
  return {
    props: ['items'],
    template: `<div data-testid="page-size-menu"><button data-testid="page-size-first" type="button" @click="items[0][0].onSelect()" /></div>`,
  }
}

function paginationStub() {
  return {
    props: ['page'],
    emits: ['update:page'],
    template: `<ul data-testid="pagination-list" :data-page="String(page)" v-bind="$attrs" @click="$emit('update:page', page + 1)" />`,
  }
}

const baseStubs = {
  UDropdownMenu: menuStub(),
  DropdownMenu: menuStub(),
  UPagination: paginationStub(),
  Pagination: paginationStub(),
}

function mountPagination(propsOverride: Record<string, unknown> = {}) {
  return mount(DataTablePagination, {
    props: {
      pageIndex: 0,
      pageSize: 10,
      pageCount: 3,
      totalCount: 25,
      showingFrom: 1,
      showingTo: 10,
      ...propsOverride,
    },
    global: { stubs: baseStubs },
  })
}

function expectShrinkContainment(classes: string[]) {
  expect(classes).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']))
}

describe('DataTablePagination — unchanged value bridge and content', () => {
  it('emits a zero-based pageIndex when UPagination reports the next one-based page', async () => {
    const wrapper = mountPagination({ pageIndex: 4 })
    // The stub receives one-based page 5; a click reports page 6, so the
    // component must emit 5 (zero-based) on update:pageIndex.
    const list = wrapper.get('[data-testid="pagination-list"]')
    expect(list.attributes('data-page')).toBe('5')
    await list.trigger('click')
    expect(wrapper.emitted('update:pageIndex')).toEqual([[5]])
  })

  it('emits the selected page size from the page-size menu', async () => {
    const wrapper = mountPagination({ pageSizeOptions: [5, 10, 20, 50] })
    await wrapper.get('[data-testid="page-size-first"]').trigger('click')
    expect(wrapper.emitted('update:pageSize')).toEqual([[5]])
  })

  it('renders the showing range, the empty fallback, and the fetching-disabled state', () => {
    expect(mountPagination().text()).toContain('Mostrando 1-10 de 25')
    expect(
      mountPagination({ totalCount: 0, showingFrom: 0, showingTo: 0 }).text(),
    ).toContain('Sin resultados')
    expect(
      mountPagination({ fetching: true }).get('[data-testid="pagination-list"]').attributes('disabled'),
    ).toBeDefined()
  })
})

describe('DataTablePagination — mobile containment (S1)', () => {
  it('stacks on mobile, returns to the row at sm, and keeps the historical root classes', () => {
    const classes = mountPagination().element.className.split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row', 'border-t']))
    expectShrinkContainment(classes)
  })

  it('stacks the controls in a w-full min-w-0 column that rows at sm', () => {
    const classes = mountPagination().get('[data-testid="pagination-controls"]').classes()
    expect(classes).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'flex-col', 'sm:flex-row']))
  })

  it('keeps a max-width-safe list with no horizontal-scroll workaround', () => {
    const classes = mountPagination().get('[data-testid="pagination-list"]').classes()
    // The list must be shrink-safe and bounded by its container; w-full is
    // intentionally NOT forced on it so the sm+ row layout is unchanged.
    expect(classes).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full']))
    expect(classes).not.toContain('overflow-x-auto')
  })
})
