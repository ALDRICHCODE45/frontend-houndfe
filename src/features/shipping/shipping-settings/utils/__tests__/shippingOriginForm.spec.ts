import { describe, expect, it } from 'vitest'
import {
  draftToOriginBody,
  mapOriginError,
  originToDraft,
  validateOriginDraft,
} from '../shippingOriginForm'

const origin = {
  addressLine1: 'Av. Insurgentes Sur 1458',
  addressLine2: 'Local 3, planta baja',
  neighborhood: 'Del Valle Centro',
  municipality: 'Benito Juárez',
  state: 'Ciudad de México',
  postalCode: '03100',
  contactPhone: '5555432100',
  updatedAt: 'x',
}

describe('shippingOriginForm — draft and body (handoff §6)', () => {
  it('an unconfigured origin starts blank', () => {
    expect(originToDraft(null)).toEqual({
      addressLine1: '',
      addressLine2: '',
      neighborhood: '',
      municipality: '',
      state: '',
      postalCode: '',
      contactPhone: '',
    })
  })

  it('trims, sends a blank addressLine2 as null and drops spaces from the phone', () => {
    const draft = { ...originToDraft(origin), addressLine1: ' Av. Juárez 123 ', addressLine2: '  ', contactPhone: '55 1234-5678' }
    expect(draftToOriginBody(draft)).toEqual({
      addressLine1: 'Av. Juárez 123',
      addressLine2: null,
      neighborhood: 'Del Valle Centro',
      municipality: 'Benito Juárez',
      state: 'Ciudad de México',
      postalCode: '03100',
      contactPhone: '5512345678',
    })
  })
})

describe('shippingOriginForm — validation', () => {
  it('requires every field but addressLine2', () => {
    expect(validateOriginDraft(originToDraft(null))).toEqual({
      addressLine1: 'Escribe la calle y el número.',
      neighborhood: 'Escribe la colonia.',
      municipality: 'Escribe la alcaldía o el municipio.',
      state: 'Escribe el estado.',
      postalCode: 'El código postal tiene 5 dígitos.',
      contactPhone: 'Escribe un teléfono de 10 a 15 dígitos; puede empezar con +.',
    })
  })

  it('postalCode is exactly 5 digits and the phone matches ^\\+?\\d{10,15}$', () => {
    const valid = originToDraft(origin)
    expect(validateOriginDraft(valid)).toEqual({})
    expect(validateOriginDraft({ ...valid, contactPhone: '+525512345678' })).toEqual({})
    expect(validateOriginDraft({ ...valid, postalCode: '6000' }).postalCode).toBeDefined()
    expect(validateOriginDraft({ ...valid, postalCode: '06A00' }).postalCode).toBeDefined()
    expect(validateOriginDraft({ ...valid, contactPhone: '12345' }).contactPhone).toBeDefined()
    expect(validateOriginDraft({ ...valid, contactPhone: '+52+5512345678' }).contactPhone).toBeDefined()
  })

  it('caps the lengths at 200 and 120', () => {
    const valid = originToDraft(origin)
    expect(validateOriginDraft({ ...valid, addressLine2: 'x'.repeat(201), state: 'x'.repeat(121) })).toEqual({
      addressLine2: 'Puede tener hasta 200 caracteres.',
      state: 'Puede tener hasta 120 caracteres.',
    })
  })
})

describe('shippingOriginForm — error mapping (S6)', () => {
  it('maps 400 constraints to their fields in Spanish', () => {
    const err = {
      response: {
        status: 400,
        data: {
          statusCode: 400,
          error: 'Bad Request',
          message: [{ property: 'postalCode', children: [], constraints: { matches: 'postalCode must be five digits' } }],
        },
      },
    }
    expect(mapOriginError(err)).toEqual({ fields: { postalCode: 'El código postal tiene 5 dígitos.' }, message: null })
  })

  it('other failures read as a Spanish sentence', () => {
    expect(mapOriginError({ response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' } } }).message)
      .toBe('No tienes permiso para cambiar el origen.')
    expect(mapOriginError(new Error('boom')).message).toBe('No se pudo guardar el origen. Intenta de nuevo.')
  })
})
