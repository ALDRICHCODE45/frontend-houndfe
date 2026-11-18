import { describe, expect, it } from 'vitest'
import { saleCancelReasonLabel, saleCanceledByLabel } from '../saleCancellation.utils'

// BE handoff 24 §4: HOLD_EXPIRED is cancelled by the system (canceledBy null → «Sistema»).
describe('saleCancelReasonLabel', () => {
  it.each([
    ['CUSTOMER_REQUEST', 'Solicitud del cliente'],
    ['ORDER_ERROR', 'Error en el pedido'],
    ['OUT_OF_STOCK', 'Sin existencias'],
    ['DUPLICATE_SALE', 'Venta duplicada'],
    ['OTHER', 'Otro'],
    ['HOLD_EXPIRED', 'Apartado vencido (no se pagó a tiempo)'],
  ] as const)('%s → %s', (reason, label) => {
    expect(saleCancelReasonLabel(reason)).toBe(label)
  })
})

describe('saleCanceledByLabel', () => {
  it('names the person who cancelled', () => {
    expect(saleCanceledByLabel({ cancelReason: 'CUSTOMER_REQUEST', canceledBy: { id: 'u', name: 'Ana' } })).toBe('Ana')
  })

  it('says «Sistema» for the deadline sweep', () => {
    expect(saleCanceledByLabel({ cancelReason: 'HOLD_EXPIRED', canceledBy: null })).toBe('Sistema')
    expect(saleCanceledByLabel({ cancelReason: 'HOLD_EXPIRED' })).toBe('Sistema')
  })

  it('stays silent for a staff cancellation whose user no longer exists', () => {
    expect(saleCanceledByLabel({ cancelReason: 'CUSTOMER_REQUEST', canceledBy: null })).toBeNull()
    expect(saleCanceledByLabel({ cancelReason: null, canceledBy: null })).toBeNull()
  })
})
