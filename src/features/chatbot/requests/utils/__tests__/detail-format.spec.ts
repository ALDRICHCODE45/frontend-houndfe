import { describe, expect, it } from 'vitest'
import {
  ACTION_ICONS,
  ACTION_LABELS,
  auditActorLabel,
  auditEventDetail,
  auditEventTone,
  contextEntries,
  deliveryOutcomeLabel,
  formatDate,
  formatMoney,
  orderStatusLabel,
  previewStatusLabel,
  resolutionActionLabel,
  safeUrl,
  zoneImpactText,
} from '../detail-format'
import type { ChatbotRequestAuditItem } from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'

function audit(type: string, data: unknown, actor: Partial<ChatbotRequestAuditItem['actor']> = {}) {
  return {
    id: `${type}-1`,
    type,
    createdAt: '2026-11-11T17:00:00.000Z',
    actor: { kind: 'USER', id: 'u-1', displayName: 'Laura Méndez', ...actor },
    fromStatus: null,
    toStatus: null,
    version: 2,
    data,
  } as unknown as ChatbotRequestAuditItem
}

describe('formatMoney / formatDate', () => {
  it('formats integer cents as MXN and a missing amount as a dash', () => {
    expect(formatMoney(184000)).toBe('$1,840.00')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(null)).toBe('—')
  })

  it('formats a date as «2 mar 2025» in the given zone and null for missing or invalid input', () => {
    expect(formatDate('2025-03-02T10:00:00.000Z', TZ)).toBe('2 mar 2025')
    expect(formatDate(null, TZ)).toBeNull()
    expect(formatDate('not a date', TZ)).toBeNull()
  })
})

describe('contextEntries — flat bot context as plain text', () => {
  it('maps the known keys to es-MX labels in a stable order', () => {
    const entries = contextEntries({
      quantity: 6,
      cartRef: 'cart-9',
      saleId: 'sale-1',
      orderId: 'order-2',
      productIds: ['p1', 'p2'],
      variantIds: ['v1'],
    })
    expect(entries.map((e) => [e.label, e.value])).toEqual([
      ['Carrito', 'cart-9'],
      ['Venta', 'sale-1'],
      ['Pedido', 'order-2'],
      ['Productos', '2 productos'],
      ['Variantes', '1 variante'],
      ['Cantidad', '6'],
    ])
  })

  it('keeps the ids in the title of the list entries and never renders them as markup', () => {
    const [entry] = contextEntries({ productIds: ['<b>p1</b>', 'p2'] })
    expect(entry!.title).toBe('<b>p1</b>, p2')
  })

  it('ignores null, empty, unknown and wrongly typed values without throwing', () => {
    expect(contextEntries(null)).toEqual([])
    expect(contextEntries({})).toEqual([])
    expect(
      contextEntries({
        cartRef: '',
        saleId: 12,
        productIds: 'p1',
        variantIds: [],
        quantity: Number.NaN,
        mystery: 'x',
      } as never),
    ).toEqual([])
  })
})

describe('orderStatusLabel', () => {
  it.each([
    ['CANCELED', 'REFUNDED', 'Cancelado'],
    ['CONFIRMED', 'PAID', 'Pagado'],
    ['CONFIRMED', 'REFUNDED', 'Reembolsado'],
    ['CONFIRMED', 'PENDING', 'Pago pendiente'],
    ['CONFIRMED', 'PARTIAL', 'Pago pendiente'],
  ])('%s + %s → %s', (status, payment, label) => {
    expect(orderStatusLabel(status, payment)).toBe(label)
  })
})

describe('zoneImpactText', () => {
  it('says how many requests and customers resolving settles', () => {
    expect(zoneImpactText({ requests: 4, customers: 3 })).toBe('Esto resolverá 4 solicitudes de 3 clientes')
    expect(zoneImpactText({ requests: 1, customers: 1 })).toBe('Esto resolverá 1 solicitud de 1 cliente')
  })
})

