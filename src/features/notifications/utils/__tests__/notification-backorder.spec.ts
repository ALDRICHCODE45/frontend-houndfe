import { describe, expect, it } from 'vitest'
import type { NotificationItem, NotificationType } from '../../interfaces/notifications.types'
import {
  BACKORDER_NOTICE_COPY,
  isClosedNotice,
  notificationBackorderPath,
  notificationMeta,
  notificationTargetPath,
} from '../notification-format'

// ODD restock-backorder S8 / L11: BACKORDER_* notices and the additive `backorderId`
// (null on every other notice).
const reserved: NotificationItem = {
  id: 'n-1',
  type: 'BACKORDER_RESERVED',
  title: 'Pedido por reposición apartado',
  body: 'BO-000012 · Rosa tiene 24 h para confirmar',
  requestId: null,
  saleId: null,
  backorderId: 'bo-12',
  createdAt: '2026-11-20T18:30:05.000Z',
  readAt: null,
}

describe('BACKORDER_* notification types', () => {
  it('are known notification types', () => {
    const types: NotificationType[] = ['BACKORDER_RESERVED', 'BACKORDER_EXPIRED', 'BACKORDER_NOTICE_UNDELIVERED']
    expect(types).toHaveLength(3)
  })

  it.each([
    ['BACKORDER_RESERVED', 'Pedido apartado', 'info'],
    ['BACKORDER_EXPIRED', 'Pedido vencido', 'neutral'],
    ['BACKORDER_NOTICE_UNDELIVERED', 'Avisar al cliente', 'warning'],
  ])('%s has the label «%s» and tone %s', (type, label, tone) => {
    const meta = notificationMeta(type)
    expect(meta.label).toBe(label)
    expect(meta.tone).toBe(tone)
    expect(meta.icon).toMatch(/^i-lucide-/)
    expect(meta.label).not.toBe('Aviso')
  })

  it('never uses the danger tone for a pending notice', () => {
    for (const type of ['BACKORDER_RESERVED', 'BACKORDER_EXPIRED', 'BACKORDER_NOTICE_UNDELIVERED']) {
      expect(notificationMeta(type).tone).not.toBe('danger')
    }
  })

  it('each type has its own icon', () => {
    const icons = ['BACKORDER_RESERVED', 'BACKORDER_EXPIRED', 'BACKORDER_NOTICE_UNDELIVERED'].map(
      (type) => notificationMeta(type).icon,
    )
    expect(new Set(icons).size).toBe(3)
  })

  it('keeps the Spanish copy (the server sends it; kept for tests and fallbacks)', () => {
    expect(BACKORDER_NOTICE_COPY.BACKORDER_RESERVED).toEqual({
      title: 'Pedido por reposición apartado',
      description: 'El cliente tiene 24 h para confirmarlo.',
    })
    expect(BACKORDER_NOTICE_COPY.BACKORDER_EXPIRED).toEqual({
      title: 'Pedido por reposición vencido',
      description: 'Las unidades pasaron al siguiente en la fila.',
    })
    expect(BACKORDER_NOTICE_COPY.BACKORDER_NOTICE_UNDELIVERED).toEqual({
      title: 'No se pudo avisar al cliente',
      description: 'Llámale para avisarle de su pedido por reposición.',
    })
  })

  it('is never a closed request', () => {
    expect(isClosedNotice(reserved)).toBe(false)
  })
})

describe('notificationBackorderPath / notificationTargetPath', () => {
  it.each(['BACKORDER_RESERVED', 'BACKORDER_EXPIRED', 'BACKORDER_NOTICE_UNDELIVERED'])(
    '%s opens the backorder detail',
    (type) => {
      expect(notificationTargetPath({ ...reserved, type })).toBe('/pos/pedidos-reposicion/bo-12')
    },
  )

  it('encodes the id', () => {
    expect(notificationBackorderPath('a/b c')).toBe('/pos/pedidos-reposicion/a%2Fb%20c')
    expect(notificationTargetPath({ requestId: null, backorderId: 'a/b' })).toBe('/pos/pedidos-reposicion/a%2Fb')
  })

  it('has no backorder path without an id', () => {
    expect(notificationBackorderPath(null)).toBeNull()
    expect(notificationBackorderPath(undefined)).toBeNull()
    expect(notificationBackorderPath('')).toBeNull()
  })

  it('wins over the sale and the request', () => {
    expect(notificationTargetPath({ requestId: 'r1', saleId: 's1', backorderId: 'bo-1' })).toBe(
      '/pos/pedidos-reposicion/bo-1',
    )
  })

  it('falls back to sale, then request, when backorderId is null or absent', () => {
    expect(notificationTargetPath({ requestId: 'r1', saleId: 's1', backorderId: null })).toBe('/pos/ventas/s1')
    expect(notificationTargetPath({ requestId: 'r1', saleId: 's1' })).toBe('/pos/ventas/s1')
    expect(notificationTargetPath({ requestId: 'r1', saleId: null, backorderId: null })).toBe('/chatbot/solicitudes/r1')
    expect(notificationTargetPath({ requestId: 'r1' })).toBe('/chatbot/solicitudes/r1')
  })

  it('has no target with nothing to open', () => {
    expect(notificationTargetPath({ requestId: null, saleId: null, backorderId: null })).toBeNull()
  })
})
