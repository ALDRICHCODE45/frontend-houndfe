import { describe, expect, it } from 'vitest'
import { salesFiltersSchema } from '../salesFiltersSchema'

describe('salesFiltersSchema', () => {
  it('defines the expected sales filter ids and kinds', () => {
    const ids = salesFiltersSchema.map(field => field.id)

    expect(ids).toEqual([
      'folio',
      'status',
      'paymentStatus',
      'paymentMethod',
      'deliveryStatus',
      'customerId',
      'cashierUserId',
      'totalCents',
      'debtCents',
      'confirmedAt',
      'dueDate',
    ])
  })

  it('defines includeNull behavior for paymentMethod, customerId and dueDate', () => {
    const paymentMethod = salesFiltersSchema.find(field => field.id === 'paymentMethod')
    const customer = salesFiltersSchema.find(field => field.id === 'customerId')
    const dueDate = salesFiltersSchema.find(field => field.id === 'dueDate')

    expect(paymentMethod?.kind).toBe('multi-enum')
    if (paymentMethod?.kind === 'multi-enum') {
      expect(paymentMethod.includeNull).toEqual({ param: 'paymentMethodIncludeNull', label: 'Sin método' })
    }

    expect(customer?.kind).toBe('multi-async')
    if (customer?.kind === 'multi-async') {
      expect(customer.includeNull).toEqual({ param: 'customerIncludeNull', label: 'Público en General' })
    }

    expect(dueDate?.kind).toBe('date-range')
    if (dueDate?.kind === 'date-range') {
      expect(dueDate.includeNull).toEqual({ param: 'dueDateIncludeNull', label: 'Sin vencimiento' })
    }
  })
})
