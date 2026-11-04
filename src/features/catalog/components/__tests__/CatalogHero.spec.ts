import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CatalogHero from '../CatalogHero.vue'

describe('CatalogHero', () => {
  it('uses the original companion photograph and a real catalog anchor', async () => {
    const target = document.createElement('section')
    target.id = 'catalogo'
    target.tabIndex = -1
    target.scrollIntoView = vi.fn()
    document.body.append(target)
    const wrapper = mount(CatalogHero)
    try {
      const image = wrapper.get('img')
      expect(image.attributes('src')).toBe('/images/catalog-companions.png')
      expect(image.attributes('alt')).toBe('Perro golden retriever y gato juntos en un estudio')
      expect(wrapper.get('h1').text()).toBe('Todo para quienes te acompañan.')
      const action = wrapper.get('a')
      expect(action.attributes('href')).toBe('#catalogo')
      await action.trigger('click')
      expect(target.scrollIntoView).toHaveBeenCalled()
      expect(document.activeElement).toBe(target)
    } finally {
      wrapper.unmount()
      target.remove()
    }
  })

  it('keeps the title, one line and one action: no eyebrow and no photo caption', () => {
    const wrapper = mount(CatalogHero)
    try {
      expect(wrapper.find('.catalog-hero-eyebrow').exists()).toBe(false)
      expect(wrapper.find('.catalog-hero-caption').exists()).toBe(false)
      expect(wrapper.findAll('p')).toHaveLength(1)
      expect(wrapper.findAll('a')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })
})
