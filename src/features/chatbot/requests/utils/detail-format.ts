/**
 * Formatting for the chatbot request detail (T2.U3): plain-text rendering of bot context,
 * es-MX copy for decisions, deliveries and audit lines. Everything here is defensive: the bot,
 * the customer and later backend units can send shapes this version does not know, and none
 * of them may throw or print a raw code. Nothing returns HTML; the views render text only.
 */
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type {
  ChatbotRequestAction,
  ChatbotRequestAuditActor,
  ChatbotRequestAuditItem,
  ChatbotRequestContext,
  ChatbotRequestZoneImpact,
} from '../interfaces/chatbot-request.types'
import {
  CANCEL_REASON_LABELS,
  complaintOutcomeLabel,
  formatFolioNumber,
  STAFF_CANCEL_REASON_LABELS,
} from './requestLabels'

// ─── Numbers and dates ────────────────────────────────────────────────────────

export function formatMoney(cents: number | null | undefined): string {
  return typeof cents === 'number' && Number.isFinite(cents) ? formatCentsMXN(cents) : '—'
}

/** «2 mar 2025». `null` for a missing or invalid date. */
export function formatDate(iso: string | null | undefined, timeZone?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? '').replace(/\.$/, '')
  return `${Number(part('day'))} ${part('month')} ${part('year')}`
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** «Esto resolverá 4 solicitudes de 3 clientes» (zone impact, handoff 12 §zone). */
export function zoneImpactText({
  requests,
  customers,
}: Pick<ChatbotRequestZoneImpact, 'requests' | 'customers'>): string {
  return `Esto resolverá ${plural(requests, 'solicitud', 'solicitudes')} de ${plural(customers, 'cliente', 'clientes')}`
}

// ─── Context (flat, bot-written): plain text ──────────────────────────────────

export interface ContextEntry {
  key: string
  label: string
  value: string
  /** Full list for the id collections (never rendered as markup). */
  title?: string
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function ids(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const list = value.filter((v): v is string => typeof v === 'string' && v.length > 0)
  return list.length > 0 ? list : null
}

export function contextEntries(context: ChatbotRequestContext | null | undefined): ContextEntry[] {
  if (!context || typeof context !== 'object') return []
  const entries: ContextEntry[] = []
  const cartRef = text(context.cartRef)
  if (cartRef) entries.push({ key: 'cartRef', label: 'Carrito', value: cartRef })
  const saleId = text(context.saleId)
  if (saleId) entries.push({ key: 'saleId', label: 'Venta', value: saleId })
  const orderId = text(context.orderId)
  if (orderId) entries.push({ key: 'orderId', label: 'Pedido', value: orderId })
  const products = ids(context.productIds)
  if (products) {
    entries.push({
      key: 'productIds',
      label: 'Productos',
      value: plural(products.length, 'producto', 'productos'),
      title: products.join(', '),
    })
  }
  const variants = ids(context.variantIds)
  if (variants) {
    entries.push({
      key: 'variantIds',
      label: 'Variantes',
      value: plural(variants.length, 'variante', 'variantes'),
      title: variants.join(', '),
    })
  }
  if (typeof context.quantity === 'number' && Number.isFinite(context.quantity)) {
    entries.push({ key: 'quantity', label: 'Cantidad', value: String(context.quantity) })
  }
  return entries
}

// ─── Customer ─────────────────────────────────────────────────────────────────

/** Same reading as the artboard: cancelled wins, then the payment state. */
export function orderStatusLabel(status: string, paymentStatus: string): string {
  if (status === 'CANCELED') return 'Cancelado'
  if (paymentStatus === 'PAID') return 'Pagado'
  if (paymentStatus === 'REFUNDED') return 'Reembolsado'
  return 'Pago pendiente'
}

// ─── Decision, deliveries, files ──────────────────────────────────────────────

const RESOLUTION_LABELS: Record<string, string> = {
  PROVIDE_RESTOCK_ESTIMATE: 'Dio un estimado de reposición',
  REPORT_RESTOCK_ESTIMATE_UNAVAILABLE: 'Avisó que no hay estimado',
  PROVIDE_EXPIRATION_TEXT: 'Indicó la caducidad',
  REPORT_EXPIRATION_UNAVAILABLE: 'Avisó que no tiene la fecha',
  APPROVE_DELIVERY_ZONE: 'Aprobó la zona',
  REJECT_DELIVERY_ZONE: 'Rechazó la zona',
  CONFIRM_RECEIPT: 'Confirmó el comprobante',
  REJECT_RECEIPT: 'Rechazó el comprobante',
  SIBLING_RESOLVED: 'Se resolvió al resolver otra del mismo código postal',
}

export function resolutionActionLabel(action: unknown): string | null {
  return typeof action === 'string' ? (RESOLUTION_LABELS[action] ?? null) : null
}

const DELIVERY_OUTCOME_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PROVIDER_ACCEPTED: 'Entregada al proveedor',
  DELIVERY_UNKNOWN: 'Entrega dudosa',
  DEFERRED_WINDOW_CLOSED: 'Diferida: la ventana de 24 h está cerrada',
  DEFERRED_HUMAN_SESSION: 'Diferida: la atiende una persona',
  STALE: 'Ya no aplica',
}

