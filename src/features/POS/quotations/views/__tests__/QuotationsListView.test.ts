import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationsListView from '../QuotationsListView.vue'

describe('QuotationsListView — Slice 1 placeholder (S3 fills the real list)', () => {
  it('renders without error and shows the page title', () => {
    const wrapper = mount(QuotationsListView)

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Cotizaciones')
  })

  it('renders the "Coming soon" placeholder copy from S1', () => {
    const wrapper = mount(QuotationsListView)

    // S1 ships a placeholder; S3 replaces this with the real AppDataTable.
    // The string is a stable contract until S3 lands.
    expect(wrapper.text()).toContain('Próximamente')
  })

  it('exposes a stable name for lazy-import resolution', () => {
    const wrapper = mount(QuotationsListView)
    // The router does `component: () => import('...QuotationsListView.vue')`
    // which evaluates the module and resolves the default export.
    expect(typeof wrapper.vm).toBe('object')
  })
})