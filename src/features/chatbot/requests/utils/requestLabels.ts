/**
 * es-MX copy of the chatbot request inbox. Taken from design/chatbot-requests
 * (_src/data.js, parts.js, detail.js). Labels only: nothing here computes SLA thresholds.
 */
import type {
  ChatbotComplaintOutcome,
  ChatbotRequestAuditType,
  ChatbotRequestCancelReason,
  ChatbotRequestDisplayStatus,
  ChatbotRequestMergedInto,
  ChatbotRequestRow,
  ChatbotRequestSlaLevel,
  ChatbotRequestStaffCancelReason,
  ChatbotRequestSubtype,
} from '../interfaces/chatbot-request.types'

export const SUBTYPE_LABELS: Record<ChatbotRequestSubtype, string> = {
  RESTOCK: 'Reposición',
  EXPIRATION: 'Caducidad',
  DELIVERY_ZONE: 'Zona de entrega',
  TRANSFER_RECEIPT: 'Comprobante',
  TALK_TO_HUMAN: 'Hablar con una persona',
  COMPLAINT: 'Queja',
  UNKNOWN_QUESTION: 'Pregunta del bot',
  DISCOUNT: 'Descuento',
}

/** Lucide names (Nuxt UI `i-lucide-*`) matching the design's subtype icons. */
export const SUBTYPE_ICONS: Record<ChatbotRequestSubtype, string> = {
  RESTOCK: 'i-lucide-package',
  EXPIRATION: 'i-lucide-calendar',
  DELIVERY_ZONE: 'i-lucide-map-pin',
  TRANSFER_RECEIPT: 'i-lucide-receipt',
  TALK_TO_HUMAN: 'i-lucide-message-square',
  COMPLAINT: 'i-lucide-triangle-alert',
  UNKNOWN_QUESTION: 'i-lucide-circle-help',
  DISCOUNT: 'i-lucide-receipt',
}

export const DISPLAY_STATUS_LABELS: Record<ChatbotRequestDisplayStatus, string> = {
  NEW: 'Nueva',
  IN_PROGRESS: 'En atención',
  RESOLVED: 'Resuelta',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
}

/** Classification of a finished complaint (handoff 20 §4); stored only, nothing is triggered. */
export const COMPLAINT_OUTCOME_LABELS: Record<ChatbotComplaintOutcome, string> = {
  RETURN: 'Devolución',
  REPLACEMENT: 'Reemplazo',
  REFUND: 'Reembolso',
  NO_ACTION: 'Sin acción',
}

/** `null` for a missing or unknown outcome: never print the raw code. */
export function complaintOutcomeLabel(outcome: unknown): string | null {
  return typeof outcome === 'string' ? (COMPLAINT_OUTCOME_LABELS[outcome as ChatbotComplaintOutcome] ?? null) : null
}

export const SLA_LEVEL_LABELS: Record<ChatbotRequestSlaLevel, string> = {
  OK: 'A tiempo',
  HALF: 'Pasó la mitad del tiempo',
  ESCALATION: 'Cerca de vencer',
  OVERDUE: 'Vencida',
}

export const CANCEL_REASON_LABELS: Record<ChatbotRequestCancelReason, string> = {
  CUSTOMER_WITHDREW: 'El cliente la retiró',
  SUPERSEDED: 'Unida con otra solicitud',
  AUTO_RESOLVED: 'El chatbot la cerró solo',
  STAFF: 'Cancelada por el personal',
}

export const STAFF_CANCEL_REASON_LABELS: Record<ChatbotRequestStaffCancelReason, string> = {
  DUPLICATE: 'Duplicada',
  NOT_ACTIONABLE: 'No se puede atender',
  CUSTOMER_UNREACHABLE: 'El cliente no responde',
  OTHER: 'Otro motivo',
}

/** Why a closed row closed; `null` for open and resolved rows (and a cancelled one with no cause). */
export function cancelCauseLabel(
  row: Pick<ChatbotRequestRow, 'cancelReason' | 'staffCancelReason'> & {
    mergedInto: ChatbotRequestMergedInto | null
  },
): string | null {
  switch (row.cancelReason) {
    case null:
      return null
    case 'STAFF':
      return row.staffCancelReason
        ? `${CANCEL_REASON_LABELS.STAFF} · ${STAFF_CANCEL_REASON_LABELS[row.staffCancelReason]}`
        : CANCEL_REASON_LABELS.STAFF
    case 'SUPERSEDED':
      return row.mergedInto ? `Unida con ${row.mergedInto.folio}` : CANCEL_REASON_LABELS.SUPERSEDED
    default:
      return CANCEL_REASON_LABELS[row.cancelReason] ?? null
  }
}

