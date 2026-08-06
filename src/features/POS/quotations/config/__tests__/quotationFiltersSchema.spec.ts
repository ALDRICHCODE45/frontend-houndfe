/**
 * REQ-QAF-015 / T-FE-03 — `quotationFiltersSchema` schema round-trip.
 *
 * The schema is the source of truth for the slideover's filter inputs and the
 * URL state. This spec asserts:
 *   - The 5 fields are wired with the right kinds (multi-enum, multi-async,
 *     date-range × 2, numeric-range).
 *   - Section grouping matches design.md (Estado / Personas / Fechas / Montos).
 *   - Seriliaze → deserialize round-trip is canonical-stable.
 *   - Active chips reflect active multi-value filters.
 *   - The customer async field reuses the live `customerOptions` & `loading`.
 *   - The numeric-range field uses `formatAs: 'currency'` with step 100 (the
 *     same per-cents step pattern as sales).
 */

import { describe, expect, it } from 'vitest'
import { createQuotationFiltersSchema } from '../quotationFiltersSchema'
import { QUOTATION_STATUS } from '../../constants/quotation.constants'
import type { FilterOption } from '@/core/shared/data-table-filters'

const customerOptions: FilterOption[] = [
  { value: 'cust-1', label: 'Juan Pérez' },
  { value: 'cust-2', label: 'María López' },
]

function makeSchema() {
  return createQuotationFiltersSchema({
    customerOptions,
    customerLoading: false,
  })
}

describe('createQuotationFiltersSchema — field shape', () => {
  it('defines the five expected filters in order', () => {
    const schema = makeSchema()
    const ids = schema.fields.map(field => field.id)

    expect(ids).toEqual([
      'status',
      'customerId',
      'createdAt',
      'expiresAt',
      'totalCents',
    ])
  })

  it('assigns sections for visual grouping in the slideover', () => {
    const schema = makeSchema()
    const sections = Object.fromEntries(schema.fields.map(field => [field.id, field.section]))

    expect(sections).toMatchObject({
      status: 'Estado',
      customerId: 'Personas',
      createdAt: 'Fechas',
      expiresAt: 'Fechas',
      totalCents: 'Montos',
    })
  })

  it('uses multi-enum for status with the four backend status values', () => {
    const schema = makeSchema()
    const status = schema.byId.status

    expect(status?.kind).toBe('multi-enum')
    if (status?.kind === 'multi-enum') {
      expect(status.param).toBe('status')
      expect(status.options.map(o => o.value)).toEqual([
        QUOTATION_STATUS.DRAFT,
        QUOTATION_STATUS.SENT,
        QUOTATION_STATUS.EXPIRED,
        QUOTATION_STATUS.CANCELLED,
      ])
    }
  })

  it('uses multi-async for customerId bound to the live options', () => {
    const schema = makeSchema()
    const customer = schema.byId.customerId

    expect(customer?.kind).toBe('multi-async')
    if (customer?.kind === 'multi-async') {
      expect(customer.param).toBe('customerId')
      expect(customer.options).toEqual(customerOptions)
      expect(customer.loading).toBe(false)
    }
  })

  it('uses date-range for createdAt with createdFrom/createdTo params', () => {
    const schema = makeSchema()
    const createdAt = schema.byId.createdAt

    expect(createdAt?.kind).toBe('date-range')
    if (createdAt?.kind === 'date-range') {
      expect(createdAt.fromParam).toBe('createdFrom')
      expect(createdAt.toParam).toBe('createdTo')
    }
  })

  it('uses date-range for expiresAt with expiresFrom/expiresTo params', () => {
    const schema = makeSchema()
    const expiresAt = schema.byId.expiresAt

    expect(expiresAt?.kind).toBe('date-range')
    if (expiresAt?.kind === 'date-range') {
      expect(expiresAt.fromParam).toBe('expiresFrom')
      expect(expiresAt.toParam).toBe('expiresTo')
    }
  })

  it('uses numeric-range for totalCents with currency step 100', () => {
    const schema = makeSchema()
    const totalCents = schema.byId.totalCents

    expect(totalCents?.kind).toBe('numeric-range')
    if (totalCents?.kind === 'numeric-range') {
      expect(totalCents.minParam).toBe('minTotalCents')
      expect(totalCents.maxParam).toBe('maxTotalCents')
      expect(totalCents.formatAs).toBe('currency')
      expect(totalCents.step).toBe(100)
    }
  })

  it('reuses the live customerOptions + customerLoading when re-instantiated', () => {
    const schema = createQuotationFiltersSchema({
      customerOptions: [{ value: 'cust-only', label: 'Solo Cliente' }],
      customerLoading: true,
    })
    const customer = schema.byId.customerId

    if (customer?.kind === 'multi-async') {
      expect(customer.options).toEqual([{ value: 'cust-only', label: 'Solo Cliente' }])
      expect(customer.loading).toBe(true)
    }
  })
})

