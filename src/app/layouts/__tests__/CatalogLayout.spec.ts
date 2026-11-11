import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
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

  it('sets the light boundary before its content renders', () => {
    let seen: string | null = 'unset'
    const Probe = defineComponent({
      setup() {
        seen = document.body.getAttribute('data-catalog-theme')
        return () => h('p', 'skeleton')
      },
    })
    const wrapper = mount(CatalogLayout, { slots: { default: () => h(Probe) } })
    expect(seen).toBe('light')
    wrapper.unmount()
  })

  it('keeps the boundary while a newer catalog layout is still mounted', () => {
    // A remount (route change or hot reload) can mount the new layout before the old one
    // unmounts; the old teardown must not strip the light scope from the live page.
    const first = mount(CatalogLayout)
    const second = mount(CatalogLayout)
    first.unmount()
    expect(document.body.getAttribute('data-catalog-theme')).toBe('light')
    expect(document.body.style.backgroundColor).toBe('rgb(245, 246, 248)')
    second.unmount()
    expect(document.body.hasAttribute('data-catalog-theme')).toBe(false)
    expect(document.body.style.backgroundColor).toBe('')
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
