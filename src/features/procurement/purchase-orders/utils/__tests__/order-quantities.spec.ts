import { describe, expect, it } from 'vitest'
import { SERVICE_UNIT_OPTIONS, UNIT_OPTIONS } from '@/core/shared/constants/product-units'
import { FRACTIONAL_UNITS, quantityRule, unitLabel, validateOrderQuantity, isValidOrderAmount } from '../order-quantities'

const fractional = ['KILOGRAMO', 'GRAMO', 'LITRO', 'METRO', 'CENTIMETRO']
const integers = ['UNIDAD', 'CAJA', 'BOLSA', 'PAQUETE', 'HORA', 'SESION', 'DIA', 'CONSULTA', 'CURSO']
describe('order decimal and unit rules without normalization', () => {
  it('defines exactly the five fractional units', () => {
    expect([...FRACTIONAL_UNITS].sort()).toEqual([...fractional].sort())
  })
  it.each(fractional)('%s permits up to three decimal places', unit => {
    expect(quantityRule(unit)).toBe('fractional')
    for (const value of ['0.5', '0.001', '1', '1.000', '999999999', '999999999.999']) expect(validateOrderQuantity(value, unit)).toBe('valid')
    for (const value of ['0', '0.000', '1.2345', '1000000000', '1000000000.001']) expect(validateOrderQuantity(value, unit)).toBe('invalid')
  })
  it.each(integers)('%s permits integers only', unit => {
    expect(quantityRule(unit)).toBe('integer')
    expect(validateOrderQuantity('1', unit)).toBe('valid')
    expect(validateOrderQuantity('999999999', unit)).toBe('valid')
    for (const value of ['0', '1.5', '0.5', '1.000', '1000000000']) expect(validateOrderQuantity(value, unit)).toBe('invalid')
  })
  it.each([null, undefined, '', 'UNKNOWN', 'kg', 'kilogramo', '__proto__'])('returns unknown for unrecognized unit %s, never inventing an integer rule', unit => {
    expect(quantityRule(unit)).toBe('unknown')
    expect(validateOrderQuantity('1.5', unit)).toBe('unknown')
    for (const value of ['0', '0.000', '1.2345', '1000000000']) expect(validateOrderQuantity(value, unit)).toBe('invalid')
    expect(unitLabel(unit)).toBeNull()
  })
  it.each(['01', '00.5', '1e3', '1,5', '-1', '+1', '.5', '1.', ' 1', '1 ', '1\n', '', 'NaN', 'Infinity'])('rejects noncanonical quantity and amount %j unchanged', value => {
    expect(validateOrderQuantity(value, 'KILOGRAMO')).toBe('invalid')
    // An unknown unit defers only the unit-specific step, never the contract syntax.
    expect(validateOrderQuantity(value, null)).toBe('invalid')
    expect(isValidOrderAmount(value)).toBe(false)
  })
  it.each(['0', '0.0000', '0.0001', '1', '1.2345', '999999999999', '999999999999.9999'])('accepts amount boundary %s', value => {
    expect(isValidOrderAmount(value)).toBe(true)
  })
  it.each(['1000000000000', '1000000000000.0001', '1.23456', '0.00001'])('rejects amount beyond width/scale %s', value => {
    expect(isValidOrderAmount(value)).toBe(false)
  })
  it('reuses the exported product and service label copy for every agreed unit', () => {
    for (const option of [...UNIT_OPTIONS, ...SERVICE_UNIT_OPTIONS]) expect(unitLabel(option.value)).toBe(option.label)
    expect([...UNIT_OPTIONS, ...SERVICE_UNIT_OPTIONS]).toHaveLength(14)
  })
})
