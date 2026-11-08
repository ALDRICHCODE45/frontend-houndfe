// CatalogStockPresentationField.spec.ts — «Stock en el catálogo» radio cards
// (artboard 01, board 04 pattern 2, REQ-8). The closed four-mode set with the
// shared copy from stockPresentationUi; non-custom modes emit a null quantity;
// CUSTOM_QUANTITY keeps literal 0, and an invalid entry emits NaN with the
// error under the field.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogStockPresentationField from '../CatalogStockPresentationField.vue'
import type { CatalogStockPresentationDefaultDto } from '../../interfaces/catalog-settings.types'
import { getStockPresentationCopy } from '../../utils/stockPresentationUi'

function mountField(
  stockDefault: CatalogStockPresentationDefaultDto = { mode: 'SYSTEM_STATUS', customQuantity: null },
  props: Record<string, unknown> = {},
) {
  return mountWithUApp(CatalogStockPresentationField, {
    attachTo: document.body,
    props: { stockDefault, ...props },
  })
}

type Wrapper = ReturnType<typeof mountField>

const cards = (wrapper: Wrapper) => wrapper.findAll('[data-testid="stock-mode-radio"]')
const card = (wrapper: Wrapper, mode: string) =>
  cards(wrapper).find((candidate) => candidate.attributes('data-mode') === mode)!
const lastChange = (wrapper: Wrapper) => {
  const calls = wrapper.emitted('change')
  return calls?.[calls.length - 1]?.[0] as CatalogStockPresentationDefaultDto | undefined
}

describe('CatalogStockPresentationField — radio cards', () => {
  it('renders the four modes as radios with the exact shared copy, in order', () => {
    const wrapper = mountField()
    expect(wrapper.get('[data-testid="stock-mode-group"]').attributes('role')).toBe('radiogroup')
    expect(cards(wrapper).map((c) => c.attributes('data-mode'))).toEqual([
      'SYSTEM_STATUS',
      'ABSTRACT_STATUS',
      'CUSTOM_QUANTITY',
      'HIDDEN',
    ])
    for (const mode of ['SYSTEM_STATUS', 'ABSTRACT_STATUS', 'CUSTOM_QUANTITY', 'HIDDEN'] as const) {
      const copy = getStockPresentationCopy(mode)
      expect(card(wrapper, mode).text()).toContain(copy.label)
      expect(card(wrapper, mode).text()).toContain(copy.description)
    }
    expect(card(wrapper, 'SYSTEM_STATUS').text()).toContain('Vista previa: Disponible, Pocas piezas, Agotado')
  })

  it('marks the selected card with aria-checked, the check mark and «Seleccionado», not color alone', () => {
    const wrapper = mountField()
    const selected = card(wrapper, 'SYSTEM_STATUS')
    expect(selected.attributes('aria-checked')).toBe('true')
    expect(selected.attributes('tabindex')).toBe('0')
    expect(selected.get('.cs-mark').attributes('data-checked')).toBe('true')
    expect(selected.get('.cs-stock-tag').classes()).not.toContain('invisible')
    expect(card(wrapper, 'HIDDEN').attributes('tabindex')).toBe('-1')
    expect(card(wrapper, 'HIDDEN').get('.cs-stock-tag').classes()).toContain('invisible')
  })

  it('clicking a non-custom card emits that mode with a null quantity', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 7 })
    await card(wrapper, 'HIDDEN').trigger('click')
    expect(lastChange(wrapper)).toEqual({ mode: 'HIDDEN', customQuantity: null })
  })

  it('arrow keys choose and focus the next card (roving tabindex)', async () => {
    const wrapper = mountField()
    await card(wrapper, 'SYSTEM_STATUS').trigger('keydown', { key: 'ArrowDown' })
    expect(lastChange(wrapper)).toEqual({ mode: 'ABSTRACT_STATUS', customQuantity: null })
    expect(document.activeElement).toBe(card(wrapper, 'ABSTRACT_STATUS').element)
    await card(wrapper, 'SYSTEM_STATUS').trigger('keydown', { key: 'End' })
    expect(lastChange(wrapper)).toEqual({ mode: 'HIDDEN', customQuantity: null })
  })
})

describe('CatalogStockPresentationField — fixed quantity', () => {
  it('choosing «Mostrar cantidad fija» emits quantity 0 and the field appears only for it', async () => {
    const wrapper = mountField()
    expect(wrapper.find('[data-testid="stock-quantity"]').exists()).toBe(false)
    await card(wrapper, 'CUSTOM_QUANTITY').trigger('click')
    expect(lastChange(wrapper)).toEqual({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })

    const custom = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })
    expect(custom.get('[data-testid="stock-quantity"]').text()).toContain('Cantidad a mostrar')
    expect(card(custom, 'CUSTOM_QUANTITY').text()).toContain('0 unidades')
  })

  it('emits integers, keeps literal 0, and NaN for an invalid entry', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 5 })
    const input = wrapper.get('input[data-testid="stock-quantity-input"]')
    await input.setValue('0')
    expect(lastChange(wrapper)).toEqual({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })
    await input.setValue('1.5')
    expect(lastChange(wrapper)?.customQuantity).toBeNaN()
    await input.setValue('')
    expect(lastChange(wrapper)?.customQuantity).toBeNaN()
  })

  it('shows the error under the field and marks the input invalid when the quantity is invalid', () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: Number.NaN })
    expect(wrapper.get('[data-testid="stock-quantity"]').text()).toContain(
      'Escribe un número entero de 0 o más.',
    )
    expect(wrapper.get('input[data-testid="stock-quantity-input"]').attributes('aria-invalid')).toBe('true')
    expect(card(wrapper, 'CUSTOM_QUANTITY').text()).toContain('— unidades')
  })
})

describe('CatalogStockPresentationField — read-only', () => {
  it('shows only the accepted mode, without radios, and «Mostrar 0» for a fixed 0', () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }, { readonly: true })
    expect(wrapper.findAll('[role="radio"], input')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="stock-default"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="stock-quantity-label"]').text()).toBe('Mostrar 0')
  })
})
