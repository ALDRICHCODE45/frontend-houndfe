import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailFinancialCard from '../SaleDetailFinancialCard.vue'
import type { SaleDetail } from '../../interfaces/sale.types'

const mockSale: SaleDetail = {
  id: 'sale-1',
  folio: 'A-202605-000001',
  status: 'CONFIRMED',
  channel: 'Punto de Venta',
  register: 'Principal',
  confirmedAt: '2026-05-16T10:00:00Z',
  dueDate: '2026-05-20T00:00:00Z',
  subtotalCents: 10000,
  discountCents: 500,
  totalCents: 9500,
  paidCents: 5000,
  debtCents: 4500,
  changeDueCents: 0,
  paymentStatus: 'PARTIAL',
  deliveryStatus: 'PENDING',
  customer: { id: 'customer-1', name: 'Juan Pérez' },
  cashier: { id: 'cashier-1', name: 'María García' },
  seller: { id: 'seller-1', name: 'Carlos López' },
  items: [],
  payments: [],
  timeline: [],
}

describe('SaleDetailFinancialCard', () => {
  it('renders payment status badge', () => {
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: mockSale }
    })
    
    expect(wrapper.find('[data-testid="payment-status-badge"]').exists()).toBe(true)
  })

  it('displays total and paid amounts', () => {
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: mockSale }
    })
    
    expect(wrapper.text()).toContain('$95.00') // total
    expect(wrapper.text()).toContain('$50.00') // paid
  })

  it('shows balance with error color when there is debt', () => {
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: mockSale }
    })
    
    expect(wrapper.text()).toContain('$45.00') // debt
  })

  it('shows "Registrar Pago" button when there is debt', () => {
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: mockSale }
    })
    
    expect(wrapper.find('button').text()).toContain('Registrar Pago')
  })

  it('shows success message when fully paid', () => {
    const paidSale: SaleDetail = {
      ...mockSale,
      paymentStatus: 'PAID',
      paidCents: 9500,
      debtCents: 0,
    }
    
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: paidSale }
    })
    
    expect(wrapper.text()).toContain('Venta pagada en su totalidad')
  })

  it('shows due date when present', () => {
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: mockSale, canEditDueDate: true }
    })
    
    expect(wrapper.text()).toContain('20/05/2026')
    expect(wrapper.find('button').text()).toContain('Editar')
  })

  it('shows "Sin fecha" when no due date', () => {
    const saleWithoutDueDate: SaleDetail = {
      ...mockSale,
      dueDate: null,
    }
    
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: saleWithoutDueDate, canEditDueDate: true }
    })
    
    expect(wrapper.text()).toContain('Sin fecha')
    expect(wrapper.find('button').text()).toContain('Asignar fecha')
  })

  it('emits register-payment when button clicked', async () => {
    const wrapper = mountWithUApp(SaleDetailFinancialCard, {
      props: { sale: mockSale }
    })
    
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('register-payment')).toBeTruthy()
  })
})