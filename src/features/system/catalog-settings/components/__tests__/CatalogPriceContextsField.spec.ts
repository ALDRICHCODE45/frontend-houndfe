// CatalogPriceContextsField.spec.ts — «Precios que ve el público» rows (artboard 01,
// REQ-6A): one row per list by name, a «Pública» switch, a «Predeterminada»
// radio pill on public rows with roving tabindex, granular emits, the locked
// state without global-list read and the read-only list.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogPriceContextsField from '../CatalogPriceContextsField.vue'
import type { CatalogSettingsDraft } from '../../interfaces/catalog-settings.types'

const candidates = [
  { id: 'pl_a', name: 'Lista A' },
  { id: 'pl_b', name: 'Lista B' },
  { id: 'pl_c', name: 'Lista C' },
]

function makeDraft(overrides: Partial<CatalogSettingsDraft> = {}): CatalogSettingsDraft {
  return {
    catalogPublished: true,
    publicPriceListIds: ['pl_a', 'pl_b'],
    catalogDefaultPriceListId: 'pl_a',
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    ...overrides,
  }
}

function mountField(props: Record<string, unknown> = {}) {
  return mountWithUApp(CatalogPriceContextsField, {
    attachTo: document.body,
    props: { draft: makeDraft(), acceptedContexts: [], candidates, ...props },
  })
}

type Wrapper = ReturnType<typeof mountField>

const radios = (wrapper: Wrapper) => wrapper.findAll('[data-testid="default-radio"]')
const switches = (wrapper: Wrapper) => wrapper.findAll('[data-testid="public-switch"]')
const lastEmit = (wrapper: Wrapper, event: string) => {
  const calls = wrapper.emitted(event)
  return calls?.[calls.length - 1]
}

describe('CatalogPriceContextsField — rows', () => {
  it('renders one row per candidate with a «Pública» switch and the count', () => {
    const wrapper = mountField()
    expect(wrapper.findAll('[data-testid="context-row"]')).toHaveLength(3)
    expect(switches(wrapper).map((s) => s.attributes('aria-checked'))).toEqual(['true', 'true', 'false'])
    expect(wrapper.get('[data-testid="public-count"]').text()).toBe('2 de 3 públicas')
  })

  it('keeps a stale public id as a row named from accepted contexts, never by id', () => {
    const wrapper = mountField({
      draft: makeDraft({ publicPriceListIds: ['pl_a', 'pl_ghost'] }),
      acceptedContexts: [{ priceListId: 'pl_ghost', name: 'Lista Fantasma', isCatalogDefault: false }],
    })
    expect(wrapper.text()).toContain('Lista Fantasma')
    expect(wrapper.text()).not.toContain('pl_ghost')
  })

  it('emits add / remove from the switches and setDefault from the pill', async () => {
    const wrapper = mountField()
    await switches(wrapper)[2]!.trigger('click')
    expect(lastEmit(wrapper, 'add')).toEqual(['pl_c'])
    await switches(wrapper)[1]!.trigger('click')
    expect(lastEmit(wrapper, 'remove')).toEqual(['pl_b'])
    await radios(wrapper)[1]!.trigger('click')
    expect(lastEmit(wrapper, 'setDefault')).toEqual(['pl_b'])
  })
})

describe('CatalogPriceContextsField — radio keyboard (roving tabindex)', () => {
  function tabIndexes(wrapper: Wrapper) {
    return radios(wrapper).map((radio) => radio.attributes('tabindex'))
  }

  it('makes only the chosen pill tabbable, or the first public one when none is chosen', () => {
    expect(tabIndexes(mountField())).toEqual(['0', '-1'])
    expect(tabIndexes(mountField({ draft: makeDraft({ catalogDefaultPriceListId: null }) }))).toEqual(['0', '-1'])
  })

  it.each([
    ['ArrowDown', 'pl_b'],
    ['ArrowRight', 'pl_b'],
    ['ArrowUp', 'pl_c'],
    ['End', 'pl_c'],
  ])('%s chooses and focuses the next pill', async (key, expected) => {
    const wrapper = mountField({ draft: makeDraft({ publicPriceListIds: ['pl_a', 'pl_b', 'pl_c'] }) })
    await radios(wrapper)[0]!.trigger('keydown', { key })
    expect(lastEmit(wrapper, 'setDefault')).toEqual([expected])
    expect(document.activeElement).toBe(radios(wrapper)[expected === 'pl_b' ? 1 : 2]!.element)
  })

  it('Home from the last pill chooses the first', async () => {
    const wrapper = mountField({
      draft: makeDraft({ publicPriceListIds: ['pl_a', 'pl_b', 'pl_c'], catalogDefaultPriceListId: 'pl_c' }),
    })
    await radios(wrapper)[2]!.trigger('keydown', { key: 'Home' })
    expect(lastEmit(wrapper, 'setDefault')).toEqual(['pl_a'])
    expect(document.activeElement).toBe(radios(wrapper)[0]!.element)
  })
})

describe('CatalogPriceContextsField — notices, locked and read-only', () => {
  it('shows the moved-default notice and emits undoDefaultMove from «Deshacer»', async () => {
    const wrapper = mountField({ defaultMove: { fromName: 'Lista A', toName: 'Lista B' } })
    expect(wrapper.get('[data-testid="default-move-notice"]').text()).toContain(
      'Lista B ahora es la predeterminada porque Lista A dejó de ser pública.',
    )
    await wrapper.get('[data-testid="undo-default-move"]').trigger('click')
    expect(wrapper.emitted('undoDefaultMove')).toHaveLength(1)
  })

  it('warns when no list is public', () => {
    const wrapper = mountField({ draft: makeDraft({ publicPriceListIds: [], catalogDefaultPriceListId: null }) })
    expect(wrapper.get('[data-testid="no-public-warning"]').text()).toContain('Elige al menos una lista pública')
  })

  it('locks every control with an explanation when editing is disabled', async () => {
    const wrapper = mountField({ disabled: true })
    expect(wrapper.find('[data-testid="contexts-disabled-note"]').exists()).toBe(true)
    for (const control of [...switches(wrapper), ...radios(wrapper)]) {
      expect(control.attributes('aria-disabled')).toBe('true')
    }
    await switches(wrapper)[0]!.trigger('click')
    await radios(wrapper)[1]!.trigger('click')
    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.emitted('setDefault')).toBeUndefined()
  })

  it('read-only lists the accepted public lists with the default badge and no controls', () => {
    const wrapper = mountField({
      readonly: true,
      acceptedContexts: [
        { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: false },
        { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: true },
      ],
    })
    const rows = wrapper.findAll('[data-testid="context-row"]')
    expect(rows.map((row) => row.get('.cs-price-title > span').text())).toEqual(['Lista A', 'Lista B'])
    expect(rows[1]!.find('.hf-status-badge').text()).toBe('Predeterminada')
    expect(rows[0]!.find('.hf-status-badge').exists()).toBe(false)
    expect(wrapper.findAll('[role="switch"], [role="radio"]')).toHaveLength(0)
  })

  it('read-only with no lists says so', () => {
    const wrapper = mountField({ readonly: true, acceptedContexts: [] })
    expect(wrapper.get('[data-testid="contexts-empty"]').text()).toContain('Sin listas públicas')
  })
})
