/**
 * T22 — product money text reads with the one app-wide rule (parseMoneyInput):
 * the form schema, the payload cents and the tier rows.
 */
import { describe, expect, it } from 'vitest'
import * as productForm from '../useProductForm'
import {
  moneyTextToCents,
  productFormSchema,
  readTierRows,
  toCreatePayload,
  useProductForm,
} from '../useProductForm'

const COMMA = 'Escribe el monto con punto para los centavos, por ejemplo 70.55.'

describe('product money text', () => {
  it('no longer exports the first-comma helper', () => {
    expect('decimalInputToCents' in productForm).toBe(false)
  })

  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
    ['$1 234.50', 123450],
  ])('reads %j as %i cents', (text, cents) => {
    expect(moneyTextToCents(text)).toBe(cents)
  })

  it.each(['', '12abc', '1,23,4', '0,100'])('reads %j as no amount, never 0', (text) => {
    expect(moneyTextToCents(text)).toBeNull()
  })

  it.each(['price', 'purchaseCost'] as const)('the %s field accepts the three forms', (field) => {
    const schema = productFormSchema.shape[field]
    for (const text of ['70,55', '1,234.50', '70.55', '']) {
      expect(schema.safeParse(text).success, text).toBe(true)
    }
  })

  it.each(['price', 'purchaseCost'] as const)('the %s field rejects with the parser message', (field) => {
    const schema = productFormSchema.shape[field]
    for (const text of ['1,23,4', '0,100']) {
      const result = schema.safeParse(text)
      expect(result.success, text).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(COMMA)
    }
    expect(schema.safeParse('12abc').error?.issues[0]?.message).toBe(
      'Escribe solo el monto en números, por ejemplo 70.55.',
    )
  })

  it('builds the create payload with the exact cents', () => {
    const { state } = useProductForm()
    const values = productFormSchema.parse({ ...state, name: 'Collar', price: '1,234.50', purchaseCost: '70,55' })
    const payload = toCreatePayload(values)
    expect(payload.priceCents).toBe(123450)
    expect(payload.purchaseCost).toEqual({ mode: 'NET', valueCents: 7055 })
  })
})

describe('readTierRows', () => {
  it('reads the filled rows as exact cents, sorted by quantity', () => {
    expect(
      readTierRows([
        { key: 1, minQuantity: 10, price: '1,234.50' },
        { key: 2, minQuantity: '5', price: '70,55' },
        { key: 3, minQuantity: '', price: '' },
      ]),
    ).toEqual({
      tiers: [
        { minQuantity: 5, priceCents: 7055 },
        { minQuantity: 10, priceCents: 123450 },
      ],
    })
  })

  it('returns the parser error of each row that does not parse', () => {
    expect(
      readTierRows([
        { key: 1, minQuantity: 10, price: '12abc' },
        { key: 2, minQuantity: 20, price: '70.55' },
        { key: 3, minQuantity: 30, price: '1,23,4' },
      ]),
    ).toEqual({
      errors: { 1: 'Escribe solo el monto en números, por ejemplo 70.55.', 3: COMMA },
    })
  })
})
