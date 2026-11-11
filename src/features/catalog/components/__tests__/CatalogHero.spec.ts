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

  it('draws the approved hero: branch eyebrow, one line, one action and the photo caption', () => {
    const wrapper = mount(CatalogHero, { props: { branchName: 'Sucursal Centro' } })
    try {
      expect(wrapper.get('.catalog-hero-eyebrow').text()).toBe('Tienda en línea · Sucursal Centro')
      expect(wrapper.get('.catalog-hero-copy p').text()).toBe(
        'Consulta presentaciones, precios y disponibilidad de tu sucursal.',
      )
      expect(wrapper.get('.catalog-hero-caption').text()).toBe(
        'Grandes compañeros.Pequeños cuidados, todos los días.',
      )
      expect(wrapper.findAll('a')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps the eyebrow generic until a branch is selected', () => {
    const wrapper = mount(CatalogHero)
    try {
      expect(wrapper.get('.catalog-hero-eyebrow').text()).toBe('Tienda en línea')
    } finally {
      wrapper.unmount()
    }
  })
})
