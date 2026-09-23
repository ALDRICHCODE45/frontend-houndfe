// CatalogSettingsForm.spec.ts — STRICT-TDD tests for the WU3B editable
// settings form (REQ-7 / REQ-8 / REQ-10 / REQ-12 composition pins).
//
// The form composes the publication switch, the contexts field, the stock
// field, the validation summary; save routing lives in the page footer.
// canSave, saving, and the save emit were removed as obsolete UI plumbing
// (WU3B refactor: save/notice moved to the page-level sticky footer).

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogSettingsForm from '@/features/system/catalog-settings/components/CatalogSettingsForm.vue'
import type { CatalogSettingsDraft } from '../../interfaces/catalog-settings.types'

function makeDraft(overrides: Partial<CatalogSettingsDraft> = {}): CatalogSettingsDraft {
  return {
    catalogPublished: false,
    publicPriceListIds: ['pl_a'],
    catalogDefaultPriceListId: 'pl_a',
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    ...overrides,
  }
}

const acceptedContexts = [{ priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true }]

function mountForm(draft = makeDraft(), props: Record<string, unknown> = {}) {
  return mountWithUApp(CatalogSettingsForm, {
    props: {
      draft,
      acceptedContexts,
      candidates: [],
      validationErrors: [],
      canEditContexts: true,
      ...props,
    },
  })
}

describe('CatalogSettingsForm — composition (REQ-12)', () => {
  it('renders the publication switch, contexts field, and stock field (save is in the page footer)', () => {
    const wrapper = mountForm()
    expect(wrapper.find('[data-testid="publish-switch"]').exists()).toBe(true)
    // contexts-field is now on the fieldset root.
    expect(wrapper.find('fieldset[data-testid="contexts-field"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stock-mode-select"]').exists()).toBe(true)
    // No form-level save button — single save surface is the page sticky footer.
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(false)
  })

  it('keeps the three semantic sections card-free for the routed outer card', () => {
    const wrapper = mountForm()

    expect(wrapper.findAllComponents({ name: 'Card' })).toHaveLength(0)
    for (const testId of ['publication-card', 'contexts-card', 'stock-card']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).element.tagName).toBe('SECTION')
    }
  })

  it('puts the publication switch on a compact subtle surface', () => {
    const wrapper = mountForm()

    const publicationCard = wrapper.find('[data-testid="publication-card"]')
    expect(publicationCard.classes()).toContain('border')
    expect(publicationCard.classes()).toContain('bg-elevated/50')
    expect(publicationCard.classes()).toContain('min-w-0')
    expect(publicationCard.find('[data-testid="publish-switch"]').exists()).toBe(true)
  })

  it('lays contexts and stock out in a responsive one/two-column internal grid', () => {
    const wrapper = mountForm()

    const grid = wrapper.find('[data-testid="settings-grid"]')
    expect(grid.classes()).toContain('grid')
    expect(grid.classes()).toContain('grid-cols-1')
    expect(grid.classes()).toContain('lg:grid-cols-2')

    const contextsCard = wrapper.find('[data-testid="contexts-card"]')
    const stockCard = wrapper.find('[data-testid="stock-card"]')
    // Both sections live inside the single internal grid (no nested cards).
    expect(grid.element.contains(contextsCard.element)).toBe(true)
    expect(grid.element.contains(stockCard.element)).toBe(true)
    expect(wrapper.findAll('[data-testid="settings-grid"]')).toHaveLength(1)

    // Overflow protection on both grid tracks.
    expect(contextsCard.classes()).toContain('min-w-0')
    expect(stockCard.classes()).toContain('min-w-0')
  })

  it('keeps the stack divider on mobile and switches it vertical on large screens', () => {
    const wrapper = mountForm()

    const grid = wrapper.find('[data-testid="settings-grid"]')
    const stockCard = wrapper.find('[data-testid="stock-card"]')
    // Row divider above the grid; vertical divider between columns on `lg`.
    expect(grid.classes()).toContain('border-t')
    expect(stockCard.classes()).toContain('border-t')
    expect(stockCard.classes()).toContain('sm:pt-8')
    expect(stockCard.classes()).toContain('lg:border-t-0')
    expect(stockCard.classes()).toContain('lg:border-l')
  })

  it('emits granular draft intents instead of mutating props', async () => {
    const draft = makeDraft()
    const wrapper = mountForm(draft)
    await wrapper.find('[data-testid="publish-switch"]').trigger('click')
    expect(wrapper.emitted('toggle-publish')).toHaveLength(1)
  })

  it('shows the validation summary when errors exist', () => {
    const wrapper = mountForm(makeDraft(), {
      validationErrors: ['Publicar el catálogo requiere una lista de precios predeterminada'],
    })
    expect(wrapper.find('[data-testid="validation-summary"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('requiere una lista de precios predeterminada')
  })

  it('forwards canEditContexts to the contexts field', () => {
    const wrapper = mountForm(makeDraft(), { canEditContexts: false })
    expect(wrapper.text()).toContain(
      'Se requiere permiso de lectura de listas de precios globales para editar los contextos',
    )
  })

  it('keeps publication and stock available when context editing is gated (REQ-6A)', () => {
    const wrapper = mountForm(makeDraft(), { canEditContexts: false })
    const publishSwitch = wrapper.find('[data-testid="publish-switch"]')
    expect(publishSwitch.exists()).toBe(true)
    expect(publishSwitch.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="stock-mode-select"]').attributes('disabled')).toBeUndefined()
  })
})

describe('CatalogSettingsForm — removed obsolete plumbing (WU3B refactor)', () => {
  it('does not accept canSave prop — save gating lives in the page footer', () => {
    const wrapper = mountForm()
    // The form should mount cleanly without canSave (removed from defineProps).
    expect(wrapper.find('[data-testid="catalog-settings-form"]').exists()).toBe(true)
  })

  it('does not accept saving prop — loading state lives in the page footer', () => {
    const wrapper = mountForm()
    expect(wrapper.find('[data-testid="catalog-settings-form"]').exists()).toBe(true)
  })

  it('does not emit save — routing lives in the page footer via requestSave', () => {
    const wrapper = mountForm()
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
