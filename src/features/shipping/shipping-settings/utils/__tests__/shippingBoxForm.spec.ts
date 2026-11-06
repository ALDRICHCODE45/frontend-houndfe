import { describe, expect, it } from 'vitest'
import {
  boxPatch,
  boxToDraft,
  draftToBoxBody,
  emptyBoxDraft,
  mapBoxError,
  validateBoxDraft,
} from '../shippingBoxForm'
import type { ShippingBox } from '../../interfaces/shipping-settings.types'

const box: ShippingBox = {
  id: 'box-1',
  name: 'Caja chica',
  innerLengthCm: 30,
  innerWidthCm: 20,
  innerHeightCm: 15,
  weightG: 180,
  maxContentWeightG: 5000,
  isActive: true,
  createdAt: 'x',
  updatedAt: 'x',
}

const httpError = (status: number, data: unknown) => ({ response: { status, data } })

describe('shippingBoxForm — draft and body', () => {
  it('shows a box in cm and kg and sends it back in cm and grams', () => {
    const draft = boxToDraft(box)
    expect(draft).toEqual({
      name: 'Caja chica',
      length: '30',
      width: '20',
      height: '15',
      weightKg: '0.18',
      maxContentKg: '5',
    })
    expect(draftToBoxBody({ ...draft, name: '  Caja chica  ' })).toEqual({
      name: 'Caja chica',
      innerLengthCm: 30,
      innerWidthCm: 20,
      innerHeightCm: 15,
      weightG: 180,
      maxContentWeightG: 5000,
    })
  })

  it('PATCH carries only the changed fields', () => {
    const draft = { ...boxToDraft(box), width: '22,5', maxContentKg: '6' }
    expect(boxPatch(box, draft)).toEqual({ innerWidthCm: 22.5, maxContentWeightG: 6000 })
  })
})

describe('shippingBoxForm — validation mirrors the handoff', () => {
  it('a blank draft names every required field', () => {
    expect(validateBoxDraft(emptyBoxDraft())).toEqual({
      name: 'Escribe el nombre de la caja.',
      length: 'Escribe una medida entre 0.1 y 300 cm, con un decimal como máximo.',
      width: 'Escribe una medida entre 0.1 y 300 cm, con un decimal como máximo.',
      height: 'Escribe una medida entre 0.1 y 300 cm, con un decimal como máximo.',
      weightKg: 'Escribe un peso entre 0.001 y 70 kg.',
      maxContentKg: 'Escribe un peso entre 0.001 y 70 kg.',
    })
  })

  it('accepts a valid draft and rejects a name over 80 characters', () => {
    expect(validateBoxDraft(boxToDraft(box))).toEqual({})
    expect(validateBoxDraft({ ...boxToDraft(box), name: 'x'.repeat(81) })).toEqual({
      name: 'El nombre puede tener hasta 80 caracteres.',
    })
  })
})

describe('shippingBoxForm — error mapping (S6)', () => {
  it('409 ENTITY_ALREADY_EXISTS goes to the name field', () => {
    const err = httpError(409, {
      statusCode: 409,
      error: 'ENTITY_ALREADY_EXISTS',
      message: 'ShippingBox "Caja chica" already exists',
      timestamp: 'x',
    })
    expect(mapBoxError(err, 'save')).toEqual({
      fields: { name: 'Ya existe una caja con ese nombre.' },
      message: null,
    })
  })

  it('400 validation errors go to their fields in Spanish', () => {
    const err = httpError(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: [
        { property: 'innerLengthCm', children: [], constraints: { max: 'innerLengthCm must not be greater than 300' } },
        { property: 'maxContentWeightG', children: [], constraints: { max: 'too big' } },
      ],
    })
    expect(mapBoxError(err, 'save')).toEqual({
      fields: {
        length: 'Escribe una medida entre 0.1 y 300 cm, con un decimal como máximo.',
        maxContentKg: 'Escribe un peso entre 0.001 y 70 kg.',
      },
      message: null,
    })
  })

  it('other failures read as a Spanish sentence for the action, never the server text', () => {
    const notFound = httpError(404, { statusCode: 404, error: 'ENTITY_NOT_FOUND', message: 'ShippingBox with id "box-1" not found' })
    expect(mapBoxError(notFound, 'delete')).toEqual({ fields: {}, message: 'Esta caja ya no existe. Actualiza la lista.' })
    const forbidden = httpError(403, { statusCode: 403, error: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' })
    expect(mapBoxError(forbidden, 'retire').message).toBe('No tienes permiso para cambiar las cajas.')
    expect(mapBoxError(new Error('Network Error'), 'reactivate').message).toBe('No se pudo reactivar la caja. Intenta de nuevo.')
    expect(mapBoxError(httpError(500, {}), 'delete').message).toBe('No se pudo eliminar la caja. Intenta de nuevo.')
  })
})
