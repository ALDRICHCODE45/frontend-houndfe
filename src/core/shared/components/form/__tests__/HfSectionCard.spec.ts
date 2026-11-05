import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import HfFieldGrid from '../HfFieldGrid.vue'
import HfSectionCard from '../HfSectionCard.vue'

describe('HfSectionCard', () => {
  it('is a labelled section with a heading, a meta slot and a body', () => {
    const wrapper = mount(HfSectionCard, {
      props: { id: 'para-quien', title: 'Para quién' },
      slots: { meta: () => 'Revisada el 4 nov 2026', default: () => h('p', 'Campos') },
    })
    const section = wrapper.get('section.hf-section-card')
    expect(section.attributes('id')).toBe('para-quien')
    const heading = section.get('h3')
    expect(heading.text()).toBe('Para quién')
    expect(section.attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(heading.attributes('tabindex')).toBe('-1')
    expect(section.get('.hf-section-card__meta').text()).toBe('Revisada el 4 nov 2026')
    expect(section.text()).toContain('Campos')
  })

  it('renders no meta box without the slot and honours the heading level', () => {
    const wrapper = mount(HfSectionCard, { props: { title: 'Uso', headingLevel: 2 } })
    expect(wrapper.find('.hf-section-card__meta').exists()).toBe(false)
    expect(wrapper.get('h2').text()).toBe('Uso')
  })
})

describe('HfFieldGrid', () => {
  it('lays fields on the shared grid; a span="full" child spans both columns', () => {
    const wrapper = mount(HfFieldGrid, {
      slots: { default: () => [h('div', { class: 'a' }), h('div', { class: 'b', span: 'full' })] },
    })
    expect(wrapper.find('.hf-field-grid').exists()).toBe(true)
    expect(wrapper.get('.b').attributes('span')).toBe('full')
  })
})
