// T2 (quotation-sale-conversion, S1 + S3): the «Pasar a cotización» dialog.
// The conversion itself (route, key, invalidation) is pinned in
// useSaleToQuotation.test.ts; here the dialog copy, the notes limit, the
// error rendering, the dropped-adjustments summary and the double-submit guard.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import SaleToQuotationModal from '../SaleToQuotationModal.vue'
import type {
  CreateQuotationFromSaleResponse,
  QuotationConversionFailure,
  QuotationResponseDto,
} from '@/features/POS/quotations/interfaces/quotation.types'

const { state } = vi.hoisted(() => ({
  state: {
    convert: vi.fn(),
    startAttempt: vi.fn(),
  },
}))
const isPending = ref(false)
const failure = ref<QuotationConversionFailure | null>(null)

vi.mock('../../composables/useSaleToQuotation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../composables/useSaleToQuotation')>()
  return {
    ...actual,
    useSaleToQuotation: () => ({
      convert: state.convert,
      startAttempt: state.startAttempt,
      isPending,
      failure,
    }),
  }
})

const buttonStub = {
  props: ['label', 'disabled', 'loading'],
  emits: ['click'],
  template: '<button :disabled="disabled || loading" :data-loading="loading" @click="$emit(\'click\')">{{ label }}<slot /></button>',
}
const textareaStub = {
  props: ['modelValue', 'id'],
  emits: ['update:modelValue'],
  template: '<textarea :id="id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
// Mirrors UModal → reka DialogContent: `content` props land on the dialog element
// (they override reka's own aria-describedby) and the description slot is rendered.
const modalStub = {
  props: ['open', 'title', 'content'],
  emits: ['update:open'],
  template:
    '<div v-if="open" role="dialog" data-testid="modal" v-bind="content"><h2 data-testid="modal-title">{{ title }}</h2><slot name="description" /><slot name="body" /><slot name="footer" /></div>',
}
const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UTextarea: textareaStub,
  Textarea: textareaStub,
  UIcon: { template: '<i />' },
  Icon: { template: '<i />' },
}

function makeResult(dropped: CreateQuotationFromSaleResponse['droppedAdjustments']): CreateQuotationFromSaleResponse {
  return {
    quotation: { id: 'q-1' } as QuotationResponseDto,
    discardedSaleId: 'sale-1',
    droppedAdjustments: dropped,
  }
}

function mountModal(props: Partial<{ open: boolean; saleId: string | null; itemCount: number }> = {}) {
  return mount(SaleToQuotationModal, {
    props: { open: true, saleId: 'sale-1', itemCount: 3, ...props },
    global: { stubs },
  })
}

const submit = (wrapper: ReturnType<typeof mountModal>) =>
  wrapper.find('[data-testid="sale-to-quotation-submit"]').trigger('click')

beforeEach(() => {
  state.convert.mockReset()
  state.startAttempt.mockReset()
  isPending.value = false
  failure.value = null
})

describe('SaleToQuotationModal — confirm', () => {
  it('asks a question, says what happens and names the action', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="modal-title"]').text()).toBe('¿Pasar esta venta a cotización?')
    expect(wrapper.find('[data-testid="sale-to-quotation-consequence"]').text()).toBe(
      'La venta en curso se descarta y queda guardada como cotización.',
    )
    expect(wrapper.find('[data-testid="sale-to-quotation-detail"]').text()).toBe(
      'Se llevan los 3 productos. Si alguna promoción no aplica en cotizaciones, te la mostramos al terminar.',
    )
    expect(wrapper.find('label[for="sale-to-quotation-notes"]').text()).toBe('Nota para el cliente')
    expect(wrapper.find('[data-testid="sale-to-quotation-submit"]').text()).toBe('Pasar a cotización')
    expect(wrapper.find('[data-testid="sale-to-quotation-cancel"]').text()).toBe('Cancelar')
  })

  it('starts a fresh attempt every time it opens', async () => {
    const wrapper = mountModal({ open: false })
    await wrapper.setProps({ open: true })
    expect(state.startAttempt).toHaveBeenCalledTimes(1)
  })

  it('counts the notes up to 280 and blocks longer notes', async () => {
    const wrapper = mountModal()
    const field = wrapper.find('textarea#sale-to-quotation-notes')

    expect(wrapper.text()).toContain('0 de 280')
    await field.setValue('Entrega en sucursal Norte')
    expect(wrapper.text()).toContain('25 de 280')

    await field.setValue('a'.repeat(281))
    expect(wrapper.text()).toContain('281 de 280')
    expect(wrapper.text()).toContain('Máximo 280 caracteres.')
    expect(field.attributes('aria-invalid')).toBe('true')
    await submit(wrapper)
    expect(state.convert).not.toHaveBeenCalled()

    await field.setValue('a'.repeat(280))
    expect(wrapper.text()).not.toContain('Máximo 280 caracteres.')
  })

  it('submits the sale id and the notes', async () => {
    state.convert.mockResolvedValue(null)
    const wrapper = mountModal()
    await wrapper.find('textarea').setValue('Entrega Norte')
    await submit(wrapper)
    expect(state.convert).toHaveBeenCalledWith('sale-1', 'Entrega Norte')
  })

  it('does not submit twice while the conversion is pending', async () => {
    isPending.value = true
    const wrapper = mountModal()
    const button = wrapper.find('[data-testid="sale-to-quotation-submit"]')

    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.vm.$nextTick()
    // Even a forced click (keyboard Enter on the form) is ignored.
    await wrapper.find('form').trigger('submit')
    expect(state.convert).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="sale-to-quotation-cancel"]').attributes('disabled')).toBeDefined()
  })
})

