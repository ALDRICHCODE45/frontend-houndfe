import { describe, it, expect, vi } from 'vitest'
import {
  getInitialState,
  promotionToFormState,
  toCreatePayload,
  toUpdatePayload,
  mapApiErrorToFields,
} from '../usePromotionForm'
import { promotionFormSchema } from '../../interfaces/promotion.schema'
import { promotionApi } from '../../api/promotion.api'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import { http } from '@/core/shared/api/http'
import { botPromotion, botRule } from '../../utils/__tests__/botEligibility.fixtures'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn() } }))

describe('bot eligibility contracts', () => {
  it('defaults false and hydrates both saved values', () => {
    expect(getInitialState('PRODUCT_DISCOUNT').botEligible).toBe(false)
    for (const botEligible of [true, false])
      expect(promotionToFormState(botPromotion({ botEligible })).botEligible).toBe(botEligible)
  })
  it('retains boolean in the schema and rejects non-booleans', () => {
    const state = {
      ...getInitialState('PRODUCT_DISCOUNT'),
      title: 'Oferta',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      botEligible: true,
    }
    expect(promotionFormSchema.parse(state)).toHaveProperty('botEligible', true)
    expect(promotionFormSchema.safeParse({ ...state, botEligible: 'true' }).success).toBe(false)
  })
  it.each(['PRODUCT_DISCOUNT', 'ORDER_DISCOUNT', 'BUY_X_GET_Y', 'ADVANCED'] as const)(
    'adds only botEligible to existing create/update payloads for %s',
    (type) => {
      const state = {
        ...getInitialState(type),
        title: 'Oferta',
        discountType: 'FIXED' as const,
        discountValue: 12.34,
        buyQuantity: 2,
        getQuantity: 1,
        getDiscountPercent: 50,
        hasVigencia: true,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        customerScope: 'SPECIFIC' as const,
        customerIds: ['c'],
        hasPriceLists: true,
        priceListIds: ['p'],
        hasDaysOfWeek: true,
        daysOfWeek: ['MONDAY' as const],
        targetItems: [{ targetId: 't', name: 'target' }],
        buyTargetItems: [{ targetId: 'b', name: 'buy' }],
        getTargetItems: [{ targetId: 'g', name: 'get' }],
        hasMinPurchase: true,
        minPurchaseAmountCents: 25,
      }
      // Frozen pre-feature payload contract; no new mapper is used to derive this expectation.
      const base = {
        title: 'Oferta',
        method: 'AUTOMATIC',
        maxProductUnits: null,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        customerScope: 'SPECIFIC',
        customerIds: ['c'],
        priceListIds: ['p'],
        daysOfWeek: ['MONDAY'],
      }
      const legacyByType = {
        PRODUCT_DISCOUNT: {
          ...base,
          type,
          discountType: 'FIXED',
          discountValue: 1234,
          appliesTo: 'PRODUCTS',
          targetItems: [{ targetType: 'PRODUCTS', targetId: 't' }],
        },
        ORDER_DISCOUNT: {
          ...base,
          type,
          discountType: 'FIXED',
          discountValue: 1234,
          minPurchaseAmountCents: 2500,
        },
        BUY_X_GET_Y: {
          ...base,
          type,
          buyQuantity: 2,
          getQuantity: 1,
          getDiscountPercent: 50,
          appliesTo: 'PRODUCTS',
          targetItems: [{ targetType: 'PRODUCTS', targetId: 't' }],
        },
        ADVANCED: {
          ...base,
          type,
          buyQuantity: 2,
          getQuantity: 1,
          getDiscountPercent: 50,
          buyTargetType: 'PRODUCTS',
          getTargetType: 'PRODUCTS',
          buyTargetItems: [{ targetId: 'b' }],
          getTargetItems: [{ targetId: 'g' }],
        },
      }
      const legacy = legacyByType[type]
      const { type: _, ...legacyUpdate } = legacy
      for (const botEligible of [false, true]) {
        expect(toCreatePayload({ ...state, botEligible })).toEqual({ ...legacy, botEligible })
        expect(toUpdatePayload({ ...state, botEligible })).toEqual({ ...legacyUpdate, botEligible })
        const { maxProductUnits: _cap, ...unchanged } = legacyUpdate
        expect(toUpdatePayload({ ...state, botEligible, capacityMode: 'unchanged' })).toEqual({
          ...unchanged,
          botEligible,
        })
      }
    },
  )
  it('maps unsupported errors to the field without leaking English', () => {
    expect(
      mapApiErrorToFields({
        error: 'BOT_ELIGIBILITY_UNSUPPORTED',
        message: 'unsupported customers',
      }),
    ).toEqual({
      fieldErrors: [
        {
          path: 'botEligible',
          message:
            'Esta configuración no está disponible para el chatbot. Desactiva WhatsApp o ajusta las condiciones.',
        },
      ],
      toastMessage: null,
    })
  })
  it('reads capabilities from the dedicated endpoint verbatim', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ data: { rules: [botRule] } })
    expect(await promotionApi.getBotEligibilityCapabilities()).toEqual({ rules: [botRule] })
    expect(http.get).toHaveBeenCalledWith('/promotions/bot-eligibility-capabilities')
  })
  it('isolates the capabilities cache by tenant and existing slots', () => {
    const key = promotionQueryKeys.botEligibilityCapabilities('tenant-a')
    expect(key).toEqual(['promotions', 'tenant-a', 'bot-eligibility-capabilities'])
    expect(key).not.toEqual(promotionQueryKeys.botEligibilityCapabilities('tenant-b'))
    expect(key).not.toEqual(promotionQueryKeys.detail('tenant-a', 'bot-eligibility-capabilities'))
  })
})
