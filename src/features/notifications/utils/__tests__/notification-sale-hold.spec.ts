import { describe, expect, it } from 'vitest'
import type { NotificationItem, NotificationType } from '../../interfaces/notifications.types'
import {
  notificationMeta,
  notificationRef,
  notificationSalePath,
  notificationTargetPath,
  isClosedNotice,
  SALE_HOLD_REVIEW_BODY_REASONS,
  SALE_HOLD_REVIEW_TITLE,
} from '../notification-format'

// BE handoff 24 §5: SALE_HOLD_REVIEW and the additive `saleId` on every notification.
const review: NotificationItem = {
  id: 'n-1',
  type: 'SALE_HOLD_REVIEW',
  title: 'Apartado vencido: revisa la venta',
  body: 'Venta W-000042 · Comprobante pendiente de revisar',
  requestId: null,
  saleId: '8c1d',
  folio: 'W-000042',
  subtype: null,
  cause: null,
  reason: null,
  requestOpen: null,
  level: null,
  createdAt: '2026-11-19T18:30:05.000Z',
  readAt: null,
}

describe('SALE_HOLD_REVIEW', () => {
  it('is a known notification type', () => {
    const type: NotificationType = 'SALE_HOLD_REVIEW'
    expect(type).toBe(review.type)
  })

  it('has its own label, warning tone and icon', () => {
    expect(notificationMeta('SALE_HOLD_REVIEW')).toEqual({
      icon: 'i-lucide-hourglass',
      tone: 'warning',
      label: 'Apartado vencido',
    })
  })

  it('keeps the contract copy', () => {
    expect(SALE_HOLD_REVIEW_TITLE).toBe('Apartado vencido: revisa la venta')
    expect(SALE_HOLD_REVIEW_BODY_REASONS).toEqual({
      PARTIAL_PAYMENT: 'Tiene un pago registrado',
      PENDING_RECEIPT: 'Comprobante pendiente de revisar',
    })
  })

  it('does not repeat the folio the body already shows and is never a closed request', () => {
    expect(notificationRef(review)).toBeNull()
    expect(isClosedNotice(review)).toBe(false)
  })
})

describe('notificationSalePath / notificationTargetPath', () => {
  it('links a sale notice to the sale detail', () => {
    expect(notificationSalePath('8c1d')).toBe('/pos/ventas/8c1d')
    expect(notificationSalePath('a/b')).toBe('/pos/ventas/a%2Fb')
    expect(notificationSalePath(null)).toBeNull()
    expect(notificationSalePath(undefined)).toBeNull()
    expect(notificationTargetPath(review)).toBe('/pos/ventas/8c1d')
  })

  it('keeps request notices on the request (saleId null or absent)', () => {
    expect(notificationTargetPath({ requestId: 'r1', saleId: null })).toBe('/chatbot/solicitudes/r1')
    expect(notificationTargetPath({ requestId: 'r1' })).toBe('/chatbot/solicitudes/r1')
  })

  it('has no target without a request or a sale', () => {
    expect(notificationTargetPath({ requestId: null, saleId: null })).toBeNull()
  })
})
