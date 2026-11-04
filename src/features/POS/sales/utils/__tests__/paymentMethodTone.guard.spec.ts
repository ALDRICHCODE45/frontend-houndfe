/**
 * T4 review round 2, C4: a payment method is not a state, so it never carries a
 * status color. Efectivo was green and Transferencia amber, which read as
 * "good" and "pending". Chips and tiles are neutral everywhere in sales.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getMethodMeta } from '../paymentMethodMeta'
import * as salePaymentMethod from '../salePaymentMethod.utils'

const COMPONENTS = join(__dirname, '..', '..', 'components')

describe('payment method tone (C4)', () => {
  it.each(['CASH', 'CARD_DEBIT', 'CARD_CREDIT', 'TRANSFER', 'CREDIT', 'OTHER'])(
    'the %s meta has a label and an icon, and no color',
    (code) => {
      const meta = getMethodMeta(code)
      expect(meta.label).toBeTruthy()
      expect(meta.icon).toMatch(/^i-lucide-/)
      expect(meta).not.toHaveProperty('color')
    },
  )

  it('keeps no per-method color helper', () => {
    expect(Object.keys(salePaymentMethod)).not.toContain('getPaymentMethodColor')
  })

  it('has no sales component that colors a payment method', () => {
    const offenders = readdirSync(COMPONENTS)
      .filter((file) => file.endsWith('.vue'))
      .filter((file) => /getMethodColor|getPaymentMethodColor|getMethodMeta\([^)]*\)\.color/.test(readFileSync(join(COMPONENTS, file), 'utf8')))
    expect(offenders).toEqual([])
  })
})
