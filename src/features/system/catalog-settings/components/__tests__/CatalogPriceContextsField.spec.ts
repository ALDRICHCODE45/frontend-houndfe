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

describe('CatalogPriceContextsField — ul > li semantics (REQ-6A)', () => {
  it('wraps rows in a <ul> with a data-testid', () => {
    const wrapper = mountField()
    expect(wrapper.find('ul[data-testid="contexts-list"]').exists()).toBe(true)
  })

  it('uses <li> as direct children of the list — validates with DOM .children', () => {
    const wrapper = mountField()
    const list = wrapper.find('ul[data-testid="contexts-list"]').element
    // Exact child count
    expect(list.children).toHaveLength(2)
    // Every direct child is an <li>
    for (const child of list.children) {
      expect(child.tagName).toBe('LI')
    }
  })

  it('each <li> row carries the context-row testid', () => {
    const wrapper = mountField()
    const rows = wrapper.findAll('li[data-testid="context-row"]')
    expect(rows).toHaveLength(2)
  })
})

describe('CatalogPriceContextsField — responsive stack/wrap intent (REQ-6A)', () => {
  it('row class contains sm:flex-row for horizontal layout at breakpoint', () => {
    const wrapper = mountField()
    const row = wrapper.find('li[data-testid="context-row"]')
    expect(row.classes()).toContain('sm:flex-row')
  })

  it('name wrapper has min-w-0 and break-words for safe wrapping', () => {
    const wrapper = mountField()
    const nameSpan = wrapper.find('li[data-testid="context-row"] span')
    expect(nameSpan.classes()).toContain('min-w-0')
    expect(nameSpan.classes()).toContain('break-words')
  })

  it('action group has flex-wrap to prevent overflow on narrow rows', () => {
    const wrapper = mountField()
    const actions = wrapper.find('li[data-testid="context-row"] > div')
    expect(actions.classes()).toContain('flex-wrap')
  })
})

describe('CatalogPriceContextsField — accepted membership rendering (REQ-6A)', () => {
  it('renders accepted contexts in server order with the default badge', () => {
    const wrapper = mountField()
    const rows = wrapper.findAll('[data-testid="context-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Lista A')
    expect(rows[0]?.text()).toContain('Predeterminada')
  })

  it('emits remove for every row including the default context directly', async () => {
    const wrapper = mountField()
    // Every row has a remove button: remove-context for non-default, remove-default-context for default.
    const defaultRemovable = wrapper.find('[data-testid="remove-default-context"]')
    expect(defaultRemovable.exists()).toBe(true)
    await defaultRemovable.trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['pl_a'])
    // Non-default row also has direct remove.
    const nonDefaultRemovable = wrapper.find('[data-testid="remove-context"]')
    expect(nonDefaultRemovable.exists()).toBe(true)
    await nonDefaultRemovable.trigger('click')
    expect(wrapper.emitted('remove')?.[1]).toEqual(['pl_b'])
  })

  it('gives icon-only remove buttons accessible names with context identity', () => {
    const wrapper = mountField()
    const defaultRemove = wrapper.find('[data-testid="remove-default-context"]')
    expect(defaultRemove.attributes('aria-label')).toBe('Eliminar Lista A del catálogo')
    const nonDefaultRemove = wrapper.find('[data-testid="remove-context"]')
    expect(nonDefaultRemove.attributes('aria-label')).toBe('Eliminar Lista B del catálogo')
  })

  it('set-default is only available for non-default rows', () => {
    const wrapper = mountField()
    const defaultables = wrapper.findAll('[data-testid="set-default"]')
    // Only pl_b (non-default) has set-default; pl_a (default) has no set-default button.
    expect(defaultables).toHaveLength(1)
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
    expect(
      wrapper.find('[data-testid="remove-default-context"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.find('[data-testid="add-candidate-option"]').exists()).toBe(false)
  })

  it('preserves a draft id missing from accepted contexts and candidates by id', () => {
    const wrapper = mountField(makeDraft({ publicPriceListIds: ['pl_a', 'pl_ghost'] }))
    const rows = wrapper.findAll('[data-testid="context-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]?.text()).toContain('pl_ghost')
  })
})
