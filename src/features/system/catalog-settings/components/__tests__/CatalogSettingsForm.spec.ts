// CatalogSettingsForm.spec.ts — STRICT-TDD tests for the WU3B editable
// settings form (REQ-7 / REQ-8 / REQ-10 / REQ-12 composition pins).
//
// The form composes the publication switch, the contexts field, the stock
// field, the validation summary, and the Save footer; it delegates editing to
// the passed draft and surfaces save gating from the parent view.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogSettingsForm from '../CatalogSettingsForm.vue'
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

const acceptedContexts = [
  { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
]

function mountForm(
  draft = makeDraft(),
  props: Record<string, unknown> = {},
) {
  return mountWithUApp(CatalogSettingsForm, {
    props: {
      draft,
      acceptedContexts,
      candidates: [],
      validationErrors: [],
      canSave: true,
      saving: false,
      canEditContexts: true,
      ...props,
    },
  })
}

describe('CatalogSettingsForm — composition (REQ-12)', () => {
  it('renders the publication switch, contexts field, stock field, and Save', () => {
    const wrapper = mountForm()
    expect(wrapper.find('[data-testid="publish-switch"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="contexts-field"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stock-mode-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(true)
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

  it('Save is disabled unless canSave holds and emits save on click', async () => {
    const wrapper = mountForm(makeDraft(), { canSave: false })
    expect(wrapper.find('[data-testid="save-button"]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('save')).toBeUndefined()

    const enabled = mountForm(makeDraft(), { canSave: true })
    await enabled.find('[data-testid="save-button"]').trigger('click')
    expect(enabled.emitted('save')).toHaveLength(1)
  })

  it('disables the Save control while a mutation is pending', () => {
    const wrapper = mountForm(makeDraft(), { canSave: true, saving: true })
    expect(wrapper.find('[data-testid="save-button"]').attributes('disabled')).toBeDefined()
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
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(true)
  })
})
