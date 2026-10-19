import { describe, it, expect } from 'vitest'
import { evaluateBotEligibility } from '../botEligibility.utils'
import { getInitialState } from '../../composables/usePromotionForm'
import { botRule } from './botEligibility.fixtures'
import type { PromotionFormState } from '../../interfaces/promotion.types'

const state = (patch: Partial<PromotionFormState> = {}) => ({
  ...getInitialState('PRODUCT_DISCOUNT'),
  ...patch,
})

describe('evaluateBotEligibility', () => {
  it('matches exactly without mutating the form', () => {
    const input = state()
    const before = structuredClone(input)
    expect(evaluateBotEligibility(input, [botRule])).toEqual({ supported: true })
    expect(input).toEqual(before)
  })
  it.each([
    [{ method: 'MANUAL' }, /método.*Manual.*Descuento en productos.*Automático/i],
    [{ type: 'ADVANCED' }, /tipo.*Promoción avanzada.*Descuento en productos.*Automático/i],
    [{ appliesTo: 'BRANDS' }, /aplica a.*Marcas.*Productos/i],
    [{ customerScope: 'SPECIFIC' }, /clientes.*Clientes específicos.*Todos los clientes/i],
    [{ hasPriceLists: true, priceListIds: ['list'] }, /listas de precios/i],
    [{ hasDaysOfWeek: true, daysOfWeek: ['MONDAY'] }, /días de la semana/i],
  ] as [Partial<PromotionFormState>, RegExp][])(
    'explains the first blocking condition: %j',
    (patch, reason) => {
      expect(evaluateBotEligibility(state(patch), [botRule])).toEqual({
        supported: false,
        reason: expect.stringMatching(reason),
      })
    },
  )
  it('does not constrain appliesTo for a null rule (ORDER_DISCOUNT)', () => {
    expect(
      evaluateBotEligibility(state({ type: 'ORDER_DISCOUNT', appliesTo: '' }), [
        { ...botRule, type: 'ORDER_DISCOUNT', appliesTo: null },
      ]),
    ).toEqual({ supported: true })
  })
  it('disables honestly when no combinations are available', () => {
    expect(evaluateBotEligibility(state(), [])).toEqual({
      supported: false,
      reason: 'No hay combinaciones disponibles para el chatbot.',
    })
  })
  it('uses effective payload arrays, not hidden selections or toggle alone', () => {
    expect(
      evaluateBotEligibility(state({ priceListIds: ['hidden'], daysOfWeek: ['MONDAY'] }), [botRule])
        .supported,
    ).toBe(true)
    expect(
      evaluateBotEligibility(state({ hasPriceLists: true, hasDaysOfWeek: true }), [botRule])
        .supported,
    ).toBe(true)
  })
  it('accepts new endpoint rules without a client-side type allowlist', () => {
    expect(
      evaluateBotEligibility(
        state({
          type: 'BUY_X_GET_Y',
          appliesTo: 'BRANDS',
          customerScope: 'SPECIFIC',
          hasPriceLists: true,
          priceListIds: ['list'],
          hasDaysOfWeek: true,
          daysOfWeek: ['MONDAY'],
        }),
        [
          {
            ...botRule,
            type: 'BUY_X_GET_Y',
            appliesTo: ['BRANDS'],
            customerScopes: ['SPECIFIC'],
            allowsPriceLists: true,
            allowsDaysOfWeek: true,
          },
        ],
      ).supported,
    ).toBe(true)
  })
  it('matches ANY whole rule, not the union of unrelated rule conditions', () => {
    const rules = [
      botRule,
      { ...botRule, appliesTo: ['BRANDS' as const], customerScopes: ['SPECIFIC' as const] },
    ]
    expect(
      evaluateBotEligibility(state({ appliesTo: 'BRANDS', customerScope: 'SPECIFIC' }), rules)
        .supported,
    ).toBe(true)
    expect(evaluateBotEligibility(state({ appliesTo: 'BRANDS' }), rules).reason).toMatch(
      /clientes/i,
    )
  })
  it('prioritizes method before type, then applies-to before customers and restrictions', () => {
    expect(
      evaluateBotEligibility(state({ type: 'ADVANCED', method: 'MANUAL' }), [botRule]).reason,
    ).toMatch(/método/i)
    expect(
      evaluateBotEligibility(
        state({
          appliesTo: 'BRANDS',
          customerScope: 'SPECIFIC',
          hasPriceLists: true,
          priceListIds: ['p'],
        }),
        [botRule],
      ).reason,
    ).toMatch(/aplica a/i)
  })
})
