import { describe, expect, it } from 'vitest'
import {
  SALE_ADDRESS_SOURCE_MESSAGES,
  saleAddressSourceMessage,
  saleAddressSourceNotice,
} from '../saleAddressSource'

// odd/tasks/sale-address-change-notice.md S2/S4: the backend reports how the customer address
// compares with the sale's snapshot; a label-only change is a nickname and reads as unchanged.

describe('saleAddressSourceNotice', () => {
  it('CHANGED with a delivery field reads as changed', () => {
    expect(saleAddressSourceNotice({ sourceStatus: 'CHANGED', changedFields: ['street'] })).toBe('CHANGED')
    expect(saleAddressSourceNotice({ sourceStatus: 'CHANGED', changedFields: ['label', 'latitude'] })).toBe('CHANGED')
  })

  it('CHANGED with only the label, or with no fields, reads as unchanged', () => {
    expect(saleAddressSourceNotice({ sourceStatus: 'CHANGED', changedFields: ['label'] })).toBeNull()
    expect(saleAddressSourceNotice({ sourceStatus: 'CHANGED', changedFields: [] })).toBeNull()
  })

  it('CHANGED without a changedFields list still warns (no evidence it was only the label)', () => {
    expect(saleAddressSourceNotice({ sourceStatus: 'CHANGED' })).toBe('CHANGED')
  })

  it('DELETED reads as deleted', () => {
    expect(saleAddressSourceNotice({ sourceStatus: 'DELETED', changedFields: [] })).toBe('DELETED')
  })

  it('UNCHANGED, a missing status and a missing address read as nothing', () => {
    expect(saleAddressSourceNotice({ sourceStatus: 'UNCHANGED', changedFields: [] })).toBeNull()
    expect(saleAddressSourceNotice({})).toBeNull()
    expect(saleAddressSourceNotice({ sourceStatus: null, changedFields: null })).toBeNull()
    expect(saleAddressSourceNotice(null)).toBeNull()
    expect(saleAddressSourceNotice(undefined)).toBeNull()
  })
})

describe('saleAddressSourceMessage', () => {
  it('uses the agreed copy', () => {
    expect(SALE_ADDRESS_SOURCE_MESSAGES).toEqual({
      CHANGED: 'El cliente cambió esta dirección después de la venta.',
      DELETED: 'El cliente eliminó esta dirección después de la venta.',
    })
    expect(saleAddressSourceMessage({ sourceStatus: 'CHANGED', changedFields: ['street'] })).toBe(
      'El cliente cambió esta dirección después de la venta.',
    )
    expect(saleAddressSourceMessage({ sourceStatus: 'DELETED', changedFields: [] })).toBe(
      'El cliente eliminó esta dirección después de la venta.',
    )
  })

  it('is null when there is nothing to say', () => {
    expect(saleAddressSourceMessage({ sourceStatus: 'CHANGED', changedFields: ['label'] })).toBeNull()
    expect(saleAddressSourceMessage({ sourceStatus: 'UNCHANGED', changedFields: [] })).toBeNull()
    expect(saleAddressSourceMessage(null)).toBeNull()
  })
})
