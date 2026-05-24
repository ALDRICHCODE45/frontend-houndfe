import { describe, expect, it } from 'vitest'
import { createSalesFiltersSchema } from '../salesFiltersSchema'

describe('salesFiltersSchema', () => {
  it('defines the expected sales filter ids and kinds', () => {
    const salesFiltersSchema = createSalesFiltersSchema({ customerOptions: [], customerLoading: false, cashierOptions: [], cashierLoading: false })
    const ids = salesFiltersSchema.fields.map(field => field.id)

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
    const salesFiltersSchema = createSalesFiltersSchema({ customerOptions: [], customerLoading: false, cashierOptions: [], cashierLoading: false })
    const paymentMethod = salesFiltersSchema.fields.find(field => field.id === 'paymentMethod')
    const customer = salesFiltersSchema.fields.find(field => field.id === 'customerId')
    const dueDate = salesFiltersSchema.fields.find(field => field.id === 'dueDate')

    expect(paymentMethod?.kind).toBe('multi-enum')
    if (paymentMethod?.kind === 'multi-enum') {
      expect(paymentMethod.includeNull).toEqual({ param: 'paymentMethodIncludeNull', label: 'Sin método' })
    }

    expect(customer?.kind).toBe('multi-async')
    if (customer?.kind === 'multi-async') {
      expect(customer.includeNull).toEqual({ param: 'customerIncludeNull', label: 'Incluir Público en General' })
    }

    expect(dueDate?.kind).toBe('date-range')
    if (dueDate?.kind === 'date-range') {
      expect(dueDate.includeNull).toEqual({ param: 'dueDateIncludeNull', label: 'Incluir ventas sin vencimiento' })
    }
  })

  it('assigns sections for visual grouping in slideover', () => {
    const salesFiltersSchema = createSalesFiltersSchema({ customerOptions: [], customerLoading: false, cashierOptions: [], cashierLoading: false })
    const sections = Object.fromEntries(salesFiltersSchema.fields.map(field => [field.id, field.section]))

    expect(sections).toMatchObject({
      folio: undefined,
      status: 'Estado',
      paymentStatus: 'Estado',
      paymentMethod: 'Estado',
      deliveryStatus: 'Estado',
      customerId: 'Personas',
      cashierUserId: 'Personas',
      totalCents: 'Montos',
      debtCents: 'Montos',
      confirmedAt: 'Fechas',
      dueDate: 'Fechas',
    })
  })

  it('wires customer and cashier options from reactive sources', () => {
    const schema = createSalesFiltersSchema({
      customerOptions: [{ value: 'customer-1', label: 'Ada Lovelace' }],
      cashierOptions: [{ value: 'cashier-1', label: 'Grace Hopper' }],
      customerLoading: true,
      cashierLoading: true,
    })

    const customer = schema.fields.find(field => field.id === 'customerId')
    const cashier = schema.fields.find(field => field.id === 'cashierUserId')

    expect(customer?.kind).toBe('multi-async')
    if (customer?.kind === 'multi-async') {
      expect(customer.options).toEqual([{ value: 'customer-1', label: 'Ada Lovelace' }])
      expect(customer.loading).toBe(true)
    }

    expect(cashier?.kind).toBe('multi-async')
    if (cashier?.kind === 'multi-async') {
      expect(cashier.options).toEqual([{ value: 'cashier-1', label: 'Grace Hopper' }])
      expect(cashier.loading).toBe(true)
    }
  })
})
