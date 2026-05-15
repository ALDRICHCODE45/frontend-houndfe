import { describe, expect, it } from 'vitest'
import type { Sale } from '../sale.types'

describe('sale draft customer assignment types', () => {
  it('supports assigned customer and shipping address', () => {
    const sale: Sale = {
      id: 'sale-1',
      userId: 'user-1',
      status: 'DRAFT',
      items: [],
      customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
      shippingAddress: {
        id: 'address-1',
        customerId: 'customer-1',
        street: 'Main',
        exteriorNumber: '10',
        interiorNumber: null,
        zipCode: '64000',
        neighborhood: 'Centro',
        municipality: 'Monterrey',
        city: 'Monterrey',
        state: 'Nuevo León',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    expect(sale.customer?.firstName).toBe('Ada')
    expect(sale.shippingAddress?.street).toBe('Main')
  })

  it('supports null customer and shipping address', () => {
    const sale: Sale = {
      id: 'sale-2',
      userId: 'user-2',
      status: 'DRAFT',
      items: [],
      customer: null,
      shippingAddress: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    expect(sale.customer).toBeNull()
    expect(sale.shippingAddress).toBeNull()
  })
})
