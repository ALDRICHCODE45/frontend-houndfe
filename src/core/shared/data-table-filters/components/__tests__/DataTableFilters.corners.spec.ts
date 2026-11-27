import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import DataTableFilters from '../DataTableFilters.vue'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'

// slideover-corners S2: the desktop filters panel is an inset slideover whose sticky
// `bg-default` header used to paint square corners over the panel's 12px curve. The real Nuxt
// UI slideover (not a stub) must put the radius and the clip on the same dialog element.
vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return { ...actual, useBreakpoints: () => ({ greaterOrEqual: () => ref(true) }) }
})

const schema = defineFiltersSchema([filter.multiText({ id: 'folio', label: 'Folio', param: 'folio' })])

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('DataTableFilters — desktop panel corners', () => {
  it('the open dialog panel is rounded and clips its children', async () => {
    wrapper = mount(defineComponent({
      setup: () => () => h(UApp, null, { default: () => h(DataTableFilters, { schema, state: schema.defaults() }) }),
    }), {
      attachTo: document.body,
      global: { stubs: { MultiTextInputFilter: true, DataTableFiltersChips: true } },
    })
    await flushPromises()
    await wrapper.get('[data-testid="filters-trigger"]').trigger('click')
    await flushPromises()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.querySelector('[data-testid="filters-header"]')).not.toBeNull()
    const classes = dialog!.className.split(/\s+/)
    expect(dialog!.getAttribute('data-side')).toBe('right')
    expect(classes).toContain('rounded-lg')
    expect(classes).toContain('overflow-hidden')
  })
})
