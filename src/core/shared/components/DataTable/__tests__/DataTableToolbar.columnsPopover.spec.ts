import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import DataTableToolbar from '../DataTableToolbar.vue'

// The real Nuxt UI popover (no stubs): «Columnas» opens the panel on a content root themed with
// `hf-theme hf-ui` plus the consumer's portal class.
enableAutoUnmount(afterEach)

const columns = {
  left: [],
  center: [
    { id: 'customer', label: 'Cliente', visible: true, primary: true },
    { id: 'total', label: 'Total', visible: false, primary: false },
  ],
  right: [],
}

describe('«Columnas» popover', () => {
  it('opens the panel on a themed content root that keeps the portal class', async () => {
    mountWithUApp(DataTableToolbar, {
      attachTo: document.body,
      props: { globalFilter: '', portalClass: 'sales-list-portal', showColumnVisibility: true, columns },
    })
    const button = document.body.querySelector<HTMLButtonElement>('[data-testid="toolbar-columns-button"]')!
    expect(button.getAttribute('aria-label')).toBe('Columnas · 1 oculta')
    await new DOMWrapper(button).trigger('click')
    await flushPromises()
    const panel = document.body.querySelector('[data-testid="columns-panel"]')
    expect(panel).not.toBeNull()
    const root = panel!.closest('[data-slot="content"]')!
    expect(root.classList).toContain('hf-theme')
    expect(root.classList).toContain('hf-ui')
    expect(root.classList).toContain('sales-list-portal')
  })
})
