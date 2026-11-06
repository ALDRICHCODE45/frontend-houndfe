import { describe, expect, it } from 'vitest'
import { mapResolveError, mapZoneWriteError } from '../zoneErrors'

const httpError = (status: number, data: unknown) => ({ response: { status, data } })
const B = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  httpError(status, { statusCode: status, code, message: 'English backend text', ...extra })

describe('zone save/deactivate errors', () => {
  it('turns the pending-validation 409 into a link to that validation (L7)', () => {
    const result = mapZoneWriteError(B(409, 'DELIVERY_ZONE_VALIDATION_PENDING', { validationId: '8a2f1c3e-5b6d-4e7f-8a9b-0c1d2e3f4a5b' }))
    expect(result).toEqual({ kind: 'validation-pending', validationId: '8a2f1c3e-5b6d-4e7f-8a9b-0c1d2e3f4a5b', message: expect.stringContaining('validación pendiente'), fieldErrors: {} })
  })

  it('without a validationId the pending 409 is a plain message', () => {
    expect(mapZoneWriteError(B(409, 'DELIVERY_ZONE_VALIDATION_PENDING')).kind).toBe('form')
  })

  it('routes validation-pipe errors to the field that caused them, in Spanish', () => {
    const result = mapZoneWriteError(httpError(400, {
      statusCode: 400, error: 'Bad Request',
      message: [
        { property: 'surchargeCents', children: [], constraints: { isInt: 'surchargeCents must be an integer number' } },
        { property: 'neighborhood', children: [], constraints: { minLength: 'too short' } },
      ],
    }))
    expect(result.kind).toBe('form')
    expect(result.fieldErrors).toEqual({ surchargeCents: 'Escribe un cargo en pesos con hasta 2 decimales.', neighborhood: 'Escribe de 1 a 120 caracteres.' })
    expect(JSON.stringify(result)).not.toContain('must be')
  })

  it('maps the shape rule, a bad postal code, permissions, missing zone and the network without English text', () => {
    expect(mapZoneWriteError(B(400, 'INVALID_DELIVERY_ZONE')).message).toBe('Revisa el tipo de entrega, el cargo y los días.')
    expect(mapZoneWriteError(httpError(400, { statusCode: 400, error: 'Bad Request', message: 'zipCode must be exactly five digits' })).fieldErrors).toEqual({ zipCode: 'Escribe un código postal de 5 dígitos.' })
    expect(mapZoneWriteError(httpError(403, { statusCode: 403, error: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' })).message).toBe('Tu rol no permite cambiar zonas de entrega.')
    expect(mapZoneWriteError(B(404, 'DELIVERY_ZONE_NOT_FOUND'))).toMatchObject({ kind: 'reload', message: 'Esta zona ya no existe. Se actualizó la lista.' })
    expect(mapZoneWriteError(new Error('Network Error'))).toMatchObject({ kind: 'form', message: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.' })
  })

  it('a 401 logs out', () => {
    expect(mapZoneWriteError(B(401, 'UNAUTHORIZED')).kind).toBe('logout')
  })
})

describe('resolve errors (handoff §3.4 table)', () => {
  it('reloads on VERSION_CONFLICT, ALREADY_RESOLVED and IDEMPOTENCY_CONFLICT with distinct copy', () => {
    const version = mapResolveError(B(409, 'VERSION_CONFLICT'))
    const resolved = mapResolveError(B(409, 'ALREADY_RESOLVED'))
    const idem = mapResolveError(B(409, 'IDEMPOTENCY_CONFLICT'))
    expect([version.kind, resolved.kind, idem.kind]).toEqual(['reload', 'reload', 'reload'])
    expect(resolved.message).toBe('Otra persona ya resolvió esta validación. Abajo ves qué decidió.')
    expect(new Set([version.message, resolved.message, idem.message]).size).toBe(3)
  })

  it('sends a missing validation back to the list (B and D 404)', () => {
    expect(mapResolveError(B(404, 'DELIVERY_ZONE_VALIDATION_NOT_FOUND')).kind).toBe('gone')
    expect(mapResolveError(httpError(404, { statusCode: 404, error: 'Not Found', message: 'Delivery zone validation not found' })).kind).toBe('gone')
  })

  it('offers a retry with the same request only for the network and 5xx', () => {
    expect(mapResolveError(new Error('Network Error')).kind).toBe('network')
    expect(mapResolveError(httpError(503, { statusCode: 503, message: 'down' })).kind).toBe('network')
    expect(mapResolveError(B(400, 'INVALID_DELIVERY_ZONE')).kind).toBe('form')
  })

  it('logs out on 401 and explains a 403', () => {
    expect(mapResolveError(B(401, 'UNAUTHORIZED')).kind).toBe('logout')
    expect(mapResolveError(httpError(403, { statusCode: 403, error: 'INSUFFICIENT_PERMISSIONS', message: 'x' }))).toMatchObject({ kind: 'form', message: 'Tu rol no permite resolver validaciones de zona.' })
  })
})
