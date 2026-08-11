import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTableToolbar from '../DataTableToolbar.vue'

/**
 * Helper — wraps the mount with the minimum stubbing needed to bypass
 * browser-only APIs that Nuxt UI's components touch (the Tooltip provider
 * context is not present in jsdom by default).
 */
function mountToolbar(propsOverride: Record<string, unknown> = {}) {
  return mount(DataTableToolbar, {
    props: {
      globalFilter: '',
      ...propsOverride,
    },
    global: {
      stubs: {
        // Nuxt UI auto-imports UTooltip as `UTooltip`, but the underlying
        // file exports under `Tooltip`. Stub both names so the test works
        // regardless of how the SFC was resolved.
        UTooltip: { template: '<div><slot /></div>' },
        Tooltip: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('DataTableToolbar — testid pass-through (REQ-QAF-016)', () => {
  it('does not render a data-testid on the refresh button by default', () => {
    const wrapper = mountToolbar({ showRefresh: true })

    // The refresh button is the button whose leading icon is `i-lucide-refresh-cw`
    // (rendered as an inline SVG via Nuxt UI). Find by the icon and walk up.
    const refreshIcon = wrapper.get('svg[data-slot="leadingIcon"]')
    const refreshButton = refreshIcon.element.parentElement as HTMLElement
    expect(refreshButton).toBeTruthy()
    // Default undefined → no data-testid attribute rendered on the button.
    expect(refreshButton.hasAttribute('data-testid')).toBe(false)
  })

  it('renders refreshButtonTestId on the refresh button when provided', () => {
    const wrapper = mountToolbar({
      showRefresh: true,
      refreshButtonTestId: 'refresh-quotations-button',
    })

    const refreshButton = wrapper.get('[data-testid="refresh-quotations-button"]')
    // Sanity: the icon-leading button is the one that got the testid.
    expect(refreshButton.find('svg[data-slot="leadingIcon"]').exists()).toBe(true)
  })

  it('does not render a data-testid on the add button by default', () => {
    const wrapper = mountToolbar({ showAddButton: true, addButtonText: 'Nueva cotización' })

    // Find the button by its rendered label text.
    const addButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Nueva cotización'))
    expect(addButton).toBeTruthy()
    expect(addButton!.attributes('data-testid')).toBeUndefined()
  })

  it('renders addButtonTestId on the add button when provided', () => {
    const wrapper = mountToolbar({
      showAddButton: true,
      addButtonText: 'Nueva cotización',
      addButtonTestId: 'new-quotation-button',
    })

    const add = wrapper.get('[data-testid="new-quotation-button"]')
    expect(add.text()).toContain('Nueva cotización')
  })
})
