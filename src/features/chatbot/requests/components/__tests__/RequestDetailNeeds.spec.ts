import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

const auth = vi.hoisted(() => ({ perms: new Set<string>(), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))
vi.mock('@/features/POS/sales/api/sale.api', () => ({ saleApi: { getById: vi.fn() } }))

import RequestDetailNeeds from '../RequestDetailNeeds.vue'
import { DETAIL_STUBS } from '../../utils/detail-fixture'

const modalStub = {
  name: 'ReceiptSaleSummaryModal',
  props: ['open', 'saleId', 'folio'],
  template: '<div v-if="open" data-stub="sale-modal" :data-sale="saleId" :data-folio="folio" />',
}

function mountNeeds(props: Record<string, unknown>) {
  const queryClient = new QueryClient()
  return mount(RequestDetailNeeds, {
    props: { needs: null, context: { saleId: '1aacf6d7-02db-4334-8fe6-d1812d492f31' }, ...props },
    global: {
      stubs: { ...DETAIL_STUBS, ReceiptSaleSummaryModal: modalStub },
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })
}

const context = (w: ReturnType<typeof mountNeeds>) => w.get('[data-testid="request-context"]')

beforeEach(() => {
  auth.perms = new Set(['read:ChatbotRequest', 'read:Sale'])
})

describe('RequestDetailNeeds — sale of the moment', () => {
  it('shows the folio and «Ver venta» instead of the raw sale id', async () => {
    const wrapper = mountNeeds({ saleFolio: 'A-202611-000002' })
    const text = context(wrapper).text()
    expect(text).toContain('Venta')
    expect(text).toContain('A-202611-000002')
    expect(text).not.toContain('1aacf6d7')

    await wrapper.get('[data-testid="context-sale-open"]').trigger('click')
    const modal = wrapper.get('[data-stub="sale-modal"]')
    expect(modal.attributes('data-sale')).toBe('1aacf6d7-02db-4334-8fe6-d1812d492f31')
    expect(modal.attributes('data-folio')).toBe('A-202611-000002')
  })

  it('without a known folio still hides the id and offers «Ver venta»', () => {
    const wrapper = mountNeeds({})
    expect(context(wrapper).text()).not.toContain('1aacf6d7')
    expect(wrapper.get('[data-testid="context-sale-open"]').text()).toBe('Ver venta')
  })

  it('without read:Sale shows the folio (or a plain note) and no button', () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    const withFolio = mountNeeds({ saleFolio: 'A-202611-000002' })
    expect(context(withFolio).text()).toContain('A-202611-000002')
    expect(withFolio.find('[data-testid="context-sale-open"]').exists()).toBe(false)

    const withoutFolio = mountNeeds({})
    expect(context(withoutFolio).text()).toContain('Venta ligada')
    expect(context(withoutFolio).text()).not.toContain('1aacf6d7')
  })

  it('without bot text summarizes a DELIVERY_ZONE or TRANSFER_RECEIPT decision, marked as generated', () => {
    const wrapper = mountNeeds({
      context: null,
      decision: {
        subtype: 'DELIVERY_ZONE',
        zipCode: '55635',
        neighborhood: 'San Juan',
        municipality: 'Zumpango',
        state: null,
        requesterCount: 1,
      },
    })
    const needs = wrapper.get('[data-testid="request-needs"]')
    expect(needs.text()).toBe('Entrega en CP 55635, Col. San Juan, Zumpango. Lo pidió 1 cliente.')
    expect(wrapper.get('[data-testid="request-needs-generated"]').text()).toBe('Resumen generado')
    expect(wrapper.text()).not.toContain('El bot no dejó más detalles.')
  })

  it('keeps the bot text when there is one, and the quiet line for other subtypes', () => {
    const bot = mountNeeds({
      needs: 'Lo quiere el viernes.',
      context: null,
      decision: { subtype: 'DELIVERY_ZONE', zipCode: '1' },
    })
    expect(bot.get('[data-testid="request-needs"]').text()).toBe('Lo quiere el viernes.')
    expect(bot.find('[data-testid="request-needs-generated"]').exists()).toBe(false)

    const restock = mountNeeds({ needs: '  ', context: null, decision: { subtype: 'RESTOCK' } })
    expect(restock.get('[data-testid="request-needs"]').text()).toBe('El bot no dejó más detalles.')
    expect(restock.find('[data-testid="request-needs-generated"]').exists()).toBe(false)
  })

  it('keeps the other context entries as they were', () => {
    const wrapper = mountNeeds({ context: { cartRef: 'C-9', quantity: 3 } })
    const text = context(wrapper).text()
    expect(text).toContain('Carrito')
    expect(text).toContain('C-9')
    expect(text).toContain('Cantidad')
    expect(wrapper.find('[data-testid="context-sale-open"]').exists()).toBe(false)
  })
})
