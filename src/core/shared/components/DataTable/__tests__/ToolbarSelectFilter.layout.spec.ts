import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import DataTableToolbar from '../DataTableToolbar.vue'
import ToolbarSelectFilter from '../ToolbarSelectFilter.vue'

// jsdom has no layout: these specs pin the class and structure contract that makes the filter
// share the search row from md up (verified in Chromium against the production CSS at 1440px).
const dispose: Array<() => void> = []
afterEach(() => { dispose.splice(0).forEach(fn => fn()); document.body.innerHTML = '' })

function mountToolbar() {
  const root = mount(defineComponent({
    setup: () => () => h(UApp, null, { default: () => h(DataTableToolbar, { globalFilter: '', showRefresh: true }, {
      filters: () => h(ToolbarSelectFilter, { modelValue: 'ALL', items: [{ label: 'Todas', value: 'ALL' }], label: 'Estado', testId: 'status-filter' }),
      actions: () => h('button', { 'data-testid': 'create' }, 'Nueva orden'),
    }) }),
  }), { attachTo: document.body })
  dispose.push(() => root.unmount())
  return root
}
const classes = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/)

describe('inline toolbar filter layout (md+)', () => {
  it('puts the filter and the search in one flexible region, with the actions as its right-hand sibling', () => {
    mountToolbar()
    const toolbar = document.querySelector('.hf-toolbar')!
    expect(classes(toolbar)).toEqual(expect.arrayContaining(['md:flex-row', 'md:items-center', 'md:justify-between', 'min-w-0', 'max-w-full']))
    const [region, actions] = Array.from(toolbar.children).filter(child => child.nodeType === 1)
    expect(classes(region!)).toEqual(expect.arrayContaining(['hf-toolbar-search-region', 'flex-1', 'sm:flex-row', 'sm:items-center']))
    expect(classes(actions!)).toContain('hf-toolbar-actions')
    expect(actions!.querySelector('[data-testid="create"]')).not.toBeNull()
    const search = region!.querySelector('.hf-toolbar-search')!
    const filters = region!.querySelector('.hf-toolbar-filters')!
    expect(search.parentElement).toBe(region)
    expect(filters.parentElement).toBe(region)
    expect(filters.querySelector('[data-testid="status-filter"]')).not.toBeNull()
  })
  it('caps the search width so the filter always keeps room, and lets the filters track shrink', () => {
    mountToolbar()
    expect(classes(document.querySelector('.hf-toolbar-search'))).toEqual(expect.arrayContaining(['w-full', 'sm:max-w-sm']))
    expect(classes(document.querySelector('.hf-toolbar-filters'))).toEqual(expect.arrayContaining(['min-w-0', 'flex-1']))
  })
  it('dissolves the mobile section card on md+ and keeps the select at a fixed width that never shrinks away', () => {
    mountToolbar()
    const select = document.querySelector('[data-testid="status-filter"]')!
    expect(classes(select)).toEqual(expect.arrayContaining(['hf-toolbar-select', 'w-full', 'md:w-44', 'md:shrink-0']))
    const card = select.parentElement!
    expect(classes(card)).toContain('md:contents')
    expect(classes(card.querySelector('p'))).toContain('md:hidden')
  })
})

describe('evidence server', () => {
  it('points the Tailwind scan back at src, so utilities that only appear there are generated', () => {
    // @tailwindcss/vite scans from the Vite root; with the evidence directory as root, md:flex-row,
    // sm:max-w-sm and max-w-3xl were missing and the screenshots showed a layout production does not have.
    const server = readFileSync('odd/evidence/procurement-order-confirmation/start-runtime-server.mjs', 'utf8')
    expect(server).toMatch(/@source "\.\.\/"/)
    expect(server).toMatch(/src\/assets\/main\.css/)
    expect(server).toMatch(/enforce: 'pre'/)
  })
})
