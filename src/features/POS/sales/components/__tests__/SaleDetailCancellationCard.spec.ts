import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleDetail } from '../../interfaces/sale.types'
import SaleDetailCancellationCard from '../SaleDetailCancellationCard.vue'

// BE handoff 24 §4: a HOLD_EXPIRED sale was cancelled by the system (canceledBy null → «Sistema»).
function sale(over: Partial<SaleDetail>): SaleDetail {
  return {
    status: 'CANCELED',
    canceledAt: '2026-11-19T18:30:00.000Z',
    cancelReason: 'CUSTOMER_REQUEST',
    canceledBy: { id: 'u1', name: 'Ana' },
    ...over,
  } as SaleDetail
}

describe('SaleDetailCancellationCard', () => {
  it('labels HOLD_EXPIRED and names the system as the canceller', () => {
    const wrapper = mountWithUApp(SaleDetailCancellationCard, {
      props: { sale: sale({ cancelReason: 'HOLD_EXPIRED', canceledBy: null }) },
    })
    expect(wrapper.text()).toContain('Apartado vencido (no se pagó a tiempo)')
    expect(wrapper.get('.sale-detail-cancel-by').text()).toBe('Cancelada por Sistema')
  })

  it('keeps the staff reason and the person', () => {
    const wrapper = mountWithUApp(SaleDetailCancellationCard, { props: { sale: sale({}) } })
    expect(wrapper.text()).toContain('Solicitud del cliente')
    expect(wrapper.get('.sale-detail-cancel-by').text()).toBe('Cancelada por Ana')
  })

  it('shows no canceller when a staff cancellation lost its user', () => {
    const wrapper = mountWithUApp(SaleDetailCancellationCard, { props: { sale: sale({ canceledBy: null }) } })
    expect(wrapper.find('.sale-detail-cancel-by').exists()).toBe(false)
  })
})
