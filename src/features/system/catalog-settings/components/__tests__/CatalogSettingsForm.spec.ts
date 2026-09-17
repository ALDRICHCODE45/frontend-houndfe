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
    expect(wrapper.find('[data-testid="catalog-settings-form"]').classes()).toContain('sm:gap-8')
    expect(wrapper.find('[data-testid="contexts-card"]').classes()).toContain('border-t')
    expect(wrapper.find('[data-testid="stock-card"]').classes()).toContain('sm:pt-8')
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
