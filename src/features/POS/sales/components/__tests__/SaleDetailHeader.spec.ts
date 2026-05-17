import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailHeader from '../SaleDetailHeader.vue'
import type { SaleDetail } from '../../interfaces/sale.types'

const mockSale: SaleDetail = {
  id: 'sale-1',
  folio: 'A-202605-000001',
  status: 'CONFIRMED',
  channel: 'Punto de Venta',
  register: 'Principal',
  confirmedAt: '2026-05-16T10:00:00Z',
  dueDate: null,
  subtotalCents: 10000,
  discountCents: 0,
  totalCents: 10000,
  paidCents: 5000,
  debtCents: 5000,
  changeDueCents: 0,
  paymentStatus: 'PARTIAL',
  deliveryStatus: 'PENDING',
  customer: null,
  cashier: { id: 'cashier-1', name: 'María García' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
}

const mockActionItems = [
  { label: 'Imprimir Ticket', icon: 'i-lucide-printer', disabled: true },
  { label: 'Descargar PDF', icon: 'i-lucide-download', disabled: true },
]

describe('SaleDetailHeader', () => {
  it('displays sale folio in title', () => {
    const wrapper = mountWithUApp(SaleDetailHeader, {
      props: { sale: mockSale, actionItems: mockActionItems }
    })
    
    expect(wrapper.text()).toContain('Venta #1')
  })

  it('shows delivery and payment status badges', () => {
    const wrapper = mountWithUApp(SaleDetailHeader, {
      props: { sale: mockSale, actionItems: mockActionItems }
    })
    
    expect(wrapper.text()).toContain('No Entregados')
    expect(wrapper.text()).toContain('Impaga')
  })

  it('only shows delivery badge when paymentStatus is null (DRAFT)', () => {
    const draftSale: SaleDetail = {
      ...mockSale,
      paymentStatus: null as any, // DRAFT case
    }
    
    const wrapper = mountWithUApp(SaleDetailHeader, {
      props: { sale: draftSale, actionItems: mockActionItems }
    })
    
    expect(wrapper.text()).toContain('No Entregados')
    // Should not show payment badge for draft sales
    expect(wrapper.text()).not.toContain('Impaga')
  })

  it('emits back event when back button clicked', async () => {
    const wrapper = mountWithUApp(SaleDetailHeader, {
      props: { sale: mockSale, actionItems: mockActionItems }
    })
    
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })

  it('displays "Más Acciones" dropdown', () => {
    const wrapper = mountWithUApp(SaleDetailHeader, {
      props: { sale: mockSale, actionItems: mockActionItems }
    })
    
    expect(wrapper.text()).toContain('Más Acciones')
  })
})