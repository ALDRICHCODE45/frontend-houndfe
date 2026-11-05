import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { shallowRef } from 'vue'
import PurchaseOrderLine from '../PurchaseOrderLine.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import { replaceLineProduct } from '../../utils/order-buffer'
import type { LineBuffer } from '../../utils/order-buffer'
vi.mock('../../composables/usePurchaseOrderProducts', () => ({ usePurchaseOrderVariants: () => ({ items: shallowRef([{ id: 'v', name: 'Grande' }]), error: shallowRef(null), isFetching: shallowRef(false), refresh: vi.fn() }) }))
const clean = { product: false, variant: false, quantity: false, cost: false, tax: false, any: false }
const line = (patch: Partial<LineBuffer> = {}): LineBuffer => ({ ...replaceLineProduct({ id: 'p', name: 'Harina', type: 'PRODUCT', unit: 'KILOGRAMO', hasVariants: true, useStock: true }), variantId: 'v', variantName: 'Grande', quantity: '1.230', amount: '12', taxBasis: 'INCLUDES_TAX', hasCost: true, ...patch })
const subtotal = { amount: '23.100', currency: 'MXN', taxBasis: 'INCLUDES_TAX' as const }
const context = { userId: 'u', tenantId: 't', ready: true, canReadProduct: true }
const mountLine = (props: Record<string, unknown> = {}) => mount(PurchaseOrderLine, { props: { modelValue: line(), index: 0, context, messages: {}, subtotal, flags: clean, open: false, ...props }, attachTo: document.body })

