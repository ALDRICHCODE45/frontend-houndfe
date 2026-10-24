import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogLayout from '../CatalogLayout.vue'

describe('CatalogLayout theme boundary', () => {
  it('scopes the light surface to the catalog and restores host state on exit', () => {
    document.documentElement.classList.add('dark')
    document.documentElement.style.backgroundColor = 'red'
    document.body.style.backgroundColor = 'blue'
    const wrapper = mount(CatalogLayout, { slots: { default: '<p>Catálogo</p>' } })
    expect(document.body.getAttribute('data-catalog-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.body.style.backgroundColor).toBe('rgb(245, 246, 248)')
    wrapper.unmount()
    expect(document.body.hasAttribute('data-catalog-theme')).toBe(false)
    expect(document.documentElement.style.backgroundColor).toBe('red')
    expect(document.body.style.backgroundColor).toBe('blue')
    document.documentElement.classList.remove('dark')
    document.documentElement.style.backgroundColor = ''
    document.body.style.backgroundColor = ''
  })

  it('restores an existing boundary and leaves a newer background owner untouched', () => {
    document.body.setAttribute('data-catalog-theme', 'host')
    const wrapper = mount(CatalogLayout)
    document.body.style.backgroundColor = 'green'
    wrapper.unmount()
    expect(document.body.getAttribute('data-catalog-theme')).toBe('host')
    expect(document.body.style.backgroundColor).toBe('green')
    document.body.removeAttribute('data-catalog-theme')
    document.body.style.backgroundColor = ''
  })
})
