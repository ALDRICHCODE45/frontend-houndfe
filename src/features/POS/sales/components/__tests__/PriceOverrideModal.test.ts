import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PriceOverrideModal from '../PriceOverrideModal.vue'
import { saleApi } from '../../api/sale.api'

const onSubmit = vi.fn()

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    getAvailablePrices: vi.fn(),
  },
}))

describe('PriceOverrideModal', () => {
  const stubs = {
    UModal: { template: '<div><slot name="body" /><slot /><slot name="footer" /></div>' },
    Modal: { template: '<div><slot name="body" /><slot /><slot name="footer" /></div>' },
    UAlert: { props: ['description'], template: '<p>{{ description }}</p>' },
    Alert: { props: ['description'], template: '<p>{{ description }}</p>' },
    UButton: {
      props: ['label', 'disabled'],
      emits: ['click'],
      template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
    },
    Button: {
      props: ['label', 'disabled'],
      emits: ['click'],
      template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
    },
    URadioGroup: {
      props: ['modelValue', 'items', 'valueKey'],
      emits: ['update:modelValue'],
      template: '<div><button v-for="item in items" :key="item[valueKey]" type="button" @click="$emit(\'update:modelValue\', item[valueKey])">{{ item.label }}</button></div>',
    },
    RadioGroup: {
      props: ['modelValue', 'items', 'valueKey'],
      emits: ['update:modelValue'],
      template: '<div><button v-for="item in items" :key="item[valueKey]" type="button" @click="$emit(\'update:modelValue\', item[valueKey])">{{ item.label }}</button></div>',
    },
    UFormField: { template: '<div><slot /></div>' },
    FormField: { template: '<div><slot /></div>' },
    UInput: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    Input: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads prices on open and preselects current option', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [
        { priceListId: 'l1', priceListName: 'PUBLICO', priceCents: 100, priceDecimal: 1, currency: 'MXN', isCurrent: true },
      ],
    })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()
    expect(saleApi.getAvailablePrices).toHaveBeenCalledWith('sale-1', 'item-1')
    expect(wrapper.text()).toContain('PUBLICO')
    expect(wrapper.text()).toContain('Contexto del precio')
    expect(wrapper.text()).toContain('Seleccioná el origen del precio')
  })

  it('submits XOR payload with priceListId only', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1', itemId: 'item-1', prices: [{ priceListId: 'l1', priceListName: 'PUBLICO', priceCents: 100, priceDecimal: 1, currency: 'MXN', isCurrent: true }],
    })
    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    expect(onSubmit).toHaveBeenCalledWith('item-1', { priceListId: 'l1' })
  })

  it('shows load error and retries successfully', async () => {
    vi.mocked(saleApi.getAvailablePrices)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        saleId: 'sale-1',
        itemId: 'item-1',
        prices: [
          {
            priceListId: 'l1',
            priceListName: 'PUBLICO',
            priceCents: 100,
            priceDecimal: 1,
            currency: 'MXN',
            isCurrent: true,
          },
        ],
      })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('No se pudieron cargar los precios disponibles. Reintentá.')

    const retryButton = wrapper.findAll('button').find((button) => button.text() === 'Reintentar')
    expect(retryButton).toBeTruthy()
    await retryButton!.trigger('click')
    await flushPromises()

    expect(saleApi.getAvailablePrices).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('PUBLICO')
    expect(wrapper.text()).not.toContain('No se pudieron cargar los precios disponibles. Reintentá.')
  })

  it('validates custom cents and blocks invalid submit', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [
        {
          priceListId: 'l1',
          priceListName: 'PUBLICO',
          priceCents: 100,
          priceDecimal: 1,
          currency: 'MXN',
          isCurrent: true,
        },
      ],
    })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as { mode: 'price_list' | 'custom'; customPriceInput: string }
    vm.mode = 'custom'
    vm.customPriceInput = '0'
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits XOR payload with customPriceCents only', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [
        {
          priceListId: 'l1',
          priceListName: 'PUBLICO',
          priceCents: 100,
          priceDecimal: 1,
          currency: 'MXN',
          isCurrent: true,
        },
      ],
    })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as { mode: 'price_list' | 'custom'; customPriceInput: string }
    vm.mode = 'custom'
    vm.customPriceInput = '500'
    await wrapper.vm.$nextTick()

    const applyButton = wrapper.findAll('button').find((button) => button.text() === 'Aplicar')
    await wrapper.find('form').trigger('submit')

    expect(onSubmit).toHaveBeenCalledWith('item-1', { customPriceCents: 50000 })
    expect(onSubmit).not.toHaveBeenCalledWith('item-1', {
      priceListId: expect.anything(),
      customPriceCents: 50000,
    })
  })

  it('formats price list options in currency and not raw cents', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [
        { priceListId: 'l1', priceListName: 'PUBLICO', priceCents: 40000, priceDecimal: 400, currency: 'MXN', isCurrent: true },
      ],
    })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('PUBLICO - $400.00')
    expect(wrapper.text()).not.toContain('PUBLICO - 40000')
  })

  it('enables apply and submits custom value without blur requirement', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [
        { priceListId: 'l1', priceListName: 'PUBLICO', priceCents: 100, priceDecimal: 1, currency: 'MXN', isCurrent: true },
      ],
    })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as { mode: 'price_list' | 'custom' }
    vm.mode = 'custom'
    await wrapper.vm.$nextTick()

    const input = wrapper.find('input[type="number"]')
    await input.setValue('500')

    const applyButton = wrapper.findAll('button').find((button) => button.text() === 'Aplicar')
    expect(applyButton?.attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    expect(onSubmit).toHaveBeenCalledWith('item-1', { customPriceCents: 50000 })
  })

  it('submits on Enter key in custom mode', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [
        { priceListId: 'l1', priceListName: 'PUBLICO', priceCents: 100, priceDecimal: 1, currency: 'MXN', isCurrent: true },
      ],
    })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as { mode: 'price_list' | 'custom' }
    vm.mode = 'custom'
    await wrapper.vm.$nextTick()
    const input = wrapper.find('input[type="number"]')
    await input.setValue('500')
    await input.trigger('keydown.enter')

    expect(onSubmit).toHaveBeenCalledWith('item-1', { customPriceCents: 50000 })
  })

  it('shows submit error and clears it after successful retry', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [
        {
          priceListId: 'l1',
          priceListName: 'PUBLICO',
          priceCents: 100,
          priceDecimal: 1,
          currency: 'MXN',
          isCurrent: true,
        },
      ],
    })

    onSubmit.mockRejectedValueOnce(new Error('conflict')).mockResolvedValueOnce(undefined)

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('No se pudo aplicar el cambio de precio. Reintentá.')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).not.toContain('No se pudo aplicar el cambio de precio. Reintentá.')
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('renders dropdown actions trigger instead of plain apply flow controls', async () => {
    vi.mocked(saleApi.getAvailablePrices).mockResolvedValue({
      saleId: 'sale-1',
      itemId: 'item-1',
      prices: [{ priceListId: 'l1', priceListName: 'PUBLICO', priceCents: 100, priceDecimal: 1, currency: 'MXN', isCurrent: true }],
    })

    const wrapper = mount(PriceOverrideModal, {
      props: { open: true, saleId: 'sale-1', itemId: 'item-1', onSubmit },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findAll('button').some((button) => button.text() === 'Desde lista')).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text() === 'Personalizado')).toBe(true)

    await wrapper.findAll('button').find((button) => button.text() === 'Personalizado')?.trigger('click')
    expect(wrapper.text()).toContain('Aplicá un precio personalizado en pesos')
  })
})
