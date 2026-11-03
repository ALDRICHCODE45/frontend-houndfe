import { describe, expect, it } from 'vitest'
import { diagnosticMessage, diagnosticTarget, diagnosticCodes } from '../order-diagnostics'

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
})
