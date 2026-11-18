import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationConvertDialog from '../QuotationConvertDialog.vue'
import type { QuotationConversionFailure } from '../../interfaces/quotation.types'

const modalStub = {
  props: ['open', 'title', 'dismissible', 'close', 'ui'],
  emits: ['update:open'],
  template:
    '<div v-if="open" data-testid="convert-dialog-modal"><slot name="body" /><slot name="footer" /></div>',
}
const buttonStub = {
  props: ['label', 'color', 'variant', 'loading', 'disabled'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" :data-loading="String(!!loading)" @click="$emit(\'click\')">{{ label }}<slot /></button>',
}
const stubs = { UModal: modalStub, Modal: modalStub, UButton: buttonStub, Button: buttonStub }

function mountDialog(
  props: Partial<{
    open: boolean
    pending: boolean
    failure: QuotationConversionFailure | null
    confirmLabel: string
    portalClass: string
  }> = {},
) {
  return mount(QuotationConvertDialog, {
    props: { open: true, pending: false, failure: null, ...props },
    global: { stubs },
  })
}

describe('QuotationConvertDialog — confirm (S4/S5)', () => {
  it('asks the question and states the pricing rule', () => {
    const wrapper = mountDialog()
    const modal = wrapper.findComponent(modalStub)
    expect(modal.props('title')).toBe('¿Convertir en venta?')
    expect(wrapper.get('[data-testid="convert-dialog-rule"]').text()).toBe(
      'Se abre una venta con los precios y descuentos cotizados. Después puedes ajustarla en el punto de venta.',
    )
    expect(modal.props('ui')).toEqual({
      content: 'hf-theme hf-ui hf-form-overlay quotations-workspace-portal',
    })
  })

  it('emits confirm from «Convertir en venta» and close from «Volver»', async () => {
    const wrapper = mountDialog()
    const confirm = wrapper.get('[data-testid="convert-dialog-confirm"]')
    expect(confirm.text()).toBe('Convertir en venta')
    await confirm.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    await wrapper.get('[data-testid="convert-dialog-cancel"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('accepts a custom confirm label («Convertir de nuevo»)', () => {
    const wrapper = mountDialog({ confirmLabel: 'Convertir de nuevo' })
    expect(wrapper.get('[data-testid="convert-dialog-confirm"]').text()).toBe('Convertir de nuevo')
  })

  it('while pending the confirm loads and closing is blocked', async () => {
    const wrapper = mountDialog({ pending: true })
    expect(wrapper.get('[data-testid="convert-dialog-confirm"]').attributes('data-loading')).toBe('true')
    expect(wrapper.get('[data-testid="convert-dialog-cancel"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(modalStub).props('dismissible')).toBe(false)
  })
})

describe('QuotationConvertDialog — rejections (S4)', () => {
  it('shows the Spanish title and line, and no confirm, for a terminal rejection', () => {
    const wrapper = mountDialog({ failure: { code: 'QUOTATION_EXPIRED' } })
    const alert = wrapper.get('[data-testid="convert-dialog-failure"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('La cotización venció')
    expect(alert.text()).toContain('Renuévala para venderla con precios vigentes.')
    expect(wrapper.find('[data-testid="convert-dialog-rule"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-dialog-confirm"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="convert-dialog-cancel"]').text()).toBe('Cerrar')
  })

  it('lists every unavailable line with its reason', () => {
    const wrapper = mountDialog({
      failure: {
        code: 'QUOTATION_LINES_UNAVAILABLE',
        lines: [
          { lineId: 'l1', productId: 'p1', variantId: null, productName: 'Playera', variantName: null, reason: 'INSUFFICIENT_STOCK', requestedQuantity: 2, availableQuantity: 1 },
          { lineId: 'l2', productId: 'p2', variantId: null, productName: 'Gorra', variantName: null, reason: 'PRODUCT_NOT_SELLABLE', requestedQuantity: 1, availableQuantity: null },
        ],
      },
    })
    const items = wrapper.findAll('[data-testid="convert-dialog-line"]')
    expect(items.map((i) => i.text())).toEqual([
      'Playera: stock insuficiente (pides 2, hay 1)',
      'Gorra: ya no se vende en el punto de venta',
    ])
  })

  it('QUOTATION_ALREADY_CONVERTED offers «Ver venta» with the saleId', async () => {
    const wrapper = mountDialog({ failure: { code: 'QUOTATION_ALREADY_CONVERTED', saleId: 'sale-7' } })
    expect(wrapper.text()).toContain('Ya se convirtió en venta')
    const view = wrapper.get('[data-testid="convert-dialog-view-sale"]')
    expect(view.text()).toBe('Ver venta')
    await view.trigger('click')
    expect(wrapper.emitted('view-sale')).toEqual([['sale-7']])
  })

  it('QUOTATION_ALREADY_CONVERTED without saleId has no «Ver venta»', () => {
    const wrapper = mountDialog({ failure: { code: 'QUOTATION_ALREADY_CONVERTED', saleId: null } })
    expect(wrapper.find('[data-testid="convert-dialog-view-sale"]').exists()).toBe(false)
  })

  it('a retryable rejection offers «Reintentar», which confirms again', async () => {
    const wrapper = mountDialog({ failure: { code: 'NETWORK' } })
    expect(wrapper.text()).toContain('No se pudo conectar')
    const retry = wrapper.get('[data-testid="convert-dialog-confirm"]')
    expect(retry.text()).toBe('Reintentar')
    await retry.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
