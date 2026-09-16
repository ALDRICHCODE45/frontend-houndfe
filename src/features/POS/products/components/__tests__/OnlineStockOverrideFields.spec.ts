// OnlineStockOverrideFields.spec.ts — WU5 strict-TDD pins for the shared
// nullable product/variant stock override (REQ-13/REQ-16; reused by WU6):
// clearing emits BOTH flat stock fields as null, non-custom modes serialize a
// null quantity, CUSTOM_QUANTITY keeps the integer with 0 labeled "Mostrar 0".

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import OnlineStockOverrideFields from '../OnlineStockOverrideFields.vue'

const mountField = (value: Record<string, unknown>, props: Record<string, unknown> = {}) =>
  mountWithUApp(OnlineStockOverrideFields, { props: { value, ...props } })

describe('OnlineStockOverrideFields — shared nullable stock override', () => {
  it('renders the mode select with the tenant-default option and the closed mode set', () => {
    const wrapper = mountField({ mode: null, customQuantity: null })
    const select = wrapper.find('[data-testid="stock-override-mode"]')
    expect(select.exists()).toBe(true)
    const values = select.findAll('option').map((option) => option.element.value)
    expect(values[0]).toBe('')
    expect(values).toEqual(
      expect.arrayContaining(['SYSTEM_STATUS', 'ABSTRACT_STATUS', 'CUSTOM_QUANTITY', 'HIDDEN']),
    )
    expect((select.element as HTMLSelectElement).disabled).toBe(false)
  })

  it('clearing emits BOTH flat stock fields as null (keys not omitted)', async () => {
    const wrapper = mountField({ mode: 'HIDDEN', customQuantity: null })
    await wrapper.find('[data-testid="stock-override-mode"]').setValue('')
    expect(wrapper.emitted('change')?.[0]).toEqual([{ mode: null, customQuantity: null }])
  })

  it.each([['SYSTEM_STATUS'], ['ABSTRACT_STATUS'], ['HIDDEN']] as const)(
    '%s serializes customQuantity as null',
    async (mode) => {
      const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 4 })
      await wrapper.find('[data-testid="stock-override-mode"]').setValue(mode)
      expect(wrapper.emitted('change')?.[0]).toEqual([{ mode, customQuantity: null }])
    },
  )

  it('CUSTOM_QUANTITY keeps the quantity and labels 0 literally as "Mostrar 0"', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })
    expect(wrapper.text()).toContain('Mostrar 0')
    const input = wrapper.find('[data-testid="stock-override-qty"]')
    expect((input.element as HTMLInputElement).value).toBe('0')
    await input.setValue('3')
    expect(wrapper.emitted('change')?.[0]).toEqual([{ mode: 'CUSTOM_QUANTITY', customQuantity: 3 }])
  })

  it('disables both controls when disabled', () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }, { disabled: true })
    expect((wrapper.find('[data-testid="stock-override-mode"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="stock-override-qty"]').element as HTMLInputElement).disabled).toBe(true)
  })
})