export function deliveryOutcomeLabel(outcome: unknown): string {
  return (
    (typeof outcome === 'string' ? DELIVERY_OUTCOME_LABELS[outcome] : undefined) ??
    'Estado de entrega desconocido'
  )
}

const REPLY_DELIVERY_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de envío',
  PROVIDER_ACCEPTED: 'Entregada a WhatsApp',
  DEFERRED_WINDOW_CLOSED: 'Pendiente: se enviará cuando el cliente escriba',
  DEFERRED_HUMAN_SESSION: 'Pendiente: se enviará cuando termine la conversación con una persona',
  DELIVERY_UNKNOWN: 'Entrega dudosa: no sabemos si llegó',
  STALE: 'No se envió',
}

/** State of the `request.answered` delivery of a reply (handoff 19 §3). */
export function replyDeliveryLabel(outcome: unknown): string {
  return (
    (typeof outcome === 'string' ? REPLY_DELIVERY_LABELS[outcome] : undefined) ??
    'Estado de entrega desconocido'
  )
}

const PREVIEW_STATUS_LABELS: Record<string, string> = {
  READY: 'Vista previa lista',
  PENDING: 'Generando la vista previa',
  FAILED: 'No se pudo generar la vista previa',
}

export function previewStatusLabel(status: unknown): string {
  return (
    (typeof status === 'string' ? PREVIEW_STATUS_LABELS[status] : undefined) ??
    'Vista previa no disponible'
  )
}

/** A URL from the server that is safe to put in `src` / `href`: http(s) or same-origin relative. */
export function safeUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null
  const value = url.trim()
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export const ACTION_LABELS: Record<ChatbotRequestAction, string> = {
  CLAIM: 'Atender',
  RELEASE: 'Liberar',
  REASSIGN: 'Reasignar…',
  RESOLVE: 'Resolver…',
  REPLY: 'Responder…',
  MERGE: 'Unir con otra…',
  LINK_CUSTOMER: 'Vincular cliente…',
  CANCEL: 'Cancelar solicitud…',
  SEND_MESSAGE: 'Enviar mensaje',
  SEND_TEMPLATE: 'Enviar plantilla…',
  FINISH: 'Finalizar conversación…',
  FINISH_IDLE: 'Finalizar conversación…',
  RESCHEDULE: 'Reagendar…',
}

