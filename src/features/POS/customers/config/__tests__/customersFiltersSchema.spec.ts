import { describe, expect, it } from 'vitest'
import {
  CUSTOMERS_METRIC_FILTER_IDS,
  createCustomersFiltersSchema,
  type CustomersFilterSources,
} from '../customersFiltersSchema'

const sources: CustomersFilterSources = {
  canReadSales: true,
  priceListOptions: [{ value: '7d1c1a52-0000-4000-8000-000000000001', label: 'Mayoreo' }],
  priceListLoading: false,
  locationOptions: {
    neighborhood: [{ value: 'Del Valle', label: 'Del Valle (41)' }],
    municipality: [{ value: 'Monterrey', label: 'Monterrey (12)' }],
    city: [],
    zipCode: [],
    fiscalRegime: [{ value: '612', label: '612 - Personas Físicas' }],
  },
  locationLoading: false,
}

describe('createCustomersFiltersSchema — sections (artboard 01)', () => {
  it('groups the filters in Deuda, Compras, Mascotas, Ubicación and Comercial y contacto', () => {
    const schema = createCustomersFiltersSchema(sources)
    const bySection = new Map<string, string[]>()
    for (const field of schema.fields) {
      bySection.set(field.section!, [...(bySection.get(field.section!) ?? []), field.id])
    }
    expect([...bySection.keys()]).toEqual(['Deuda', 'Compras', 'Mascotas', 'Ubicación', 'Comercial y contacto'])
    expect(bySection.get('Deuda')).toEqual(['hasDebt', 'openDebt', 'hasOverdue', 'overdueMoreThanDays', 'oldestOverdue'])
    expect(bySection.get('Compras')).toEqual([
      'totalSold',
      'salesCount',
      'averageTicket',
      'lastPurchase',
      'noPurchaseMoreThanDays',
      'created',
    ])
    expect(bySection.get('Mascotas')).toEqual(['petSpecies', 'petSize', 'activePets', 'hasPets'])
    expect(bySection.get('Ubicación')).toEqual(['neighborhood', 'municipality', 'city', 'zipCode', 'deliveryZoneType'])
    expect(bySection.get('Comercial y contacto')).toEqual([
      'priceListId',
      'isTrusted',
      'hasRfc',
      'fiscalRegime',
      'hasEmail',
      'hasPhone',
      'hasChatbotRequests',
    ])
  })

  it('takes the pet sizes and species from the pets module values', () => {
    const schema = createCustomersFiltersSchema(sources)
    const values = (id: string) => {
      const field = schema.byId[id]!
      return 'options' in field ? field.options.map((option) => option.value) : []
    }
    expect(values('petSpecies')).toEqual(['DOG', 'CAT', 'OTHER'])
    expect(values('petSize')).toEqual(['SMALL', 'MEDIUM', 'LARGE', 'GIANT'])
    expect(values('deliveryZoneType')).toEqual(['FREE', 'SURCHARGE', 'CARRIER_ONLY', 'DENIED'])
  })
})

