import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogFilterGroup from '../CatalogFilterGroup.vue'
import type { FilterGroup } from '../../utils/filter-model'

const stubs = {
  UIcon: defineComponent({
    props: { name: String },
    setup: (props) => () => h('span', { 'data-icon': props.name }),
  }),
}
const option = (index: number, pressed = false) => ({
  key: `o-${index}`,
  label: `Opción ${index}`,
  count: index,
  pressed,
  ariaLabel: `Grupo: Opción ${index}, ${index} productos`,
  target: { kind: 'category' as const, id: `o-${index}` },
})
const group = (size: number, pressedIndex = -1): FilterGroup => ({
  key: 'category',
  kind: 'category',
  label: 'Categoría',
  options: Array.from({ length: size }, (_, i) => option(i + 1, i + 1 === pressedIndex)),
  selectedLabel: pressedIndex > 0 ? `Opción ${pressedIndex}` : '',
})
const mountGroup = (g: FilterGroup, props: Record<string, unknown> = {}) =>
  mount(CatalogFilterGroup, { props: { group: g, ...props }, global: { stubs } })
const rows = (wrapper: ReturnType<typeof mountGroup>) => wrapper.findAll('button[aria-pressed]')

describe('CatalogFilterGroup', () => {
  it('renders labelled selectable rows with counts and no checkbox', () => {
    const wrapper = mountGroup(group(3, 2))
    expect(wrapper.get('h3').text()).toBe('Categoría')
    const list = wrapper.get('[role="group"]')
    expect(list.attributes('aria-labelledby')).toBe(wrapper.get('h3').attributes('id'))
    expect(rows(wrapper).map((row) => row.text().replace(/\s+/g, ' '))).toEqual([
      'Opción 1 1',
      'Opción 2 2',
      'Opción 3 3',
    ])
    expect(rows(wrapper).map((row) => row.attributes('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(rows(wrapper)[1]!.attributes('aria-label')).toBe('Grupo: Opción 2, 2 productos')
    expect(rows(wrapper).every((row) => row.attributes('type') === 'button')).toBe(true)
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('button[aria-expanded]').exists()).toBe(false)
  })

  it('emits the option when a row is pressed', async () => {
    const wrapper = mountGroup(group(3))
    await rows(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ key: 'o-3' })
  })

  it('shows five options and «Ver más (n)» for the rest, then «Ver menos»', async () => {
    const wrapper = mountGroup(group(7))
    expect(rows(wrapper)).toHaveLength(5)
    const more = wrapper.get('button[aria-expanded]')
    expect(more.text()).toContain('Ver más (2)')
    expect(more.attributes('aria-expanded')).toBe('false')
    await more.trigger('click')
    expect(rows(wrapper)).toHaveLength(7)
    expect(wrapper.get('button[aria-expanded]').text()).toContain('Ver menos')
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true')
    await wrapper.get('button[aria-expanded]').trigger('click')
    expect(rows(wrapper)).toHaveLength(5)
  })

  it('offers no «Ver más» at exactly five options and starts expanded when a hidden option is selected', () => {
    expect(mountGroup(group(5)).find('button[aria-expanded]').exists()).toBe(false)
    const wrapper = mountGroup(group(7, 7))
    expect(rows(wrapper)).toHaveLength(7)
  })

  it('collapses as an accordion section and reports its toggle', async () => {
    const wrapper = mountGroup(group(3, 2), { collapsible: true, open: false })
    const header = wrapper.get('button[data-testid="catalog-filter-group-toggle"]')
    expect(header.attributes('aria-expanded')).toBe('false')
    expect(header.text()).toContain('Categoría')
    expect(header.text()).toContain('Opción 2')
    expect(rows(wrapper)).toHaveLength(0)
    await header.trigger('click')
    expect(wrapper.emitted('toggle-open')).toHaveLength(1)
    await wrapper.setProps({ open: true })
    expect(rows(wrapper)).toHaveLength(3)
  })
})
