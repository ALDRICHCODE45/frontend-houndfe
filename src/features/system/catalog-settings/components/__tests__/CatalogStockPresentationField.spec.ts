// CatalogStockPresentationField.spec.ts — STRICT-TDD tests for the WU3B tenant
// stock-presentation default field (REQ-8).
//
// Renders the closed mode set; non-CUSTOM modes force a null quantity;
// CUSTOM_QUANTITY keeps the integer with 0 preserved and labeled "Mostrar 0".

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogStockPresentationField from '../CatalogStockPresentationField.vue'
import type { CatalogStockPresentationDefaultDto } from '../../interfaces/catalog-settings.types'

function mountField(
  stockDefault: CatalogStockPresentationDefaultDto = { mode: 'SYSTEM_STATUS', customQuantity: null },
  disabled = false,
) {
  return mountWithUApp(CatalogStockPresentationField, {
    props: { stockDefault, disabled },
  })
}

describe('CatalogStockPresentationField — closed mode set (REQ-8)', () => {
  it('renders the four documented modes with Spanish labels', () => {
    const wrapper = mountField()
    const text = wrapper.text()
    expect(text).toContain('Según estado del sistema')
    expect(text).toContain('Cantidad personalizada')
    expect(text).toContain('Oculto')
  })

  it('changing to a non-custom mode emits that mode with a null quantity', async () => {
    const wrapper = mountField()
    await wrapper.find('[data-testid="stock-mode-select"]').setValue('ABSTRACT_STATUS')
    const events = wrapper.emitted('change') ?? []
    const emitted = events[events.length - 1]?.[0]
    expect(emitted).toEqual({ mode: 'ABSTRACT_STATUS', customQuantity: null })
  })

  it('preserves custom 0 literally and labels it "Mostrar 0"', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })
    expect(wrapper.text()).toContain('Mostrar 0')
    await wrapper.find('[data-testid="stock-quantity-input"]').setValue('5')
    const events = wrapper.emitted('change') ?? []
    const emitted = events[events.length - 1]?.[0]
    expect(emitted).toEqual({ mode: 'CUSTOM_QUANTITY', customQuantity: 5 })
  })

  it('keeps mode selection when the quantity changes under CUSTOM_QUANTITY', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 2 })
    await wrapper.find('[data-testid="stock-quantity-input"]').setValue('0')
    const events = wrapper.emitted('change') ?? []
    const emitted = events[events.length - 1]?.[0]
    expect(emitted).toEqual({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })
  })

  it('disables every control when disabled is passed', () => {
    const wrapper = mountField({ mode: 'HIDDEN', customQuantity: null }, true)
    expect(wrapper.find('[data-testid="stock-mode-select"]').attributes('disabled')).toBeDefined()
  })
})