describe('createQuotationFiltersSchema — serialize round-trip', () => {
  it('serializes a multi-status selection as a CSV string', () => {
    const schema = makeSchema()
    const state = schema.defaults()
    state.status = ['DRAFT', 'SENT']

    const serialized = schema.serialize(state)

    expect(serialized.status).toBe('DRAFT,SENT')
  })

  it('serializes a date-range as ISO strings', () => {
    const schema = makeSchema()
    const state = schema.defaults()
    state.expiresAt = { from: '2026-01-01', to: '2026-01-31' }

    const serialized = schema.serialize(state)

    expect(serialized.expiresFrom).toBe('2026-01-01')
    expect(serialized.expiresTo).toBe('2026-01-31')
  })

  it('serializes a numeric range as integer strings (cents)', () => {
    const schema = makeSchema()
    const state = schema.defaults()
    state.totalCents = { min: 1000, max: 50000 }

    const serialized = schema.serialize(state)

    expect(serialized.minTotalCents).toBe('1000')
    expect(serialized.maxTotalCents).toBe('50000')
  })

  it('omits empty filters from the serialized query', () => {
    const schema = makeSchema()
    const state = schema.defaults()

    const serialized = schema.serialize(state)

    expect('status' in serialized).toBe(false)
    expect('customerId' in serialized).toBe(false)
    expect('expiresFrom' in serialized).toBe(false)
    expect('expiresTo' in serialized).toBe(false)
    expect('minTotalCents' in serialized).toBe(false)
    expect('maxTotalCents' in serialized).toBe(false)
  })

  it('round-trips status + date + numeric-range fields', () => {
    const schema = makeSchema()
    const original = schema.defaults()
    original.status = ['DRAFT', 'SENT']
    original.expiresAt = { from: '2026-01-01', to: '2026-01-31' }
    original.totalCents = { min: 1000, max: 50000 }

    const serialized = schema.serialize(original)
    const deserialized = schema.deserialize(serialized)

    expect(deserialized.status).toEqual(['DRAFT', 'SENT'])
    expect(deserialized.expiresAt).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(deserialized.totalCents).toEqual({ min: 1000, max: 50000 })
  })
})

describe('createQuotationFiltersSchema — active chips', () => {
  it('reports an empty chip list when no filters are active', () => {
    const schema = makeSchema()
    const chips = schema.activeChips(schema.defaults())
    expect(chips).toEqual([])
  })

  it('emits one chip per active filter with the contract labels', () => {
    const schema = makeSchema()
    const state = schema.defaults()
    state.status = ['DRAFT', 'SENT']
    state.expiresAt = { from: '2026-01-01', to: '2026-01-31' }

    const chips = schema.activeChips(state)
    const ids = chips.map(chip => chip.filterId)

    expect(ids).toEqual(expect.arrayContaining(['status', 'expiresAt']))
    expect(chips).toHaveLength(2)
  })

  it('marks a status chip as active when the field has at least one value', () => {
    const schema = makeSchema()
    const state = schema.defaults()
    state.status = ['DRAFT']

    expect(schema.isActive('status', state)).toBe(true)
  })

  it('marks a totalCents chip as active when min OR max is set', () => {
    const schema = makeSchema()
    const state = schema.defaults()
    state.totalCents = { min: 1000 }

    expect(schema.isActive('totalCents', state)).toBe(true)
  })
})