describe('labels for resolutions, deliveries and previews', () => {
  it('names every resolve action and falls back to null for an unknown one', () => {
    expect(resolutionActionLabel('PROVIDE_RESTOCK_ESTIMATE')).toBe('Dio un estimado de reposición')
    expect(resolutionActionLabel('REPORT_RESTOCK_ESTIMATE_UNAVAILABLE')).toBe('Avisó que no hay estimado')
    expect(resolutionActionLabel('PROVIDE_EXPIRATION_TEXT')).toBe('Indicó la caducidad')
    expect(resolutionActionLabel('REPORT_EXPIRATION_UNAVAILABLE')).toBe('Avisó que no tiene la fecha')
    expect(resolutionActionLabel('APPROVE_DELIVERY_ZONE')).toBe('Aprobó la zona')
    expect(resolutionActionLabel('REJECT_DELIVERY_ZONE')).toBe('Rechazó la zona')
    expect(resolutionActionLabel('CONFIRM_RECEIPT')).toBe('Confirmó el comprobante')
    expect(resolutionActionLabel('REJECT_RECEIPT')).toBe('Rechazó el comprobante')
    expect(resolutionActionLabel('SIBLING_RESOLVED')).toBe('Se resolvió al resolver otra del mismo código postal')
    expect(resolutionActionLabel('SOMETHING_NEW')).toBeNull()
  })

  it('names the delivery outcomes and never prints a raw code', () => {
    expect(deliveryOutcomeLabel('PROVIDER_ACCEPTED')).toBe('Entregada al proveedor')
    expect(deliveryOutcomeLabel('DELIVERY_UNKNOWN')).toBe('Entrega dudosa')
    expect(deliveryOutcomeLabel('PENDING')).toBe('Pendiente')
    expect(deliveryOutcomeLabel('DEFERRED_WINDOW_CLOSED')).toBe('Diferida: la ventana de 24 h está cerrada')
    expect(deliveryOutcomeLabel('DEFERRED_HUMAN_SESSION')).toBe('Diferida: la atiende una persona')
    expect(deliveryOutcomeLabel('STALE')).toBe('Ya no aplica')
    expect(deliveryOutcomeLabel('FUTURE_OUTCOME')).toBe('Estado de entrega desconocido')
  })

  it('names the preview status and treats an unknown one as unavailable', () => {
    expect(previewStatusLabel('READY')).toBe('Vista previa lista')
    expect(previewStatusLabel('PENDING')).toBe('Generando la vista previa')
    expect(previewStatusLabel('FAILED')).toBe('No se pudo generar la vista previa')
    expect(previewStatusLabel('???')).toBe('Vista previa no disponible')
  })

  it('has a label for the actions of the panel', () => {
    expect(ACTION_LABELS.CLAIM).toBe('Atender')
    expect(ACTION_LABELS.RESOLVE).toBe('Resolver…')
    expect(ACTION_LABELS.CANCEL).toBe('Cancelar solicitud…')
  })

  it('labels and icons every action of the vocabulary, including the replies and live ones (T7a)', () => {
    expect(ACTION_LABELS.REPLY).toBe('Responder…')
    expect(ACTION_LABELS.FINISH).toBe('Finalizar conversación…')
    expect(ACTION_LABELS.FINISH_IDLE).toBe('Finalizar conversación…')
    expect(ACTION_LABELS.SEND_MESSAGE).toBe('Enviar mensaje')
    expect(ACTION_LABELS.SEND_TEMPLATE).toBe('Enviar plantilla…')
    for (const action of ['REPLY', 'SEND_MESSAGE', 'SEND_TEMPLATE', 'FINISH', 'FINISH_IDLE'] as const) {
      expect(ACTION_ICONS[action]).toMatch(/^i-lucide-/)
    }
  })
})

describe('safeUrl', () => {
  it('keeps http(s) and relative URLs', () => {
    expect(safeUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(safeUrl('/files/a.jpg')).toBe('/files/a.jpg')
  })

  it('rejects script and data URLs, empty and missing values', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>1</script>')).toBeNull()
    expect(safeUrl('')).toBeNull()
    expect(safeUrl(null)).toBeNull()
  })
})