describe('SaleToQuotationModal — errors', () => {
  it.each<[QuotationConversionFailure, string]>([
    [{ code: 'SALE_HAS_PAYMENTS' }, 'Esta venta ya tiene pagos registrados, así que no se puede pasar a cotización.'],
    [{ code: 'SALE_HAS_STOCK_MOVEMENTS' }, 'Esta venta ya movió inventario, así que no se puede pasar a cotización.'],
    [
      { code: 'SALE_NOT_DISCARDABLE' },
      'Esta venta está en una ruta de entrega o ya usó el cupo de una promoción, así que no se puede pasar a cotización.',
    ],
    [{ code: 'SALE_HAS_NO_ITEMS' }, 'La venta no tiene productos. Agrega al menos uno para crear la cotización.'],
    [{ code: 'IDEMPOTENCY_KEY_IN_FLIGHT' }, 'La cotización se está creando. Espera unos segundos y vuelve a intentar.'],
    [
      { code: 'FORBIDDEN' },
      'Tu rol no permite pasar ventas a cotización: necesitas crear cotizaciones y eliminar ventas.',
    ],
    [
      { code: 'NETWORK' },
      'No hubo respuesta del servidor. Revisa tu conexión y vuelve a intentar; no se creará una cotización duplicada.',
    ],
    [{ code: 'UNKNOWN', status: 500, error: null }, 'No se pudo pasar la venta a cotización. Vuelve a intentar.'],
  ])('shows %o inside the dialog', (value, message) => {
    failure.value = value
    const wrapper = mountModal()
    const alert = wrapper.find('[data-testid="sale-to-quotation-error"]')

    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain(message)
    // The dialog stays open: the cashier can fix the cause and retry.
    expect(wrapper.find('[data-testid="sale-to-quotation-submit"]').exists()).toBe(true)
  })

  it('lists each unavailable line', () => {
    failure.value = {
      code: 'SALE_LINES_UNAVAILABLE',
      lines: [
        {
          lineId: 'l-1',
          productId: 'p-1',
          variantId: null,
          productName: 'Playera',
          variantName: 'Talla M',
          reason: 'PRODUCT_NOT_SELLABLE',
          requestedQuantity: 2,
          availableQuantity: null,
        },
        {
          lineId: 'l-2',
          productId: 'p-2',
          variantId: null,
          productName: 'Gorra',
          variantName: null,
          reason: 'PRODUCT_NOT_FOUND',
          requestedQuantity: 1,
          availableQuantity: null,
        },
      ],
    }
    const wrapper = mountModal()

    expect(wrapper.find('[data-testid="sale-to-quotation-error"]').text()).toContain(
      'Estos productos ya no se pueden cotizar. Quítalos de la venta y vuelve a intentar:',
    )
    expect(wrapper.findAll('[data-testid="sale-to-quotation-error-line"]').map((li) => li.text())).toEqual([
      'Playera · Talla M — ya no se vende en punto de venta',
      'Gorra — el producto ya no existe',
    ])
  })

  it('offers «Reintentar» after a network failure', () => {
    failure.value = { code: 'NETWORK' }
    expect(mountModal().find('[data-testid="sale-to-quotation-submit"]').text()).toBe('Reintentar')
  })
})