export const AUDIT_TYPE_LABELS: Record<ChatbotRequestAuditType, string> = {
  CREATED: 'Solicitud creada',
  MERGED: 'Unida con otra solicitud',
  CLAIMED: 'Tomada',
  RELEASED: 'Liberada',
  AUTO_RELEASED: 'Liberada automáticamente',
  REASSIGNED: 'Reasignada',
  RESOLVED: 'Resuelta',
  REPLIED: 'Respuesta enviada',
  TEMPLATE_SENT: 'Plantilla enviada',
  FINISHED: 'Conversación terminada',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reagendada',
  CUSTOMER_LINKED: 'Cliente vinculado',
  SLA_MILESTONE: 'Hito del tiempo límite',
  DELIVERY_OUTCOME: 'Resultado de la entrega al cliente',
}

const SLA_MILESTONE_LABELS: Record<string, string> = {
  HALF: 'Pasó la mitad del tiempo',
  ESCALATION: 'Cerca de vencer',
  OVERDUE: 'Venció',
}

const GENERIC_AUDIT_LABEL = 'Evento de la solicitud'

/**
 * Line of one audit event. SLA_MILESTONE reads by its milestone (OVERDUE → «Venció»); a type the
 * FE does not know yet (a later unit adds events) gets a generic line, never the raw code.
 */
export function auditEventLabel(type: string, data?: unknown): string {
  if (type === 'SLA_MILESTONE') {
    const milestone = (data as { milestone?: unknown } | null | undefined)?.milestone
    if (typeof milestone === 'string' && SLA_MILESTONE_LABELS[milestone]) {
      return SLA_MILESTONE_LABELS[milestone]!
    }
  }
  return AUDIT_TYPE_LABELS[type as ChatbotRequestAuditType] ?? GENERIC_AUDIT_LABEL
}

/** `intoFolio` / `sourceFolio` of a MERGED event are numbers: `S-000123`. */
export function formatFolioNumber(folio: number): string {
  return `S-${String(folio).padStart(6, '0')}`
}

const WINDOW_TAG_MINUTES = 120

function duration(minutes: number): string {
  const total = Math.max(1, Math.round(minutes))
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/**
 * «Ventana de 24 h cierra en …» only while the WhatsApp window closes within 2 h. This is a display
 * threshold of the row/header tag only: the inbox filter «Ventana por cerrar» and its count follow the
 * branch's `windowWarningMinutes` on the server, which the rows do not expose, so the two can differ.
 */
/**
 * «Ventana de 24 h cierra en …». When the backend sends `windowClosingSoon` (handoff 14 §16, computed
 * with the branch windowWarningMinutes like the filter), it decides whether to show the tag; without it
 * (older backend) the fixed 120-minute threshold applies. The countdown itself is always local.
 */
export function windowClosingTag(
  whatsappWindowClosesAt: string | null,
  now: Date = new Date(),
  windowClosingSoon?: boolean,
): string | null {
  if (!whatsappWindowClosesAt) return null
  const closesAt = new Date(whatsappWindowClosesAt).getTime()
  if (Number.isNaN(closesAt)) return null
  const minutes = (closesAt - now.getTime()) / 60_000
  if (minutes <= 0) return null
  if (windowClosingSoon === false) return null
  if (windowClosingSoon === undefined && minutes > WINDOW_TAG_MINUTES) return null
  return `Ventana de 24 h cierra en ${duration(minutes)}`
}

export interface WhenOptions {
  /** IANA zone used for display; defaults to the runtime zone. */
  timeZone?: string
  /** Injected "current" instant (tests); defaults to `new Date()`. */
  now?: Date
}

function clockParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? '').replace(/\.$/, '')
  return {
    weekday: part('weekday'),
    day: Number(part('day')),
    month: part('month'),
    year: Number(part('year')),
    time: `${Number(part('hour'))}:${part('minute')}`,
  }
}

function dayNumber(date: Date, timeZone?: string): number {
  const iso = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(date)
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / 86_400_000
}

/** «mar 10:30» — weekday and time of a scheduled conversation. `null` for an invalid date. */
export function formatScheduledFor(iso: string | null, options: WhenOptions = {}): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const { weekday, time } = clockParts(date, options.timeZone)
  return `${weekday} ${time}`
}

/** «hoy 9:00», «mañana 9:00», «ayer 9:00» or «jue 12 nov 9:00» (`slaResumesAt`). `null` for an invalid date. */
export function formatWhen(iso: string | null, options: WhenOptions = {}): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const { weekday, day, month, time } = clockParts(date, options.timeZone)
  const diff = dayNumber(date, options.timeZone) - dayNumber(options.now ?? new Date(), options.timeZone)
  if (diff === 0) return `hoy ${time}`
  if (diff === 1) return `mañana ${time}`
  if (diff === -1) return `ayer ${time}`
  return `${weekday} ${day} ${month} ${time}`
}

/**
 * «Disponible desde …»: only the time («9:25», no zero padding like the rest of the app) when the
 * instant is today in the display zone, the named day otherwise («mañana 9:25», «lun 16 nov 9:55»).
 * `null` for an absent or invalid date.
 */
export function formatAvailableFrom(iso: string | null | undefined, options: WhenOptions = {}): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  if (dayNumber(date, options.timeZone) === dayNumber(options.now ?? new Date(), options.timeZone)) {
    return clockParts(date, options.timeZone).time
  }
  return formatWhen(iso, options)
}
