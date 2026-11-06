import { describe, expect, it } from 'vitest'
import {
  buildResolveDecision,
  buildZoneUpsertBody,
  draftFromZone,
  emptyZoneDraft,
  formatEtaDays,
  validateZoneDraft,
  zoneTypeUses,
  type ZoneDraft,
} from '../zoneForm'

const draft = (patch: Partial<ZoneDraft>): ZoneDraft => ({ ...emptyZoneDraft(), zipCode: '06700', ...patch })

describe('zone form by type (handoff §2 table)', () => {
  it('uses the surcharge only for SURCHARGE and the days only for FREE and SURCHARGE', () => {
    expect(zoneTypeUses('FREE')).toEqual({ surcharge: false, eta: true })
    expect(zoneTypeUses('SURCHARGE')).toEqual({ surcharge: true, eta: true })
    expect(zoneTypeUses('CARRIER_ONLY')).toEqual({ surcharge: false, eta: false })
    expect(zoneTypeUses('DENIED')).toEqual({ surcharge: false, eta: false })
  })

  it('sends null for the fields the type does not use, even if the draft kept a value', () => {
    const body = buildZoneUpsertBody(draft({ type: 'CARRIER_ONLY', surchargeCents: 4500, etaDays: '3' }))
    expect(body).toEqual({ type: 'CARRIER_ONLY', surchargeCents: null, etaDays: null, state: null, municipality: null, neighborhood: null })
    expect(buildZoneUpsertBody(draft({ type: 'FREE', surchargeCents: 4500, etaDays: '0' }))).toMatchObject({ surchargeCents: null, etaDays: 0 })
  })

  it('sends the surcharge in cents (typed in pesos by the money field) and the days as an integer', () => {
    expect(buildZoneUpsertBody(draft({ type: 'SURCHARGE', surchargeCents: 4500, etaDays: '2' }))).toMatchObject({ type: 'SURCHARGE', surchargeCents: 4500, etaDays: 2 })
  })

  it('always sends the three labels, trimmed, with empty ones as null', () => {
    const body = buildZoneUpsertBody(draft({ type: 'DENIED', state: ' Ciudad de México ', municipality: '', neighborhood: '  Roma Norte' }))
    expect(body).toEqual(expect.objectContaining({ state: 'Ciudad de México', municipality: null, neighborhood: 'Roma Norte' }))
    expect(Object.keys(body).sort()).toEqual(['etaDays', 'municipality', 'neighborhood', 'state', 'surchargeCents', 'type'])
  })

  it('round-trips a saved zone into the draft', () => {
    const zone = { zipCode: '04000', type: 'SURCHARGE' as const, surchargeCents: 6900, etaDays: 2, state: 'Ciudad de México', municipality: 'Coyoacán', neighborhood: null }
    expect(draftFromZone(zone)).toEqual({ zipCode: '04000', type: 'SURCHARGE', surchargeCents: 6900, etaDays: '2', state: 'Ciudad de México', municipality: 'Coyoacán', neighborhood: '' })
  })
})

describe('zone form validation (Spanish, next to the field)', () => {
  it('asks for a five-digit postal code', () => {
    expect(validateZoneDraft(draft({ type: 'DENIED', zipCode: '6700' })).zipCode).toBe('Escribe un código postal de 5 dígitos.')
    expect(validateZoneDraft(draft({ type: 'DENIED', zipCode: '06a00' })).zipCode).toBeDefined()
    expect(validateZoneDraft(draft({ type: 'DENIED' }))).toEqual({})
  })

  it('requires a surcharge above $0.00 for SURCHARGE and ignores it otherwise', () => {
    expect(validateZoneDraft(draft({ type: 'SURCHARGE', surchargeCents: null, etaDays: '2' })).surchargeCents).toBe('Escribe un cargo mayor a $0.00.')
    expect(validateZoneDraft(draft({ type: 'SURCHARGE', surchargeCents: 0, etaDays: '2' })).surchargeCents).toBeDefined()
    expect(validateZoneDraft(draft({ type: 'FREE', surchargeCents: null, etaDays: '1' }))).toEqual({})
  })

  it('requires whole days from 0 to 60 for FREE and SURCHARGE only', () => {
    expect(validateZoneDraft(draft({ type: 'FREE', etaDays: '' })).etaDays).toBe('Escribe de 0 a 60 días.')
    expect(validateZoneDraft(draft({ type: 'FREE', etaDays: '61' })).etaDays).toBeDefined()
    expect(validateZoneDraft(draft({ type: 'FREE', etaDays: '1.5' })).etaDays).toBeDefined()
    expect(validateZoneDraft(draft({ type: 'FREE', etaDays: '0' }))).toEqual({})
    expect(validateZoneDraft(draft({ type: 'CARRIER_ONLY', etaDays: '' }))).toEqual({})
  })

  it('caps the labels at 120 characters', () => {
    expect(validateZoneDraft(draft({ type: 'DENIED', neighborhood: 'x'.repeat(121) })).neighborhood).toBe('Máximo 120 caracteres.')
  })
})

describe('resolve decision (handoff §3.4)', () => {
  it('approves with the type and only the fields it uses', () => {
    expect(buildResolveDecision({ choice: 'SURCHARGE', surchargeCents: 4500, etaDays: '2' })).toEqual({ action: 'APPROVE_DELIVERY_ZONE', zoneType: 'SURCHARGE', surchargeCents: 4500, etaDays: 2 })
    expect(buildResolveDecision({ choice: 'CARRIER_ONLY', surchargeCents: 4500, etaDays: '2' })).toEqual({ action: 'APPROVE_DELIVERY_ZONE', zoneType: 'CARRIER_ONLY', surchargeCents: null, etaDays: null })
  })

  it('rejects with no type, surcharge or days', () => {
    expect(buildResolveDecision({ choice: 'REJECT', surchargeCents: 4500, etaDays: '2' })).toEqual({ action: 'REJECT_DELIVERY_ZONE' })
  })
})

describe('delivery days label', () => {
  it('reads same day, singular and plural, and a dash when absent', () => {
    expect(formatEtaDays(0)).toBe('Mismo día')
    expect(formatEtaDays(1)).toBe('1 día')
    expect(formatEtaDays(3)).toBe('3 días')
    expect(formatEtaDays(null)).toBe('—')
  })
})
