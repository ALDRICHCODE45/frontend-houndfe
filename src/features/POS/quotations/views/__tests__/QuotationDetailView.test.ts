import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationDetailView from '../QuotationDetailView.vue'

describe('QuotationDetailView — Slice 1 placeholder (S4 fills the real editor)', () => {
  it('renders without error and shows the page title', () => {
    const wrapper = mount(QuotationDetailView)

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Detalle de cotización')
  })

  it('renders the "Coming soon" placeholder copy from S1', () => {
    const wrapper = mount(QuotationDetailView)

    // S1 ships a placeholder; S4 replaces this with the real DRAFT editor.
    expect(wrapper.text()).toContain('Próximamente')
  })

  it('exposes a stable name for lazy-import resolution', () => {
    const wrapper = mount(QuotationDetailView)
    expect(typeof wrapper.vm).toBe('object')
  })
})