describe('createCustomersFiltersSchema — filters → query params (handoff 32 §2.3)', () => {
  it('maps every filter to its backend param: money in cents, booleans, CSV multi, days and dates', () => {
    const schema = createCustomersFiltersSchema(sources)
    const state = {
      ...schema.defaults(),
      hasDebt: ['true'],
      // Money ranges hold cents: the shared NumericRangeFilter shows pesos (formatAs currency → ÷100).
      openDebt: { min: 150000, max: 900050 },
      hasOverdue: ['false'],
      overdueMoreThanDays: ['60'],
      oldestOverdue: { from: '2026-10-01T06:00:00.000Z', to: '2026-10-31T05:59:59.999Z' },
      totalSold: { min: 1000000 },
      salesCount: { min: 3, max: 10 },
      averageTicket: { max: 50000 },
      lastPurchase: { from: '2026-11-01T06:00:00.000Z' },
      noPurchaseMoreThanDays: ['90'],
      created: { to: '2026-11-26T05:59:59.999Z' },
      petSpecies: ['DOG', 'CAT'],
      petSize: ['LARGE'],
      activePets: { min: 1 },
      hasPets: ['true'],
      neighborhood: ['Del Valle', 'Narvarte'],
      municipality: ['Monterrey'],
      city: ['Ciudad de México'],
      zipCode: ['03100'],
      deliveryZoneType: ['FREE'],
      deliveryZoneNone: true,
      priceListId: ['7d1c1a52-0000-4000-8000-000000000001'],
      priceListIncludeNull: true,
      isTrusted: ['true'],
      hasRfc: ['false'],
      fiscalRegime: ['612', '601'],
      hasEmail: ['false'],
      hasPhone: ['true'],
      hasChatbotRequests: ['true'],
    }

    expect(schema.serialize(state)).toEqual({
      hasDebt: 'true',
      openDebtMin: '150000',
      openDebtMax: '900050',
      hasOverdue: 'false',
      overdueMoreThanDays: '60',
      oldestOverdueFrom: '2026-10-01T06:00:00.000Z',
      oldestOverdueTo: '2026-10-31T05:59:59.999Z',
      totalSoldMin: '1000000',
      salesCountMin: '3',
      salesCountMax: '10',
      averageTicketMax: '50000',
      lastPurchaseFrom: '2026-11-01T06:00:00.000Z',
      noPurchaseMoreThanDays: '90',
      createdTo: '2026-11-26T05:59:59.999Z',
      petSpecies: 'DOG,CAT',
      petSize: 'LARGE',
      activePetsMin: '1',
      hasPets: 'true',
      neighborhood: 'Del Valle,Narvarte',
      municipality: 'Monterrey',
      city: 'Ciudad de México',
      zipCode: '03100',
      deliveryZoneType: 'FREE',
      deliveryZoneNone: 'true',
      priceListId: '7d1c1a52-0000-4000-8000-000000000001',
      priceListIncludeNull: 'true',
      isTrusted: 'true',
      hasRfc: 'false',
      fiscalRegime: '612,601',
      hasEmail: 'false',
      hasPhone: 'true',
      hasChatbotRequests: 'true',
    })
  })

  it('shows money ranges as pesos: currency fields, and pesos in the chip', () => {
    const schema = createCustomersFiltersSchema(sources)
    for (const id of ['openDebt', 'totalSold', 'averageTicket']) {
      expect(schema.byId[id]).toMatchObject({ kind: 'numeric-range', formatAs: 'currency' })
    }
    for (const id of ['salesCount', 'activePets']) {
      expect(schema.byId[id]).toMatchObject({ kind: 'numeric-range', formatAs: 'plain' })
    }
    const chips = schema.activeChips({ ...schema.defaults(), openDebt: { min: 150000 } })
    expect(chips).toEqual([{ filterId: 'openDebt', label: 'Monto de deuda', displayValue: 'Desde $1,500' }])
  })

  it('sends «Sin zona» and «Sin lista» alone (deliveryZoneNone / priceListIncludeNull)', () => {
    const schema = createCustomersFiltersSchema(sources)
    expect(
      schema.serialize({ ...schema.defaults(), deliveryZoneNone: true, priceListIncludeNull: true }),
    ).toEqual({ deliveryZoneNone: 'true', priceListIncludeNull: 'true' })
  })

  it('round-trips the URL query (URL sync)', () => {
    const schema = createCustomersFiltersSchema(sources)
    const query = {
      hasOverdue: 'true',
      openDebtMin: '150000',
      petSpecies: 'DOG,CAT',
      deliveryZoneNone: 'true',
      noPurchaseMoreThanDays: '30',
      createdFrom: '2026-11-01T06:00:00.000Z',
    }
    const state = schema.deserialize(query)
    expect(state).toMatchObject({
      hasOverdue: ['true'],
      openDebt: { min: 150000 },
      petSpecies: ['DOG', 'CAT'],
      deliveryZoneNone: true,
      noPurchaseMoreThanDays: ['30'],
      created: { from: '2026-11-01T06:00:00.000Z' },
    })
    expect(schema.serialize(state)).toEqual(query)
  })

  it('sends nothing with no filter', () => {
    const schema = createCustomersFiltersSchema(sources)
    expect(schema.serialize(schema.defaults())).toEqual({})
  })
})

describe('createCustomersFiltersSchema — without read:Sale', () => {
  it('has no money or purchase filter, so it never sends a metric param', () => {
    const schema = createCustomersFiltersSchema({ ...sources, canReadSales: false })
    const ids = schema.fields.map((field) => field.id)
    for (const id of CUSTOMERS_METRIC_FILTER_IDS) expect(ids).not.toContain(id)
    expect(ids).toContain('created')
    expect(ids).toContain('petSpecies')
    expect([...new Set(schema.fields.map((field) => field.section))]).toEqual([
      'Compras',
      'Mascotas',
      'Ubicación',
      'Comercial y contacto',
    ])
    // A stale URL with metric params reads back as no filter at all.
    const state = schema.deserialize({ hasDebt: 'true', openDebtMin: '100', noPurchaseMoreThanDays: '90' })
    expect(schema.serialize(state)).toEqual({})
  })
})
