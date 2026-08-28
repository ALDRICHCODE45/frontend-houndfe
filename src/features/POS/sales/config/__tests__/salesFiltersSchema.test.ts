import { describe, expect, it } from 'vitest'
import { createSalesFiltersSchema } from '../salesFiltersSchema'
import { SALE_DELIVERY_STATUS } from '../../constants/sale.constants'

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

  // ─── pos-sale-delivery S3 — CAP-DLV-3 (deliveryStatus filter completeness) ─────
  describe('deliveryStatus filter options (delivery-routes S1a — 3 options)', () => {
    it('deliveryStatus exposes exactly three options with the backend-lifecycle order', () => {
      const schema = createSalesFiltersSchema({
        customerOptions: [], customerLoading: false, cashierOptions: [], cashierLoading: false,
      })
      const deliveryStatus = schema.fields.find(field => field.id === 'deliveryStatus')
      expect(deliveryStatus?.kind).toBe('multi-enum')
      if (deliveryStatus?.kind !== 'multi-enum') throw new Error('deliveryStatus must be a multi-enum field')
      if (deliveryStatus.param !== 'deliveryStatus') throw new Error('deliveryStatus param drift')

          // delivery-routes S1a: NOT_APPLICABLE (take-away / instant delivery) is
          // intentionally excluded — it has nothing to do with route logistics.
          expect(deliveryStatus.options).toEqual([
        { value: SALE_DELIVERY_STATUS.PENDING, label: 'Pendiente' },
            { value: SALE_DELIVERY_STATUS.SHIPPED, label: 'Enviada' },
        { value: SALE_DELIVERY_STATUS.DELIVERED, label: 'Entregada' },
      ])
    })

    it('schema still defines exactly 11 fields across 4 sections (REQ-19 invariant)', () => {
      const schema = createSalesFiltersSchema({
        customerOptions: [], customerLoading: false, cashierOptions: [], cashierLoading: false,
      })

      // REQ-19 invariant: option-array expansion on deliveryStatus MUST NOT change
      // the total field count or section layout.
      expect(schema.fields).toHaveLength(11)

      const sectionCounts = schema.fields.reduce<Record<string, number>>((acc, field) => {
        const section = field.section ?? '__none__'
        acc[section] = (acc[section] ?? 0) + 1
        return acc
      }, {})
      expect(sectionCounts).toEqual({
        __none__: 1, // folio (no section)
        Estado: 4, // status + paymentStatus + paymentMethod + deliveryStatus
        Personas: 2, // customerId + cashierUserId
        Montos: 2, // totalCents + debtCents
        Fechas: 2, // confirmedAt + dueDate
      })
    })

    it('deliveryStatus serializes a multi-select to the CSV param contract', () => {
      // CAP-DLV-3 triangulation: the existing `param: 'deliveryStatus'` CSV contract
      // MUST be preserved (OR-within-filter semantics for backend).
      const schema = createSalesFiltersSchema({
        customerOptions: [], customerLoading: false, cashierOptions: [], cashierLoading: false,
      })

      const state = schema.defaults()
          state.deliveryStatus = [SALE_DELIVERY_STATUS.PENDING, SALE_DELIVERY_STATUS.SHIPPED]
      const query = schema.serialize(state)

      // The CSV is order-dependent — the implementation builds it via .join(',') on
      // the selected array, so we accept either valid permutation.
      expect(query.deliveryStatus).toBeOneOf([
            `${SALE_DELIVERY_STATUS.PENDING},${SALE_DELIVERY_STATUS.SHIPPED}`,
            `${SALE_DELIVERY_STATUS.SHIPPED},${SALE_DELIVERY_STATUS.PENDING}`,
      ])
    })
  })
})
