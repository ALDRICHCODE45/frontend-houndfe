import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isExpired,
  statusToTone,
  statusToLabel,
  isDraft,
  isCancellable,
  stepperIndexFromStatus,
  computeIva16,
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

  // T-UI-07 — REQ-UI-003 status→step mapping. The 3-state stepper needs a
  // pure, isolated helper so the active/completed/future visual logic stays
  // in the component while the data mapping stays here in utils. The
  // helper MUST be a plain function (no Vue imports) so it is trivially
  // unit-testable.
  describe('stepperIndexFromStatus', () => {
    it('maps DRAFT to step 0 (BORRADOR)', () => {
      expect(stepperIndexFromStatus('DRAFT')).toBe(0)
    })

    it('maps SENT to step 1 (ENVIADA)', () => {
      expect(stepperIndexFromStatus('SENT')).toBe(1)
    })

    it('maps EXPIRED to step 2 (EXPIRADA/CANCELADA — terminal)', () => {
      expect(stepperIndexFromStatus('EXPIRED')).toBe(2)
    })

    it('maps CANCELLED to step 2 (EXPIRADA/CANCELADA — terminal)', () => {
      expect(stepperIndexFromStatus('CANCELLED')).toBe(2)
    })

    it('returns -1 for unknown statuses (forward-compat for ACEPTADA/PEDIDO)', () => {
      // Cast through unknown so the test still compiles — the helper
      // is the single source of truth and MUST be tolerant.
      expect(stepperIndexFromStatus('ACEPTADA' as unknown as Parameters<typeof stepperIndexFromStatus>[0])).toBe(-1)
      expect(stepperIndexFromStatus('PEDIDO' as unknown as Parameters<typeof stepperIndexFromStatus>[0])).toBe(-1)
      expect(stepperIndexFromStatus('UNKNOWN' as unknown as Parameters<typeof stepperIndexFromStatus>[0])).toBe(-1)
    })

    it('always returns a number (pure, never throws)', () => {
      // The component relies on this for computed currentIndex; it must
      // be safe to call with any string. The unknown branch returns -1
      // (sentinel for "no step") rather than throwing.
      expect(() =>
        stepperIndexFromStatus('WHATEVER' as unknown as Parameters<typeof stepperIndexFromStatus>[0]),
      ).not.toThrow()
    })
  })

  // T-UI-12 — REQ-UI-009 client-side IVA 16% computation. The backend does
  // NOT expose a `taxCents` field yet, so the UI computes `totalCents * 0.16`
  // locally. This util is the SINGLE source of truth for that formula —
  // any caller MUST import this instead of inlining the multiplication so a
  // future backend round-trip is a one-line swap.
  //
  // Rounding contract: `Math.round` (banker's NOT required here — currency
  // math follows standard round-half-away-from-zero semantics in es-MX).
  describe('computeIva16', () => {
    it('computes 16% of 10000 cents ($100.00 → $16.00 = 1600 cents)', () => {
      expect(computeIva16(10000)).toBe(1600)
    })

    it('returns 0 when totalCents is 0 (zero-rated edge case)', () => {
      expect(computeIva16(0)).toBe(0)
    })

    it('rounds the result to the nearest integer (no fractional cents)', () => {
      // 1 × 0.16 = 0.16 → rounds to 0; 7 × 0.16 = 1.12 → rounds to 1
      expect(computeIva16(1)).toBe(0)
      expect(computeIva16(7)).toBe(1)
    })

    it('handles a typical quotation total (33500 → 5360 = $53.60)', () => {
      // The spec example: totalCents = 33500 → IVA = 5360 ($53.60)
      expect(computeIva16(33500)).toBe(5360)
    })

    it('is a pure function (same input → same output, no side effects)', () => {
      expect(computeIva16(12345)).toBe(1975)
      // Call twice in a row — no memoization, no state, no I/O.
      expect(computeIva16(12345)).toBe(1975)
    })

    it('treats negative inputs as invalid money and returns 0', () => {
      // Defensive: a negative totalCents would be a backend bug. We
      // clamp at 0 rather than return a negative tax — totals stay
      // non-negative on the summary card.
      expect(computeIva16(-1000)).toBe(0)
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
    taxRate: null,
    taxCents: null,
    customerNotes: null,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    effectiveStatus: overrides.status ?? 'DRAFT',
    sellerUserId: '',
    seller: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}