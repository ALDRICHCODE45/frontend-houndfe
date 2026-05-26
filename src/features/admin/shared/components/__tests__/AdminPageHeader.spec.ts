import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminPageHeader from '../AdminPageHeader.vue'

describe('AdminPageHeader', () => {
  it('renders title in an h2', () => {
    const wrapper = mount(AdminPageHeader, {
      props: { title: 'Gestión de usuarios' },
    })

    const h2 = wrapper.find('h2')
    expect(h2.exists()).toBe(true)
    expect(h2.text()).toBe('Gestión de usuarios')
  })

  it('renders description prop in a paragraph', () => {
    const wrapper = mount(AdminPageHeader, {
      props: { title: 'Foo', description: 'Administrá los usuarios de Centro' },
    })

    const p = wrapper.find('p')
    expect(p.exists()).toBe(true)
    expect(p.text()).toBe('Administrá los usuarios de Centro')
  })

  it('omits the paragraph when description is empty and no subtitle slot is provided', () => {
    const wrapper = mount(AdminPageHeader, {
      props: { title: 'Foo' },
    })

    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('renders the subtitle slot when provided, overriding description', () => {
    const wrapper = mount(AdminPageHeader, {
      props: { title: 'Foo', description: 'IGNORED' },
      slots: {
        subtitle: '<span data-testid="custom">Custom subtitle</span>',
      },
    })

    expect(wrapper.find('[data-testid="custom"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Custom subtitle')
    expect(wrapper.text()).not.toContain('IGNORED')
  })

  it('shows a skeleton placeholder when loading is true', () => {
    const wrapper = mount(AdminPageHeader, {
      props: { title: 'Foo', loading: true },
    })

    // Look for the skeleton via its data attribute (no dependency on USkeleton internals)
    expect(wrapper.find('[data-testid="admin-page-header-loading"]').exists()).toBe(true)
  })

  it('exposes fallbackText only when description is empty and loading is false', () => {
    const wrapper = mount(AdminPageHeader, {
      props: { title: 'Foo', fallbackText: 'Sin sucursal' },
    })

    expect(wrapper.text()).toContain('Sin sucursal')
  })
})
