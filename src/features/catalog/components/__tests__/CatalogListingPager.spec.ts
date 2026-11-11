import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogListingPager, { resultsRangeLabel } from '../CatalogListingPager.vue'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }
const mountPager = (page: number, totalPages: number, total: number, limit = 12) =>
  mount(CatalogListingPager, { props: { page, totalPages, total, limit }, global: { stubs } })

const button = (wrapper: ReturnType<typeof mountPager>, label: string) =>
  wrapper.findAll('button').find((entry) => entry.text() === label)!

describe('resultsRangeLabel', () => {
  it('reads «Mostrando a–b de N» from the response meta', () => {
    expect(resultsRangeLabel({ page: 1, limit: 12, total: 38 })).toBe(
      'Mostrando 1–12 de 38 productos',
    )
    expect(resultsRangeLabel({ page: 4, limit: 12, total: 38 })).toBe(
      'Mostrando 37–38 de 38 productos',
    )
    expect(resultsRangeLabel({ page: 1, limit: 20, total: 1 })).toBe('Mostrando 1–1 de 1 producto')
    expect(resultsRangeLabel({ page: 1, limit: 20, total: 0 })).toBeNull()
    expect(resultsRangeLabel({ page: 5, limit: 20, total: 30 })).toBeNull()
  })
})

describe('CatalogListingPager', () => {
  it('numbers the pages on desktop and keeps a compact «Página X de Y» for phones', async () => {
    const wrapper = mountPager(2, 4, 38)
    const nav = wrapper.get('nav[aria-label="Paginación del catálogo"]')
    expect(nav.text()).toContain('Mostrando 13–24 de 38 productos')
    const pages = wrapper.findAll('.catalog-pager-pages button')
    expect(pages.map((entry) => entry.text())).toEqual(['1', '2', '3', '4'])
    expect(pages[1]!.attributes('aria-current')).toBe('page')
    expect(pages[0]!.attributes('aria-current')).toBeUndefined()
    expect(pages[2]!.attributes('aria-label')).toBe('Página 3')
    expect(wrapper.get('.catalog-pager-compact').text()).toBe('Página 2 de 4')

    await pages[3]!.trigger('click')
    await button(wrapper, 'Anterior').trigger('click')
    await button(wrapper, 'Siguiente').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([[4], [1], [3]])
  })

  it('disables the edges and never emits outside the metadata range', async () => {
    const first = mountPager(1, 3, 30)
    expect(button(first, 'Anterior').attributes('disabled')).toBeDefined()
    expect(button(first, 'Siguiente').attributes('disabled')).toBeUndefined()
    await first.get('.catalog-pager-pages button[aria-current="page"]').trigger('click')
    expect(first.emitted('navigate')).toBeUndefined()

    const last = mountPager(3, 3, 30)
    expect(button(last, 'Siguiente').attributes('disabled')).toBeDefined()
  })

  it('collapses long ranges around the current page with an ellipsis', () => {
    const wrapper = mountPager(6, 12, 140)
    expect(wrapper.findAll('.catalog-pager-pages li').map((entry) => entry.text())).toEqual([
      '1',
      '…',
      '5',
      '6',
      '7',
      '…',
      '12',
    ])
  })
})
