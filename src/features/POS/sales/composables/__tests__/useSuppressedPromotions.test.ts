// odd T3b / S5 — suppressedPromotions from a quotation → sale conversion (handoff 23 §2).
// GET /sales/drafts does not expose vetoes, so the conversion response's list is kept in
// localStorage per tenant + sale, offered in «Promociones disponibles», and dropped once applied,
// charged, discarded or expired.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { ApplicablePromotion } from '../../interfaces/sale.types'

const tenant = { id: 'tenant-1' }
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: tenant.id }),
}))

import {
  SUPPRESSED_PROMOTIONS_STORAGE_PREFIX,
  SUPPRESSED_PROMOTIONS_TTL_MS,
  clearSuppressedPromotions,
  forgetSuppressedPromotion,
  isSuppressedFromQuotation,
  mergeSuppressedPromotions,
  readSuppressedPromotions,
  rememberSuppressedPromotions,
  useSuppressedPromotions,
} from '../useSuppressedPromotions'

const KEY = `${SUPPRESSED_PROMOTIONS_STORAGE_PREFIX}tenant-1:sale-1`

describe('suppressed promotions storage', () => {
  beforeEach(() => {
    localStorage.clear()
    tenant.id = 'tenant-1'
  })

  it('remembers the list per tenant + sale and reads it back', () => {
    rememberSuppressedPromotions('sale-1', [
      { promotionId: 'p-1', title: 'Orden auto' },
      { promotionId: 'p-2', title: null },
    ])

    expect(localStorage.getItem(KEY)).not.toBeNull()
    expect(readSuppressedPromotions('sale-1')).toEqual([
      { promotionId: 'p-1', title: 'Orden auto' },
      { promotionId: 'p-2', title: null },
    ])
    expect(readSuppressedPromotions('sale-2')).toEqual([])
  })

  it('does not leak across tenants', () => {
    rememberSuppressedPromotions('sale-1', [{ promotionId: 'p-1', title: 'A' }])
    tenant.id = 'tenant-2'
    expect(readSuppressedPromotions('sale-1')).toEqual([])
  })

  it('stores nothing for an empty list (and removes a previous one)', () => {
    rememberSuppressedPromotions('sale-1', [{ promotionId: 'p-1', title: 'A' }])
    rememberSuppressedPromotions('sale-1', [])
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('forgets one promotion once applied and removes the key when none is left', () => {
    rememberSuppressedPromotions('sale-1', [
      { promotionId: 'p-1', title: 'A' },
      { promotionId: 'p-2', title: 'B' },
    ])
    forgetSuppressedPromotion('sale-1', 'p-1')
    expect(readSuppressedPromotions('sale-1')).toEqual([{ promotionId: 'p-2', title: 'B' }])
    forgetSuppressedPromotion('sale-1', 'p-2')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('clears the whole sale (charged / discarded)', () => {
    rememberSuppressedPromotions('sale-1', [{ promotionId: 'p-1', title: 'A' }])
    clearSuppressedPromotions('sale-1')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('expires after the TTL and prunes expired entries of other sales on write', () => {
    const t0 = 1_000_000
    rememberSuppressedPromotions('sale-1', [{ promotionId: 'p-1', title: 'A' }], t0)
    expect(readSuppressedPromotions('sale-1', t0 + SUPPRESSED_PROMOTIONS_TTL_MS - 1)).toHaveLength(1)
    expect(readSuppressedPromotions('sale-1', t0 + SUPPRESSED_PROMOTIONS_TTL_MS + 1)).toEqual([])

    rememberSuppressedPromotions(
      'sale-2',
      [{ promotionId: 'p-9', title: 'Z' }],
      t0 + SUPPRESSED_PROMOTIONS_TTL_MS + 1,
    )
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('reads a corrupt or foreign value as empty', () => {
    localStorage.setItem(KEY, '{not json')
    expect(readSuppressedPromotions('sale-1')).toEqual([])
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), promotions: [{ nope: 1 }] }))
    expect(readSuppressedPromotions('sale-1')).toEqual([])
  })
})

describe('mergeSuppressedPromotions', () => {
  const applicable: ApplicablePromotion[] = [
    { id: 'm-1', title: 'Manual', type: 'PRODUCT_DISCOUNT' },
  ]

  it('puts the suppressed ones first, marked, with «Promoción» for a null title', () => {
    const merged = mergeSuppressedPromotions(applicable, [
      { promotionId: 'p-1', title: 'Orden auto' },
      { promotionId: 'p-2', title: null },
    ])

    expect(merged.map((promo) => [promo.id, promo.title])).toEqual([
      ['p-1', 'Orden auto'],
      ['p-2', 'Promoción'],
      ['m-1', 'Manual'],
    ])
    expect(merged.map(isSuppressedFromQuotation)).toEqual([true, true, false])
  })

  it('does not duplicate a promotion the backend already lists', () => {
    const merged = mergeSuppressedPromotions(applicable, [{ promotionId: 'm-1', title: 'Manual' }])
    expect(merged).toHaveLength(1)
    expect(isSuppressedFromQuotation(merged[0]!)).toBe(false)
  })

  it('returns the same array when nothing is suppressed', () => {
    expect(mergeSuppressedPromotions(applicable, [])).toBe(applicable)
  })
})

describe('useSuppressedPromotions', () => {
  beforeEach(() => {
    localStorage.clear()
    tenant.id = 'tenant-1'
  })

  it('reacts to writes and to the sale id', async () => {
    const saleId = ref<string | undefined>(undefined)
    const suppressed = useSuppressedPromotions(saleId)
    expect(suppressed.value).toEqual([])

    rememberSuppressedPromotions('sale-1', [{ promotionId: 'p-1', title: 'A' }])
    saleId.value = 'sale-1'
    await nextTick()
    expect(suppressed.value).toEqual([{ promotionId: 'p-1', title: 'A' }])

    forgetSuppressedPromotion('sale-1', 'p-1')
    await nextTick()
    expect(suppressed.value).toEqual([])
  })
})
