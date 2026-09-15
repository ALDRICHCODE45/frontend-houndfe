// CatalogPriceContextsField.spec.ts — STRICT-TDD tests for the WU3B contexts
// field (REQ-6A). Accepted membership/default always comes from settings
// priceContexts; candidates only offer additions; missing global-list read
// disables editing with a Spanish explanation while keeping rows visible.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogPriceContextsField from '../CatalogPriceContextsField.vue'
import type { CatalogSettingsDraft } from '../../interfaces/catalog-settings.types'

function makeDraft(overrides: Partial<CatalogSettingsDraft> = {}): CatalogSettingsDraft {
  return {
    catalogPublished: true,
    publicPriceListIds: ['pl_a', 'pl_b'],
    catalogDefaultPriceListId: 'pl_a',
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    ...overrides,
  }
}

const acceptedContexts = [
  { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
  { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: false },
]

const candidates = [
  { id: 'pl_a', name: 'Lista A', isDefault: true, createdAt: '', updatedAt: '' },
  { id: 'pl_c', name: 'Lista C', isDefault: false, createdAt: '', updatedAt: '' },
]

function mountField(draft = makeDraft(), disabled = false) {
  return mountWithUApp(CatalogPriceContextsField, {
    props: { draft, acceptedContexts, candidates, disabled },
  })
}

describe('CatalogPriceContextsField — accepted membership rendering (REQ-6A)', () => {
  it('renders accepted contexts in server order with the default badge', () => {
    const wrapper = mountField()
    const rows = wrapper.findAll('[data-testid="context-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Lista A')
    expect(rows[0]?.text()).toContain('Predeterminada')
  })

  it('emits remove for a row button and setDefault for the default action', async () => {
    const wrapper = mountField()
    const removables = wrapper.findAll('[data-testid="remove-context"]')
    await removables[1]?.trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['pl_b'])
    // Only the NON-default row renders a set-default action.
    const defaultables = wrapper.findAll('[data-testid="set-default"]')
    expect(defaultables).toHaveLength(1)
    await defaultables[0]?.trigger('click')
    expect(wrapper.emitted('setDefault')?.[0]).toEqual(['pl_b'])
  })

  it('offers only non-member candidates as additions', () => {
    const wrapper = mountField()
    const options = wrapper.findAll('[data-testid="add-candidate-option"]')
    expect(options.map((o) => o.text())).toEqual(['Lista C'])
  })

  it('emits add for a candidate option', async () => {
    const wrapper = mountField()
    await wrapper.find('[data-testid="add-candidate-option"]').trigger('click')
    expect(wrapper.emitted('add')?.[0]).toEqual(['pl_c'])
  })
})

describe('CatalogPriceContextsField — missing global-list read (REQ-6A)', () => {
  it('disables editing with the Spanish explanation but keeps accepted rows visible', () => {
    const wrapper = mountField(makeDraft(), true)
    expect(wrapper.text()).toContain(
      'Se requiere permiso de lectura de listas de precios globales para editar los contextos',
    )
    expect(wrapper.findAll('[data-testid="context-row"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="remove-context"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="add-candidate-option"]').exists()).toBe(false)
  })

  it('preserves a draft id missing from accepted contexts and candidates by id', () => {
    const wrapper = mountField(makeDraft({ publicPriceListIds: ['pl_a', 'pl_ghost'] }))
    const rows = wrapper.findAll('[data-testid="context-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]?.text()).toContain('pl_ghost')
  })
})