describe('SaleToQuotationModal — success', () => {
  it('without dropped adjustments emits converted, opens the quotation and closes', async () => {
    const result = makeResult([])
    state.convert.mockResolvedValue(result)
    const wrapper = mountModal()

    await submit(wrapper)
    await flushPromises()

    expect(wrapper.emitted('converted')).toEqual([[result]])
    expect(wrapper.emitted('open-quotation')).toEqual([['q-1']])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('with dropped adjustments shows each one before leaving', async () => {
    const result = makeResult([
      {
        kind: 'ORDER_PROMOTION',
        saleItemId: null,
        productId: null,
        variantId: null,
        promotionId: 'p-1',
        title: 'Promo X',
        discountCents: 1200,
      },
      {
        kind: 'REWARD_PROMOTION',
        saleItemId: 'si-1',
        productId: 'p-2',
        variantId: null,
        promotionId: 'p-2',
        title: '2x1 Playeras',
        discountCents: 15000,
      },
    ])
    state.convert.mockResolvedValue(result)
    const wrapper = mountModal()

    await submit(wrapper)
    await flushPromises()

    expect(wrapper.emitted('converted')).toEqual([[result]])
    expect(wrapper.emitted('open-quotation')).toBeUndefined()
    expect(wrapper.find('[data-testid="modal-title"]').text()).toBe('Cotización creada')
    expect(wrapper.find('[data-testid="sale-to-quotation-dropped-intro"]').text()).toBe(
      'La venta ya se descartó. Avísale al cliente que la cotización no incluye estos descuentos:',
    )
    expect(wrapper.findAll('[data-testid="sale-to-quotation-dropped-item"]').map((li) => li.text())).toEqual([
      'No se trasladó: Promo X (−$12.00)',
      'No se trasladó: 2x1 Playeras (−$150.00)',
    ])
    expect(wrapper.find('textarea').exists()).toBe(false)

    await wrapper.find('[data-testid="sale-to-quotation-open"]').trigger('click')
    expect(wrapper.emitted('open-quotation')).toEqual([['q-1']])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('«Seguir vendiendo» only closes', async () => {
    state.convert.mockResolvedValue(
      makeResult([
        {
          kind: 'LINE_PROMOTION',
          saleItemId: 'si',
          productId: 'p',
          variantId: null,
          promotionId: 'x',
          title: 'Promo línea',
          discountCents: 500,
        },
      ]),
    )
    const wrapper = mountModal()
    await submit(wrapper)
    await flushPromises()

    await wrapper.find('[data-testid="sale-to-quotation-stay"]').trigger('click')
    expect(wrapper.emitted('open-quotation')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})

// odd D5 — the consequence was read twice (sr-only description + visible paragraph).
// One accessible description: the dialog points at the visible paragraph, and the
// sentence appears once in the dialog.
describe('SaleToQuotationModal — accessible description (odd D5)', () => {
  const CONSEQUENCE = 'La venta en curso se descarta y queda guardada como cotización.'

  function occurrences(text: string, needle: string) {
    return text.split(needle).length - 1
  }

  it('describes the confirm dialog with the visible consequence, said once', () => {
    const wrapper = mountModal()
    const dialog = wrapper.find('[role="dialog"]')
    const describedBy = dialog.attributes('aria-describedby')

    expect(describedBy).toBeTruthy()
    const description = wrapper.find(`#${describedBy}`)
    expect(description.exists()).toBe(true)
    expect(description.text()).toBe(CONSEQUENCE)
    expect(description.classes()).not.toContain('sr-only')
    expect(occurrences(dialog.text(), CONSEQUENCE)).toBe(1)
  })

  it('describes the summary with its visible intro, said once', async () => {
    state.convert.mockResolvedValue(
      makeResult([
        {
          kind: 'ORDER_PROMOTION',
          saleItemId: null,
          productId: null,
          variantId: null,
          promotionId: 'p-1',
          title: 'Buen Fin',
          discountCents: 6201,
        },
      ]),
    )
    const wrapper = mountModal()
    await submit(wrapper)
    await flushPromises()

    const dialog = wrapper.find('[role="dialog"]')
    const description = wrapper.find(`#${dialog.attributes('aria-describedby')}`)
    expect(description.attributes('data-testid')).toBe('sale-to-quotation-dropped-intro')
    expect(occurrences(dialog.text(), 'La cotización no incluye algunos descuentos de la venta.')).toBe(0)
  })
})
