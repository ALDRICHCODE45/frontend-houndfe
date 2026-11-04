import { describe, expect, it } from 'vitest'
import { commandMessage, diagnosticMessage, diagnosticTarget, diagnosticCodes } from '../order-diagnostics'

describe('order diagnostics', () => {
  it('translates all fourteen codes and unknown future codes without hiding them', () => {
    expect(diagnosticCodes).toHaveLength(14)
    for (const code of diagnosticCodes) expect(diagnosticMessage(code)).not.toBe(diagnosticMessage('FUTURE'))
    expect(diagnosticMessage('FUTURE')).toBe('Revisa este dato del borrador.')
    expect(diagnosticMessage('constructor')).toBe('Revisa este dato del borrador.')
  })
  it('places deeper pointers under their known line field', () => {
    expect(diagnosticTarget('/lines/0/productId/detail', 1)).toBe('/lines/0/productId')
    expect(diagnosticTarget('/lines/0/informedUnitCost/amount/detail', 1)).toBe('/lines/0/informedUnitCost/amount')
  })
  it('places known fields, lines and cost fields, decoding RFC 6901 tokens', () => {
    for (const path of ['/supplierId', '/note', '/location/detail', '/lines', '/lines/0', '/lines/0/orderedQuantity', '/lines/0/informedUnitCost/amount']) {
      expect(diagnosticTarget(path, 1)).toBe(path)
    }
    for (const path of ['/lines/1/productId', '/lines/-1', '/lines/00', '/lines/0/unknown', '/lines/0/informedUnitCost/unknown', '/supplierId/x', '/note~1other', '/note~0other', 'note', '/note~2']) {
      expect(diagnosticTarget(path, 1)).toBe('summary')
    }
  })
  it('explains every confirmation and cancellation conflict, and archived suppliers per operation', () => {
    const fail = (error: string) => ({ response: { status: 409, data: { statusCode: 409, error } } })
    const generic = commandMessage(fail('FUTURE'))
    expect(commandMessage(fail('ORDER_NOT_READY'))).toBe('La orden todavía no se puede confirmar. Revisa los avisos del borrador.')
    expect(commandMessage(fail('ELIGIBILITY_CHANGED'))).toBe('Algún producto o variante de la orden cambió. Revisa la orden actualizada antes de confirmar.')
    expect(commandMessage(fail('SUPPLIER_VERSION_CONFLICT'))).toBe('Los datos del proveedor cambiaron. Revisa la orden actualizada antes de confirmar.')
    expect(commandMessage(fail('ORDER_STATE_CONFLICT'))).toBe('La orden ya no está en un estado que permita esta acción. Revisa su estado actual.')
    expect(commandMessage(fail('SUPPLIER_ARCHIVED'), false, 'confirm')).toBe('El proveedor de esta orden está archivado. Elige un proveedor activo y guarda el borrador antes de confirmar.')
    for (const operation of ['confirm', 'cancel'] as const) expect(commandMessage(fail('ORDER_VERSION_CONFLICT'), false, operation)).toBe('La orden cambió en otra sesión. Ya se cargó su versión actual; revísala antes de continuar.')
    expect(commandMessage(fail('ORDER_VERSION_CONFLICT'))).toBe('La orden cambió en otra sesión. Tus cambios locales se conservan. Puedes cargar la versión actual.')
    expect(commandMessage(fail('SUPPLIER_ARCHIVED'))).toBe('El proveedor seleccionado está archivado. Elige un proveedor activo para esta sustitución.')
    // The Reintentar button is the action; the text only says what failed.
    expect(commandMessage(null, true)).toBe('El resultado no está confirmado.')
    expect(commandMessage(fail('IDEMPOTENCY_KEY_IN_FLIGHT'))).toBe('El intento sigue en proceso.')
    expect(generic).toBe('No se pudo completar la operación.')
    for (const code of ['ORDER_NOT_READY', 'ELIGIBILITY_CHANGED', 'SUPPLIER_VERSION_CONFLICT', 'ORDER_STATE_CONFLICT']) expect(commandMessage(fail(code))).not.toBe(generic)
  })
})
