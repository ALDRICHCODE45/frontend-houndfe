// CatalogSettingsForm.spec.ts — the editable rows composition (artboard 01):
// three sections, granular intents instead of prop mutation, the status-line
// variants, and the validation summary without the messages said in context.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogSettingsForm from '@/features/system/catalog-settings/components/CatalogSettingsForm.vue'
import type { CatalogSettingsDraft } from '../../interfaces/catalog-settings.types'
import { NO_PUBLIC_LIST_ERROR, STOCK_QUANTITY_ERROR } from '../../utils/catalogSettingsMappers'

function makeDraft(overrides: Partial<CatalogSettingsDraft> = {}): CatalogSettingsDraft {
  return {
    catalogPublished: true,
    publicPriceListIds: ['pl_a'],
    catalogDefaultPriceListId: 'pl_a',
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    ...overrides,
  }
}

const candidates = [
  { id: 'pl_a', name: 'Lista A' },
  { id: 'pl_b', name: 'Lista B' },
]

function mountForm(draft = makeDraft(), props: Record<string, unknown> = {}) {
  return mountWithUApp(CatalogSettingsForm, {
    props: {
      draft,
      acceptedContexts: [],
      candidates,
      validationErrors: [],
      canEditContexts: true,
      ...props,
    },
  })
}

const status = (wrapper: ReturnType<typeof mountForm>) =>
  wrapper.get('[data-testid="publication-status"]')

describe('CatalogSettingsForm — composition', () => {
  it('renders the three sections and no save button (the page owns the save bar)', () => {
    const wrapper = mountForm()
    for (const testId of ['publication-card', 'contexts-card', 'stock-card']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).element.tagName).toBe('SECTION')
    }
    expect(wrapper.find('[data-testid="footer-save-button"]').exists()).toBe(false)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('emits granular intents and never mutates the draft prop', async () => {
    const draft = makeDraft()
    const wrapper = mountForm(draft)
    await wrapper.get('[data-testid="publish-switch"]').trigger('click')
    await wrapper.findAll('[data-testid="public-switch"]')[1]!.trigger('click')
    await wrapper.findAll('[data-testid="stock-mode-radio"]')[3]!.trigger('click')
    expect(wrapper.emitted('toggle-publish')).toHaveLength(1)
    expect(wrapper.emitted('add-context')).toEqual([['pl_b']])
    expect(wrapper.emitted('stock-change')).toEqual([[{ mode: 'HIDDEN', customQuantity: null }]])
    expect(draft).toEqual(makeDraft())
  })

  it('keeps publication and stock editable while list editing is locked (REQ-6A)', () => {
    const wrapper = mountForm(makeDraft(), { canEditContexts: false })
    expect(wrapper.get('[data-testid="public-switch"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="publish-switch"]').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.findAll('[data-testid="stock-mode-radio"]')[0]!.attributes('aria-disabled')).toBeUndefined()
  })
})

describe('CatalogSettingsForm — effective-status line variants', () => {
  it('success: visible with the count and the default list', () => {
    const wrapper = mountForm()
    expect(status(wrapper).attributes('data-tone')).toBe('success')
    expect(status(wrapper).text()).toContain(
      'Visible para el público · 1 lista de precios; se muestra primero Lista A.',
    )
  })

  it('warning: the server warning leads «No visible:» when the accepted state is not effective', () => {
    const wrapper = mountForm(makeDraft(), {
      effectivePublication: false,
      warnings: ['El contexto de catálogo por defecto no tiene precios válidos'],
    })
    expect(status(wrapper).attributes('data-tone')).toBe('warning')
    expect(status(wrapper).text()).toContain(
      'No visible: El contexto de catálogo por defecto no tiene precios válidos.',
    )
  })

  it('warning: not effective without warnings explains the tenant dependency', () => {
    const wrapper = mountForm(makeDraft(), { effectivePublication: false })
    expect(status(wrapper).text()).toContain(
      'No visible: la publicación efectiva también depende del estado del tenant.',
    )
  })

  it('warning: published with no public list', () => {
    const wrapper = mountForm(
      makeDraft({ publicPriceListIds: [], catalogDefaultPriceListId: null }),
      { dirty: true },
    )
    expect(status(wrapper).attributes('data-tone')).toBe('warning')
    expect(status(wrapper).text()).toContain('Al guardar: No visible: no hay listas de precios públicas.')
  })

  it('muted: publication off', () => {
    const wrapper = mountForm(makeDraft({ catalogPublished: false }))
    expect(status(wrapper).attributes('data-tone')).toBe('muted')
    expect(status(wrapper).text()).toContain('No visible: la publicación está desactivada.')
    expect(status(wrapper).text()).not.toContain('Al guardar:')
  })

  it('ignores accepted server warnings while the draft is dirty', () => {
    const wrapper = mountForm(makeDraft(), {
      dirty: true,
      effectivePublication: false,
      warnings: ['El contexto de catálogo por defecto no tiene precios válidos'],
    })
    expect(status(wrapper).attributes('data-tone')).toBe('success')
    expect(status(wrapper).text()).toContain('Al guardar: Visible para el público')
  })
})

describe('CatalogSettingsForm — validation summary', () => {
  it('lists remaining errors but leaves out the ones said in context', () => {
    const wrapper = mountForm(makeDraft(), {
      validationErrors: [
        NO_PUBLIC_LIST_ERROR,
        STOCK_QUANTITY_ERROR,
        'Publicar el catálogo requiere una lista de precios predeterminada',
      ],
    })
    const summary = wrapper.get('[data-testid="validation-summary"]')
    expect(summary.findAll('li').map((li) => li.text())).toEqual([
      'Publicar el catálogo requiere una lista de precios predeterminada',
    ])
  })

  it('draws no summary when every error is said in context', () => {
    const wrapper = mountForm(makeDraft(), { validationErrors: [STOCK_QUANTITY_ERROR] })
    expect(wrapper.find('[data-testid="validation-summary"]').exists()).toBe(false)
  })
})
