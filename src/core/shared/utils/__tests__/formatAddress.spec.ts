import { describe, expect, it } from 'vitest'
import { formatAddress, type AddressFormatInput } from '@/core/shared/utils/formatAddress'

describe('formatAddress', () => {
  it('renders the full label-first ordering (REQ-AMP-008)', () => {
    expect(
      formatAddress({
        label: 'Casa',
        street: 'Av. Reforma',
        exteriorNumber: '123',
        interiorNumber: '4B',
        neighborhood: 'Centro',
        municipality: 'Cuauhtémoc',
        city: 'CDMX',
        state: 'CDMX',
        zipCode: '06000',
      }),
    ).toBe('Casa, Av. Reforma #123 Int. 4B, Centro, Cuauhtémoc, CDMX, CDMX, CP 06000')
  })

  it('drops the label when absent', () => {
    expect(
      formatAddress({
        street: 'Av. Reforma',
        exteriorNumber: '123',
        city: 'CDMX',
        state: 'CDMX',
        zipCode: '06000',
      }),
    ).toBe('Av. Reforma #123, CDMX, CDMX, CP 06000')
  })

  it('returns an empty string when every field is null', () => {
    expect(
      formatAddress({
        label: null,
        street: null,
        exteriorNumber: null,
        interiorNumber: null,
        neighborhood: null,
        municipality: null,
        city: null,
        state: null,
        zipCode: null,
      }),
    ).toBe('')
  })

  it('returns an empty string for an empty input object', () => {
    expect(formatAddress({})).toBe('')
  })

  it('drops whitespace-only and empty-string fields', () => {
    expect(
      formatAddress({
        label: '   ',
        street: 'Av. Reforma',
        exteriorNumber: '',
        interiorNumber: null,
        zipCode: '06000',
      }),
    ).toBe('Av. Reforma, CP 06000')
  })

  it('trims each retained segment', () => {
    expect(
      formatAddress({
        label: '  Oficina  ',
        street: '  Insurgentes Sur  ',
        exteriorNumber: ' 1602 ',
        interiorNumber: ' 3 ',
        city: '  CDMX  ',
        zipCode: '  03940  ',
      }),
    ).toBe('Oficina, Insurgentes Sur #1602 Int. 3, CDMX, CP 03940')
  })

  it('renders exterior number without a street', () => {
    expect(formatAddress({ exteriorNumber: '123', city: 'CDMX' })).toBe('#123, CDMX')
  })

  it('renders interior number without an exterior number', () => {
    expect(formatAddress({ street: 'Av. Reforma', interiorNumber: '4B' })).toBe(
      'Av. Reforma Int. 4B',
    )
  })

  it('renders the label alone when nothing else is present', () => {
    expect(formatAddress({ label: 'Bodega' })).toBe('Bodega')
  })

  it('renders CP alone when only the zip code is present', () => {
    expect(formatAddress({ zipCode: '06000' })).toBe('CP 06000')
  })

  it('collapses the locality group into one comma-joined segment', () => {
    expect(
      formatAddress({ neighborhood: 'Centro', municipality: null, city: 'CDMX', state: 'CDMX' }),
    ).toBe('Centro, CDMX, CDMX')
  })

  it('accepts a superset input (extra fields do not break the contract)', () => {
    const stopProjection = {
      id: 'addr-1',
      label: 'Casa',
      street: 'Av. Reforma',
      exteriorNumber: '123',
      interiorNumber: null,
      neighborhood: null,
      municipality: null,
      city: 'CDMX',
      state: null,
      zipCode: '06000',
      latitude: 19.43,
      longitude: -99.13,
    }
    const input: AddressFormatInput = stopProjection
    expect(formatAddress(input)).toBe('Casa, Av. Reforma #123, CDMX, CP 06000')
  })

  it('pins the CustomerUpsertSlideover regression output (REQ-AMP-009)', () => {
    expect(
      formatAddress({
        label: 'Oficina',
        street: 'Insurgentes Sur',
        exteriorNumber: '1602',
        city: 'CDMX',
        zipCode: '03940',
      }),
    ).toBe('Oficina, Insurgentes Sur #1602, CDMX, CP 03940')
  })

  it('pins the AssignCustomerSlideover regression output (REQ-AMP-010)', () => {
    expect(
      formatAddress({
        label: 'Casa',
        street: 'Av. Reforma',
        exteriorNumber: '123',
        city: 'CDMX',
        zipCode: '06000',
      }),
    ).toBe('Casa, Av. Reforma #123, CDMX, CP 06000')
  })
})