export const ACTION_ICONS: Record<ChatbotRequestAction, string> = {
  CLAIM: 'i-lucide-user-check',
  RELEASE: 'i-lucide-undo-2',
  REASSIGN: 'i-lucide-arrow-left-right',
  RESOLVE: 'i-lucide-circle-check',
  REPLY: 'i-lucide-reply',
  MERGE: 'i-lucide-merge',
  LINK_CUSTOMER: 'i-lucide-link',
  CANCEL: 'i-lucide-ban',
  SEND_MESSAGE: 'i-lucide-send',
  SEND_TEMPLATE: 'i-lucide-file-text',
  FINISH: 'i-lucide-flag',
  FINISH_IDLE: 'i-lucide-flag',
  RESCHEDULE: 'i-lucide-calendar-clock',
}

// ─── Audit ────────────────────────────────────────────────────────────────────

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function personName(value: unknown): string | null {
  return text(record(value)?.displayName)
}

/** «ti» for the signed-in user, «Sistema» / «Chatbot» for non-people. */
export function auditActorLabel(actor: ChatbotRequestAuditActor, currentUserId?: string | null): string {
  if (actor.kind === 'SYSTEM') return 'Sistema'
  if (actor.kind === 'SERVICE') return 'Chatbot'
  if (actor.id && actor.id === currentUserId) return 'ti'
  return actor.displayName?.trim() || 'Alguien del equipo'
}

function quoted(label: string, value: unknown): string | null {
  const body = text(value)
  return body ? `${label}: «${body}»` : null
}

function join(parts: Array<string | null>): string | null {
  const present = parts.filter((p): p is string => !!p)
  return present.length > 0 ? present.join(' · ') : null
}

/** Second line of an audit event (what the label alone does not say). `null` when there is none. */
export function auditEventDetail(event: ChatbotRequestAuditItem): string | null {
  const data = record(event.data)
  if (!data) return null

  switch (event.type) {
    case 'REASSIGNED': {
      const from = personName(data.fromUser)
      const to = personName(data.toUser)
      return join([from && to ? `De ${from} a ${to}` : null, quoted('nota', data.note)])
    }
    case 'RELEASED': {
      const previous = personName(data.previousAssignee)
      return previous ? `La tenía ${previous}` : null
    }
    case 'MERGED': {
      if (data.role === 'SOURCE' && typeof data.intoFolio === 'number') {
        return `Se unió con ${formatFolioNumber(data.intoFolio)}`
      }
      if (data.role === 'TARGET' && typeof data.sourceFolio === 'number') {
        return `Se unió ${formatFolioNumber(data.sourceFolio)} a esta`
      }
      return null
    }
    case 'RESOLVED':
      return join([
        resolutionActionLabel(data.action),
        data.via === 'LEGACY_ROUTE' ? 'desde la pantalla anterior' : null,
      ])
    case 'CANCELLED': {
      const reason = typeof data.reason === 'string' ? data.reason : null
      const staff = reason ? STAFF_CANCEL_REASON_LABELS[reason as keyof typeof STAFF_CANCEL_REASON_LABELS] : null
      const other = reason ? CANCEL_REASON_LABELS[reason as keyof typeof CANCEL_REASON_LABELS] : null
      return join([
        staff ?? other ?? null,
        quoted('nota', data.note),
        quoted('mensaje al cliente', data.customerNote),
      ])
    }
    case 'FINISHED': {
      const outcome = complaintOutcomeLabel(data.complaintOutcome)
      return join([outcome ? `Resultado de la queja: ${outcome}` : null, quoted('nota', data.note)])
    }
    case 'SLA_MILESTONE':
      if (data.clock === 'CLAIM') return 'Tiempo para tomarla'
      if (data.clock === 'RESOLVE') return 'Tiempo para resolverla'
      return null
    case 'DELIVERY_OUTCOME':
      return typeof data.outcome === 'string' ? deliveryOutcomeLabel(data.outcome) : null
    default:
      return null
  }
}

export type AuditTone = 'default' | 'bad' | 'done'

export function auditEventTone(event: ChatbotRequestAuditItem): AuditTone {
  if (event.type === 'RESOLVED') return 'done'
  if (event.type === 'SLA_MILESTONE' && record(event.data)?.milestone === 'OVERDUE') return 'bad'
  return 'default'
}
