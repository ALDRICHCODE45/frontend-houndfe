import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogFilterSidebar from '../CatalogFilterSidebar.vue'
import type { FilterGroup } from '../../utils/filter-model'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }
const groups: FilterGroup[] = [
  {
    key: 'category',
    kind: 'category',
    label: 'Categoría',
    selectedLabel: '',
    options: [
      {
        key: 'c-1',
        label: 'Accesorios',
        count: 9,
        pressed: false,
        ariaLabel: 'Categoría: Accesorios, 9 productos',
        target: { kind: 'category', id: 'c-1' },
      },
    ],
  },
]

describe('CatalogFilterSidebar', () => {
  it('is a labelled aside with «Filtrar por», one section per group and no hint by default', () => {
    const wrapper = mount(CatalogFilterSidebar, {
      props: { groups, hint: false },
      global: { stubs },
    })
    const aside = wrapper.get('aside')
    expect(aside.attributes('aria-label')).toBe('Filtros del catálogo')
    expect(aside.text()).toContain('Filtrar por')
    expect(wrapper.findAll('section')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Elige un destinatario')
  })

  it('shows the recipient hint and forwards the chosen option', async () => {
    const wrapper = mount(CatalogFilterSidebar, {
      props: { groups, hint: true },
      global: { stubs },
    })
    expect(wrapper.text()).toContain(
      'Elige un destinatario para ver filtros de etapa, tamaño y más.',
    )
    await wrapper.get('button[aria-pressed]').trigger('click')
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ key: 'c-1' })
  })
})