describe('audit lines', () => {
  it('names the actor: the person, «ti», the system or the bot', () => {
    expect(auditActorLabel(audit('CLAIMED', {}).actor)).toBe('Laura Méndez')
    expect(auditActorLabel(audit('CLAIMED', {}).actor, 'u-1')).toBe('ti')
    expect(auditActorLabel({ kind: 'SYSTEM', id: null, displayName: null })).toBe('Sistema')
    expect(auditActorLabel({ kind: 'SERVICE', id: 's', displayName: null })).toBe('Chatbot')
    expect(auditActorLabel({ kind: 'USER', id: 'u-9', displayName: null })).toBe('Alguien del equipo')
  })

  it('details reassignments, releases and merges', () => {
    expect(
      auditEventDetail(
        audit('REASSIGNED', {
          fromUser: { id: 'a', displayName: 'Ana' },
          toUser: { id: 'b', displayName: 'Luis' },
          note: 'Es de su zona',
        }),
      ),
    ).toBe('De Ana a Luis · nota: «Es de su zona»')
    expect(auditEventDetail(audit('RELEASED', { previousAssignee: { id: 'a', displayName: 'Ana' } }))).toBe(
      'La tenía Ana',
    )
    expect(auditEventDetail(audit('MERGED', { role: 'SOURCE', intoRequestId: 'r', intoFolio: 123 }))).toBe(
      'Se unió con S-000123',
    )
    expect(auditEventDetail(audit('MERGED', { role: 'TARGET', sourceRequestId: 'r', sourceFolio: 7 }))).toBe(
      'Se unió S-000007 a esta',
    )
  })

  it('details resolutions, cancellations (with the customer message) and milestones', () => {
    expect(auditEventDetail(audit('RESOLVED', { action: 'APPROVE_DELIVERY_ZONE' }))).toBe('Aprobó la zona')
    expect(auditEventDetail(audit('RESOLVED', { action: 'CONFIRM_RECEIPT', via: 'LEGACY_ROUTE' }))).toBe(
      'Confirmó el comprobante · desde la pantalla anterior',
    )
    expect(
      auditEventDetail(
        audit('CANCELLED', { reason: 'OTHER', note: 'Pidió otra cosa', customerNote: 'Gracias por escribir' }),
      ),
    ).toBe('Otro motivo · nota: «Pidió otra cosa» · mensaje al cliente: «Gracias por escribir»')
    expect(auditEventDetail(audit('CANCELLED', { reason: 'CUSTOMER_WITHDREW' }))).toBe('El cliente la retiró')
    expect(auditEventDetail(audit('SLA_MILESTONE', { milestone: 'HALF', clock: 'CLAIM' }))).toBe(
      'Tiempo para tomarla',
    )
    expect(auditEventDetail(audit('SLA_MILESTONE', { milestone: 'OVERDUE', clock: 'RESOLVE' }))).toBe(
      'Tiempo para resolverla',
    )
    expect(auditEventDetail(audit('DELIVERY_OUTCOME', { outcome: 'DELIVERY_UNKNOWN' }))).toBe('Entrega dudosa')
  })

  it('has no detail for plain events, unknown types or garbage data', () => {
    expect(auditEventDetail(audit('CLAIMED', {}))).toBeNull()
    expect(auditEventDetail(audit('CREATED', { subtype: 'RESTOCK' }))).toBeNull()
    expect(auditEventDetail(audit('FROM_THE_FUTURE', { anything: 1 }))).toBeNull()
    expect(auditEventDetail(audit('REASSIGNED', null))).toBeNull()
    expect(auditEventDetail(audit('MERGED', 'oops'))).toBeNull()
  })

  it('marks overdue milestones as bad and resolutions as done', () => {
    expect(auditEventTone(audit('SLA_MILESTONE', { milestone: 'OVERDUE' }))).toBe('bad')
    expect(auditEventTone(audit('SLA_MILESTONE', { milestone: 'HALF' }))).toBe('default')
    expect(auditEventTone(audit('RESOLVED', { action: 'CONFIRM_RECEIPT' }))).toBe('done')
    expect(auditEventTone(audit('CLAIMED', {}))).toBe('default')
  })
})