describe('compact line row', () => {
  it('shows the product with its variant under it, quantity with unit, unit cost and the server subtotal', () => {
    const wrapper = mountLine()
    const toggle = wrapper.get('button.order-line-toggle')
    expect(toggle.text()).toContain('Harina')
    expect(wrapper.get('.order-line-variant').text()).toBe('Grande')
    expect(wrapper.get('.order-line-qty').text()).toBe('1.230 Kilogramo')
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('$12.00')
    expect(wrapper.get('.order-line-tax').text()).toBe('con imp.')
    expect(wrapper.get('[data-testid="line-subtotal"]').text()).toBe('$23.10')
    expect(wrapper.text()).not.toContain('23.100 MXN')
    expect(wrapper.text()).not.toContain('Último subtotal guardado')
    wrapper.unmount()
  })
  it('right-aligns tabular money and reads a dash when there is no saved subtotal', () => {
    const wrapper = mountLine({ subtotal: undefined })
    expect(wrapper.get('[data-testid="line-subtotal"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="line-subtotal"]').classes()).toContain('order-money')
    wrapper.unmount()
  })
  it('names the toggle after the line and wires aria-expanded / aria-controls to the edit row', async () => {
    const wrapper = mountLine()
    const toggle = wrapper.get('button.order-line-toggle')
    expect(toggle.attributes('aria-label')).toBe('Editar renglón 1: Harina, Grande')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.order-line-edit').exists()).toBe(false)
    await wrapper.setProps({ open: true })
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.order-line-edit').attributes('id')).toBe(toggle.attributes('aria-controls'))
    wrapper.unmount()
  })
  it('keeps the placeholder for a line without a product, and no id leaks into the markup', () => {
    const wrapper = mountLine({ modelValue: line({ name: '', productId: null, variantId: null, variantName: null, hasVariants: null }) })
    expect(wrapper.get('button.order-line-toggle').text()).toContain('Sin producto')
    expect(wrapper.find('.order-line-variant').exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
    wrapper.unmount()
  })
})

describe('money precision', () => {
  it('shows two decimals and puts the exact server value in the title only where it was rounded', () => {
    const wrapper = mountLine({ modelValue: line({ amount: '128.125' }), subtotal: { amount: '23.100', currency: 'MXN', taxBasis: 'INCLUDES_TAX' } })
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('$128.13')
    expect(wrapper.get('[data-testid="line-cost"]').attributes('title')).toBe('$128.125')
    expect(wrapper.get('[data-testid="line-subtotal"]').text()).toBe('$23.10')
    expect(wrapper.get('[data-testid="line-subtotal"]').attributes('title')).toBeUndefined()
    expect(wrapper.text()).not.toMatch(/\$\d[\d,]*\.\d{3,}/)
    wrapper.unmount()
  })
})

describe('inline edit row', () => {
  it('opens when the whole row or its product button is activated, never from the ⋮', async () => {
    const wrapper = mountLine()
    await wrapper.get('.order-line-row').trigger('click')
    expect(wrapper.emitted('update:open')?.slice(-1)[0]).toEqual([true])
    await wrapper.get('button.order-line-toggle').trigger('click')
    expect(wrapper.emitted('update:open')).toHaveLength(2)
    await wrapper.get('.hf-row-actions-trigger').trigger('click')
    expect(wrapper.emitted('update:open')).toHaveLength(2)
    wrapper.unmount()
  })
  it('collapses when the row is activated while open', async () => {
    const wrapper = mountLine({ open: true })
    await wrapper.get('button.order-line-toggle').trigger('click')
    expect(wrapper.emitted('update:open')?.slice(-1)[0]).toEqual([false])
    wrapper.unmount()
  })
  it('holds quantity, cost and impuestos with the decimal rules, and keeps strings as typed', async () => {
    const wrapper = mountLine({ open: true, modelValue: line({ taxBasis: '' }) })
    expect(wrapper.get<HTMLSelectElement>('[data-testid="line-tax"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="line-quantity"]').attributes('step')).toBe('0.001')
    expect(wrapper.find('input[value="MXN"]').exists()).toBe(false)
    await wrapper.get('[data-testid="line-quantity"]').setValue('2.500')
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toMatchObject({ quantity: '2.500' })
    await wrapper.get('[data-testid="line-amount"]').setValue('10.5')
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toMatchObject({ amount: '10.5' })
    wrapper.unmount()
  })
  it('offers the variant select when the product has variants', () => {
    const wrapper = mountLine({ open: true })
    expect(wrapper.find('select[data-testid="line-variant"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('collapses on Listo and returns focus to the line toggle', async () => {
    const wrapper = mountLine({ open: true })
    await wrapper.get('button.order-line-done').trigger('click')
    expect(wrapper.emitted('update:open')?.slice(-1)[0]).toEqual([false])
    await wrapper.setProps({ open: false })
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(wrapper.get('button.order-line-toggle').element)
    wrapper.unmount()
  })
  it('shows local validation messages under their field, nothing from the server', () => {
    const wrapper = mountLine({ open: true, messages: { '/lines/0/orderedQuantity': ['Escribe una cantidad positiva con el formato de esta unidad; usa punto para los decimales.'] } })
    expect(wrapper.get('.order-line-edit').text()).toContain('Escribe una cantidad positiva')
    wrapper.unmount()
  })
})

describe('line with pending issues', () => {
  it('gets the warning tint and a Falta marker in the missing cost, with the subtotal still a dash', () => {
    const wrapper = mountLine({ modelValue: line({ amount: '', taxBasis: '', hasCost: false }), flags: { ...clean, cost: true, tax: true, any: true }, subtotal: null })
    expect(wrapper.get('.order-line-row').attributes('data-flagged')).toBe('true')
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('Falta el costo')
    expect(wrapper.get('[data-testid="line-cost"]').classes()).toContain('order-missing')
    expect(wrapper.get('[data-testid="line-subtotal"]').text()).toBe('—')
    wrapper.unmount()
  })
  it('says Falta once in the cost cell even when the cost and the taxes are both missing, naming the part in a hidden-on-desktop description', () => {
    const wrapper = mountLine({ modelValue: line({ amount: '', taxBasis: '', hasCost: false }), flags: { ...clean, cost: true, tax: true, any: true }, subtotal: null })
    const cell = wrapper.get('.order-line-cost')
    expect(cell.text().match(/Falta/g)).toHaveLength(1)
    expect(cell.find('.order-line-tax').exists()).toBe(false)
    expect(cell.get('.order-missing-part').text()).toBe('el costo')
    expect(wrapper.get('[data-testid="line-cost"]').attributes('title')).toBe('Falta el costo')
    wrapper.unmount()
  })
  it('marks only the taxes when the cost is there: the amount stays and the second line says Falta once', () => {
    const wrapper = mountLine({ modelValue: line({ taxBasis: '' }), flags: { ...clean, tax: true, any: true } })
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('$12.00')
    expect(wrapper.get('.order-line-cost').text().match(/Falta/g)).toHaveLength(1)
    expect(wrapper.get('.order-line-tax').text()).toBe('Falta impuestos')
    expect(wrapper.get('.order-line-tax .order-missing-part').text()).toBe('impuestos')
    wrapper.unmount()
  })
  it('marks a missing quantity the same way', () => {
    const wrapper = mountLine({ modelValue: line({ quantity: '' }), flags: { ...clean, quantity: true, any: true } })
    expect(wrapper.get('.order-line-qty').text()).toBe('Falta la cantidad')
    expect(wrapper.get('.order-line-qty').text().match(/Falta/g)).toHaveLength(1)
    wrapper.unmount()
  })
  it('lets the cost invalid state point at the checklist: aria-invalid on the empty field, no repeated message', () => {
    const wrapper = mountLine({ open: true, modelValue: line({ amount: '', taxBasis: '', hasCost: false }), flags: { ...clean, cost: true, any: true }, describedby: 'order-checklist' })
    const amount = wrapper.get('[data-testid="line-amount"]')
    expect(amount.attributes('aria-invalid')).toBe('true')
    expect(amount.attributes('aria-describedby')).toBe('order-checklist')
    expect(wrapper.get('.order-line-edit').text()).not.toContain('Indica el importe')
    wrapper.unmount()
  })
  it('clears the marker and the tint once the user types the missing value', () => {
    const wrapper = mountLine({ modelValue: line({ amount: '85' }), flags: { ...clean, cost: true, any: true } })
    expect(wrapper.get('[data-testid="line-cost"]').text()).toBe('$85.00')
    expect(wrapper.get('.order-line-row').attributes('data-flagged')).toBeUndefined()
    wrapper.unmount()
  })
  it('focuses the first missing field of the open edit row', async () => {
    const wrapper = mountLine({ open: true, modelValue: line({ amount: '', hasCost: false }), flags: { ...clean, cost: true, any: true } })
    ;(wrapper.vm as unknown as { focusIssue: () => void }).focusIssue()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="line-amount"]').element)
    wrapper.unmount()
  })
})

describe('line ⋮ menu', () => {
  it('holds Editar renglón, Cambiar producto and, last, the destructive Quitar renglón; no loose trash button', () => {
    const wrapper = mountLine()
    const menu = wrapper.getComponent(RowActionsMenu)
    expect(menu.props('ariaLabel')).toBe('Más acciones del renglón 1')
    expect((menu.props('actions') as Array<{ label: string; destructive?: boolean }>).map(action => [action.label, Boolean(action.destructive)])).toEqual([['Editar renglón', false], ['Cambiar producto', false], ['Quitar renglón', true]])
    expect(wrapper.findAll('button').map(button => button.attributes('aria-label') ?? button.text()).filter(name => /Quitar|Cambiar producto/.test(name))).toEqual([])
    wrapper.unmount()
  })
  it('relays each choice', () => {
    const wrapper = mountLine()
    const menu = wrapper.getComponent(RowActionsMenu)
    menu.vm.$emit('select', 'edit'); menu.vm.$emit('select', 'replace'); menu.vm.$emit('select', 'remove')
    expect(wrapper.emitted('update:open')?.slice(-1)[0]).toEqual([true])
    expect(wrapper.emitted('replace')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
    wrapper.unmount()
  })
  it('disables the items and the fields when the form is disabled', () => {
    const wrapper = mountLine({ disabled: true, open: true })
    expect((wrapper.getComponent(RowActionsMenu).props('actions') as Array<{ disabled?: boolean }>).every(action => action.disabled)).toBe(true)
    expect(wrapper.get('[data-testid="line-quantity"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
