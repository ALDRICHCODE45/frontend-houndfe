/** Handoff 27 §5.2, §6: the pet of a draft line («Para: X» and the line pet picker). */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleItemRow from '../SaleItemRow.vue'
import { makePet } from '@/features/POS/customers/pets/__tests__/pet.fixture'
import type { SaleItem } from '../../interfaces/sale.types'

const selectStub = {
  props: ['modelValue', 'items', 'disabled', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<select data-testid="sale-line-pet-select" :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value" :disabled="item.disabled">{{ item.label }}</option></select>',
}

const stubs = {
  USelect: selectStub,
  Select: selectStub,
  UInputNumber: { template: '<input />' },
  UIcon: { template: '<i />' },
  UButton: { template: '<button />' },
  UDropdownMenu: { template: '<div><slot /></div>' },
  UTooltip: { template: '<div><slot /></div>' },
  StatusBadge: { props: ['label'], template: '<span>{{ label }}</span>' },
  SaleItemBadges: true,
  PriceOverrideModal: true,
  ItemDiscountModal: true,
  ProductDetailModal: true,
}

const line: SaleItem = {
  id: 'item-1',
  productId: 'prod-1',
  variantId: null,
  productName: 'Croquetas',
  variantName: null,
  quantity: 1,
  unitPriceCents: 10000,
  unitPriceCurrency: 'MXN',
  pet: null,
}

const pets = [makePet({ id: 'p1', name: 'Bruno' }), makePet({ id: 'p2', name: 'Luna' })]

function mountRow(props: Record<string, unknown> = {}) {
  return mount(SaleItemRow, {
    props: {
      item: line,
      saleId: 'sale-1',
      onSubmitPriceOverride: async () => undefined,
      onApplyDiscount: async () => undefined,
      onRemoveDiscount: async () => undefined,
      ...props,
    },
    global: { stubs },
  })
}

describe('SaleItemRow — line pet', () => {
  it('offers «Sin mascota» plus the active pets of the customer', () => {
    const wrapper = mountRow({ pets, onSetPet: vi.fn() })

    const options = wrapper.findAll('[data-testid="sale-line-pet-select"] option')
    expect(options.map((option) => option.text())).toEqual(['Sin mascota', 'Bruno', 'Luna'])
  })

  it('choosing a pet asks to set it on that line', async () => {
    const onSetPet = vi.fn(async () => undefined)
    const wrapper = mountRow({ pets, onSetPet })

    await wrapper.get('[data-testid="sale-line-pet-select"]').setValue('p2')

    expect(onSetPet).toHaveBeenCalledWith('item-1', 'p2')
  })

  it('choosing «Sin mascota» clears the pet of the line', async () => {
    const onSetPet = vi.fn(async () => undefined)
    const item = { ...line, pet: { id: 'p1', name: 'Bruno', species: 'DOG', status: 'ACTIVE' } }
    const wrapper = mountRow({ item, pets, onSetPet })

    const select = wrapper.get('[data-testid="sale-line-pet-select"]')
    const none = select.findAll('option')[0]!.element.value
    await select.setValue(none)

    expect(onSetPet).toHaveBeenCalledWith('item-1', null)
  })

  it("shows the line's archived pet as a disabled option, still offering «Sin mascota» and the active pets", async () => {
    const onSetPet = vi.fn(async () => undefined)
    const item = { ...line, pet: { id: 'p9', name: 'Kira', species: 'DOG', status: 'ARCHIVED' } }
    const wrapper = mountRow({ item, pets, onSetPet })

    const select = wrapper.get('[data-testid="sale-line-pet-select"]')
    const options = select.findAll('option')
    expect(options.map((option) => option.text())).toEqual([
      'Sin mascota',
      'Bruno',
      'Luna',
      'Kira (archivada)',
    ])
    expect(options[3]!.attributes('disabled')).toBeDefined()
    expect(options[3]!.element.value).toBe('p9')
    expect(select.findComponent(selectStub).props('modelValue')).toBe('p9')

    await select.setValue('p1')
    expect(onSetPet).toHaveBeenCalledWith('item-1', 'p1')
  })

  it('hides the picker when the customer has no active pets', () => {
    const wrapper = mountRow({ pets: [], onSetPet: vi.fn() })

    expect(wrapper.find('[data-testid="sale-line-pet-select"]').exists()).toBe(false)
  })

  it('shows «Para: <nombre>» when the line has a pet', () => {
    const item = { ...line, pet: { id: 'p1', name: 'Bruno', species: 'DOG', status: 'ACTIVE' } }
    const wrapper = mountRow({ item })

    expect(wrapper.get('[data-testid="sale-line-pet"]').text()).toBe('Para: Bruno')
  })

  it('adds an «archivada» hint when the pet was archived', () => {
    const item = { ...line, pet: { id: 'p1', name: 'Bruno', species: 'DOG', status: 'ARCHIVED' } }
    const wrapper = mountRow({ item })

    expect(wrapper.get('[data-testid="sale-line-pet"]').text()).toBe('Para: Bruno (archivada)')
  })

  it('shows no pet text on a line without pet', () => {
    const wrapper = mountRow()

    expect(wrapper.find('[data-testid="sale-line-pet"]').exists()).toBe(false)
  })
})
