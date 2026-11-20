import { describe, expect, it } from 'vitest'
import { readBackorderError } from '../backorderErrors'

// Domain 409/404 bodies share the app's envelope (shipping handoff §0, shape A): `error` carries
// the code; the typed extras of S5 (`status`, `currentVersion`) sit beside it (L4 assumption).
const httpError = (status: number, data: Record<string, unknown>) => ({ response: { status, data } })

describe('readBackorderError (S5)', () => {
  it('VERSION_CONFLICT → refetch with the owner copy and the current version', () => {
    const info = readBackorderError(
      httpError(409, { statusCode: 409, error: 'VERSION_CONFLICT', message: 'x', currentVersion: 5 }),
    )
    expect(info).toMatchObject({
      code: 'VERSION_CONFLICT',
      refetch: true,
      currentVersion: 5,
      message: 'Otro usuario modificó este pedido; revisa los datos y vuelve a intentar.',
    })
  })

  it('also reads a body whose code sits in `code` (zone-filter shape B)', () => {
    expect(readBackorderError(httpError(409, { statusCode: 409, code: 'VERSION_CONFLICT' })).code).toBe(
      'VERSION_CONFLICT',
    )
  })

  it('BACKORDER_NOT_CANCELLABLE → refetch and names the current status', () => {
    const info = readBackorderError(httpError(409, { error: 'BACKORDER_NOT_CANCELLABLE', status: 'CONFIRMED' }))
    expect(info).toMatchObject({ code: 'BACKORDER_NOT_CANCELLABLE', refetch: true, currentStatus: 'CONFIRMED' })
    expect(info.message).toBe('Este pedido ya no se puede cancelar: está confirmado. Actualizamos los datos.')
  })

  it('BACKORDER_NOT_CANCELLABLE without a readable status keeps a generic sentence', () => {
    const info = readBackorderError(httpError(409, { error: 'BACKORDER_NOT_CANCELLABLE', status: 'WEIRD' }))
    expect(info.currentStatus).toBeNull()
    expect(info.message).toBe('Este pedido ya no se puede cancelar. Actualizamos los datos.')
  })

  it('BACKORDER_NOT_FOUND (404) says the order is gone and does not refetch', () => {
    const info = readBackorderError(httpError(404, { error: 'BACKORDER_NOT_FOUND' }))
    expect(info).toMatchObject({ code: 'BACKORDER_NOT_FOUND', refetch: false, notFound: true })
    expect(info.message).toBe('Este pedido ya no existe en esta sucursal.')
  })

  it('an unknown 404 is also «not found»; other errors never show a server string', () => {
    expect(readBackorderError(httpError(404, { error: 'Not Found', message: 'Cannot GET' })).notFound).toBe(true)
    const generic = readBackorderError(httpError(500, { error: 'INTERNAL', message: 'stack trace' }))
    expect(generic).toMatchObject({ refetch: false, notFound: false })
    expect(generic.message).toBe('No pudimos cancelar el pedido. Intenta de nuevo.')
    expect(readBackorderError(new Error('Network Error')).message).toBe(
      'No pudimos conectar. Revisa tu conexión e intenta de nuevo.',
    )
  })
})
