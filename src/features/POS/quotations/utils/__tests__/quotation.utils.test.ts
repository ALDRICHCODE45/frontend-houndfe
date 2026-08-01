import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isExpired,
  statusToTone,
  statusToLabel,
  isDraft,
  isCancellable,
} from '../quotation.utils'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

describe('quotation.utils', () => {
  describe('isExpired', () => {
    beforeEach(() => {
      // Anchor "now" to a deterministic instant so each assertion is hermetic.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns false when expiresAt is null (never expires)', () => {
      const dto = makeQuotation({ expiresAt: null, status: 'SENT' })
      expect(isExpired(dto)).toBe(false)
    })

    it('returns false when expiresAt is in the future', () => {
      const future = new Date('2026-08-15T00:00:00.000Z').toISOString()
      const dto = makeQuotation({ expiresAt: future, status: 'SENT' })
      expect(isExpired(dto)).toBe(false)
    })

    it('returns true when expiresAt is in the past', () => {
      const past = new Date('2026-07-15T00:00:00.000Z').toISOString()
      const dto = makeQuotation({ expiresAt: past, status: 'SENT' })
      expect(isExpired(dto)).toBe(true)
    })

    it('returns true when expiresAt is exactly now (boundary)', () => {
      // expiresAt < now is strict-less-than; same instant is NOT expired
      const now = new Date('2026-08-01T12:00:00.000Z').toISOString()
      const dto = makeQuotation({ expiresAt: now, status: 'SENT' })
      expect(isExpired(dto)).toBe(false)
    })
  })

  describe('statusToTone', () => {
    it('maps DRAFT to info tone', () => {
      expect(statusToTone('DRAFT')).toBe('info')
    })

    it('maps SENT to success tone', () => {
      expect(statusToTone('SENT')).toBe('success')
    })

    it('maps EXPIRED to warning tone', () => {
      expect(statusToTone('EXPIRED')).toBe('warning')
    })

    it('maps CANCELLED to error tone', () => {
      expect(statusToTone('CANCELLED')).toBe('error')
    })
  })

  describe('statusToLabel', () => {
    it('maps DRAFT to "Borrador"', () => {
      expect(statusToLabel('DRAFT')).toBe('Borrador')
    })

    it('maps SENT to "Enviada"', () => {
      expect(statusToLabel('SENT')).toBe('Enviada')
    })

    it('maps EXPIRED to "Expirada"', () => {
      expect(statusToLabel('EXPIRED')).toBe('Expirada')
    })

    it('maps CANCELLED to "Cancelada"', () => {
      expect(statusToLabel('CANCELLED')).toBe('Cancelada')
    })
  })

  describe('isDraft', () => {
    it('returns true only when status === DRAFT', () => {
      expect(isDraft('DRAFT')).toBe(true)
      expect(isDraft('SENT')).toBe(false)
      expect(isDraft('EXPIRED')).toBe(false)
      expect(isDraft('CANCELLED')).toBe(false)
    })
  })

  describe('isCancellable', () => {
    it('returns true for DRAFT (cancellable)', () => {
      expect(isCancellable('DRAFT')).toBe(true)
    })

    it('returns false for terminal states (SENT/EXPIRED/CANCELLED)', () => {
      expect(isCancellable('SENT')).toBe(false)
      expect(isCancellable('EXPIRED')).toBe(false)
      expect(isCancellable('CANCELLED')).toBe(false)
    })
  })
})

function makeQuotation(
  overrides: Pick<Partial<QuotationResponseDto>, 'expiresAt' | 'status'> = {},
): QuotationResponseDto {
  return {
    id: 'qtn-1',
    customerId: null,
    customer: null,
    globalPriceListId: null,
    priceListExplicitlySet: false,
    status: overrides.status ?? 'DRAFT',
    expiresAt: overrides.expiresAt ?? null,
    cancelReason: null,
    canceledAt: null,
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}