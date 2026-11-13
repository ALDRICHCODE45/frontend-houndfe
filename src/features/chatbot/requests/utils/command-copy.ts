/**
 * es-MX copy and classification of what a chatbot request command answers.
 *
 * - `commandNotice`: the ConflictNotice of the design (title, detail, buttons) for typed 409/403/422
 *   states, network and server failures. `null` when the failure only belongs to form fields.
 * - `commandFieldErrors`: what to show under a field for `400` / `422` answers.
 * - `isStateChangingError`: the codes after which the request moved, so the detail is refetched.
 * - `commandSuccessToast`: the toast after a command went through.
 *
 * Everything switches on `code`, never on the backend `message`.
 */
import type { ChatbotRequestAction, ChatbotRequestStaffCancelReason } from '../interfaces/chatbot-request.types'
import { zoneImpactText } from './detail-format'
import { requestErrorMessage, type ChatbotRequestError, type ErrorCopyOptions } from './requestErrors'
import { formatAvailableFrom, formatScheduledFor } from './requestLabels'

export type CommandNoticeAction = 'refresh' | 'retry' | 'dismiss' | 'reconfirm'

export interface CommandNotice {
  title: string
  detail: string
  actions: CommandNoticeAction[]
  /** «Detalle técnico» line: `409 REQUEST_CLAIMED_BY_OTHER`. */
  technical: string
}

/** Form fields a `400` can point at (the backend property names). */
const FIELD_NAMES: ReadonlySet<string> = new Set([
  'note',
  'customerNote',
  'toUserId',
  'reason',
  'customerReason',
  'restockDays',
  'expirationText',
  'zoneType',
  'surchargeCents',
  'etaDays',
  'amountCents',
  'intoRequestId',
  'customerId',
  'text',
  'complaintOutcome',
  'scheduledFor',
])

const FIELD_ONLY_CODES: ReadonlySet<string> = new Set([
  'USER_NOT_ASSIGNABLE',
  'CUSTOMER_PHONE_MISMATCH',
  'COMPLAINT_OUTCOME_REQUIRED',
])

const COMPLAINT_OUTCOME_MESSAGE = 'Elige cómo terminó la queja.'

const STATE_CHANGING_CODES: ReadonlySet<string> = new Set([
  'VERSION_CONFLICT',
  'REQUEST_CLAIMED_BY_OTHER',
  'REQUEST_CLOSED',
  'CANCEL_NOT_ALLOWED',
  'IDEMPOTENCY_CONFLICT',
  'MERGE_NOT_ALLOWED',
  'ZONE_SET_CHANGED',
  'NOT_ASSIGNEE',
  'ACTION_NOT_ALLOWED',
  'NOT_FOUND',
  'SESSION_NOT_ACTIVE',
  'STALE_EPOCH',
  // The request is no longer (re)schedulable or claimable as the screen showed it (handoff 21).
  'RESCHEDULE_NOT_ALLOWED',
  'NOT_SCHEDULED',
  'SCHEDULED_TOO_EARLY',
])

export function isStateChangingError(error: ChatbotRequestError): boolean {
  return error.code !== null && STATE_CHANGING_CODES.has(error.code)
}

/** Network failures and `5xx` keep the attempt: the same key is resent safely. */
export function isRetryableError(error: ChatbotRequestError): boolean {
  return error.status === null || error.status >= 500
}

export function commandFieldErrors(error: ChatbotRequestError): Record<string, string> {
  if (error.code === 'USER_NOT_ASSIGNABLE') return { toUserId: requestErrorMessage(error) }
  if (error.code === 'CUSTOMER_PHONE_MISMATCH') return { customerId: requestErrorMessage(error) }
  if (error.code === 'COMPLAINT_OUTCOME_REQUIRED') return { complaintOutcome: COMPLAINT_OUTCOME_MESSAGE }
  if (error.status !== 400 && error.status !== 422) return {}
  const errors: Record<string, string> = {}
  for (const property of Object.keys(error.fieldErrors)) {
    if (!FIELD_NAMES.has(property)) continue
    errors[property] = property === 'complaintOutcome' ? COMPLAINT_OUTCOME_MESSAGE : 'Revisa este campo.'
  }
  return errors
}

const REFRESH_DETAIL = 'No se aplicó tu acción ni se guardó nada.'

/** `action` is the command that failed: a reply has no reassign override, so its copy differs. */
export function commandNotice(
  error: ChatbotRequestError,
  action?: ChatbotRequestAction | null,
  options: ErrorCopyOptions = {},
): CommandNotice | null {
  const { status, code, current, zoneImpact } = error
  const technical = `${status ?? 'Sin conexión'}${code ? ` ${code}` : ''}`
  const make = (title: string, detail: string, actions: CommandNoticeAction[]): CommandNotice => ({
    title,
    detail,
    actions,
    technical,
  })

  if (isRetryableError(error)) {
    return make('No se pudo confirmar la acción', requestErrorMessage(error), ['retry', 'dismiss'])
  }

  switch (code) {
    case 'REQUEST_CLAIMED_BY_OTHER':
      return make(
        `${current?.claimedBy?.displayName ?? 'Otra persona'} ya tomó esta solicitud`,
        `La atendió mientras la mirabas. ${REFRESH_DETAIL}`,
        ['refresh'],
      )
    case 'VERSION_CONFLICT':
      // A merge whose target moved: the version in `current` is the target's, not this request's.
      if (error.intoRequestId) {
        return make(
          'La solicitud que se queda cambió',
          'La solicitud con la que ibas a unirla cambió mientras la mirabas. No se unió nada; revisa los candidatos y vuelve a intentarlo.',
          ['refresh'],
        )
      }
      return make(
        'La solicitud cambió mientras la mirabas',
        current?.version !== undefined
          ? `Pasó a la versión ${current.version}. No se aplicó tu acción; revisa y vuelve a intentarlo.`
          : requestErrorMessage(error),
        ['refresh'],
      )
    case 'REQUEST_CLOSED':
      return make(
        'Esta solicitud ya se cerró',
        'Otra persona la resolvió o el cliente la canceló. Ya no admite acciones.',
        ['refresh'],
      )
    case 'ZONE_SET_CHANGED':
      return make(
        'Cambiaron los clientes de este código postal',
        zoneImpact
          ? `${zoneImpactText(zoneImpact)}. Revisa y confirma con los datos nuevos.`
          : requestErrorMessage(error),
        ['reconfirm'],
      )
    case 'NOT_ASSIGNEE':
      if (action === 'REPLY') {
        return make(
          current?.claimedBy ? `La atiende ${current.claimedBy.displayName}` : 'La atiende otra persona',
          'Solo quien la atiende puede responder; no hay forma de responder la de otra persona. No se envió nada.',
          ['refresh'],
        )
      }
      return make(
        'Solo quien la atiende puede hacerlo',
        'Para liberar o cancelar la de otra persona hace falta el permiso de reasignar.',
        ['dismiss'],
      )
    case 'INSUFFICIENT_PERMISSIONS':
      return make('No tienes permiso para hacer esto', requestErrorMessage(error), ['dismiss'])
    case 'SCHEDULED_TOO_EARLY': {
      const from = formatAvailableFrom(error.claimableAt, options)
      return make(
        'Todavía no se puede atender',
        from
          ? `Es una conversación agendada. Disponible desde ${from}. ${REFRESH_DETAIL}`
          : `Es una conversación agendada y todavía falta para su hora. ${REFRESH_DETAIL}`,
        ['refresh'],
      )
    }
    case 'SLOT_UNAVAILABLE':
      return make(
        'Ese horario ya no está disponible',
        'Alguien más tomó el último lugar o el horario cambió. Elige uno de la lista actualizada. Se conserva el horario anterior.',
        ['dismiss'],
      )
    case 'RESCHEDULE_NOT_ALLOWED':
      return make(
        'Ya no se puede reagendar',
        `Alguien la tomó o la conversación ya empezó, así que la hora ya no importa. No se movió nada. ${REFRESH_DETAIL}`,
        ['refresh'],
      )
    case 'NOT_SCHEDULED':
      return make('Esta solicitud no está agendada', `No tiene una hora reservada que mover. ${REFRESH_DETAIL}`, ['refresh'])
    case 'SCHEDULING_DISABLED':
      return make(
        'El agendado está desactivado',
        'Esta sucursal apagó las conversaciones agendadas, así que ya no se puede reagendar. Pide a un administrador que lo active en Atención del chatbot.',
        ['dismiss'],
      )
    default:
  }

  if (code !== null && FIELD_ONLY_CODES.has(code)) return null
  if (Object.keys(commandFieldErrors(error)).length > 0) return null
  if (isStateChangingError(error)) {
    return make('No se pudo aplicar tu acción', requestErrorMessage(error), ['refresh'])
  }
  return make('No se pudo completar la acción', requestErrorMessage(error), ['dismiss'])
}

// ─── Success ──────────────────────────────────────────────────────────────────

export interface CommandToastContext {
  folio: string
  /** REASSIGN: the new assignee. */
  assignee?: string
  /** CANCEL: the reason and whether a customer message was written. */
  reason?: ChatbotRequestStaffCancelReason
  customerNote?: string
  /** RESOLVE of a zone: the other requests of the postal code that closed with it. */
  siblings?: number
  /** MERGE: the folio that stays. */
  intoFolio?: string
  /** LINK_CUSTOMER: the linked customer. */
  customer?: string
  /** RESCHEDULE: the new time (ISO), the zone to show it in, and `customerNotice.expected` of the answer. */
  scheduledFor?: string
  timeZone?: string
  customerNoticeExpected?: boolean
}

/** The line staff must see after moving a request (handoff 21 §3, S19 Q9). */
export const CUSTOMER_WILL_BE_TOLD = 'Se avisará al cliente de la nueva hora.'
export const CUSTOMER_WILL_NOT_BE_TOLD =
  'El cliente no recibirá aviso de la nueva hora: la ventana de 24 h está cerrada. Avísale por otro medio o cuando escriba.'

export interface CommandToast {
  title: string
  description: string
  /** Only when it should not be the success green (a reschedule that will not reach the customer). */
  color?: 'warning'
}

export function commandSuccessToast(action: ChatbotRequestAction, ctx: CommandToastContext): CommandToast {
  switch (action) {
    case 'CLAIM':
      return { title: 'Solicitud tomada', description: `${ctx.folio} ahora está a tu nombre.` }
    case 'RELEASE':
      return { title: 'Solicitud liberada', description: `${ctx.folio} volvió a Nueva.` }
    case 'REASSIGN':
      return {
        title: 'Solicitud reasignada',
        description: ctx.assignee ? `Ahora la atiende ${ctx.assignee}.` : `${ctx.folio} cambió de responsable.`,
      }
    case 'CANCEL': {
      const sent =
        ctx.reason === 'DUPLICATE'
          ? `${ctx.folio} salió de la bandeja.`
          : ctx.customerNote?.trim()
            ? 'El bot enviará tu mensaje al cliente.'
            : 'El bot enviará su aviso genérico.'
      return { title: 'Solicitud cancelada', description: sent }
    }
    case 'RESOLVE': {
      const siblings = ctx.siblings ?? 0
      return {
        title: 'Solicitud resuelta',
        description:
          siblings > 0
            ? `También se ${siblings === 1 ? 'resolvió 1' : `resolvieron ${siblings}`} del mismo código postal.`
            : `${ctx.folio} salió de la bandeja.`,
      }
    }
    case 'MERGE':
      return {
        title: 'Solicitudes unidas',
        description: ctx.intoFolio ? `${ctx.folio} se unió con ${ctx.intoFolio}.` : `${ctx.folio} se unió con otra solicitud.`,
      }
    case 'REPLY':
      return {
        title: 'Respuesta enviada',
        description: `${ctx.folio} quedó resuelta. El bot se la hará llegar al cliente.`,
      }
    case 'FINISH':
    case 'FINISH_IDLE':
      return { title: 'Conversación finalizada', description: `${ctx.folio} quedó resuelta.` }
    case 'SEND_MESSAGE':
    case 'SEND_TEMPLATE':
      // Live chat sends (T5L) have their own feedback in the thread, not a toast.
      return { title: 'Mensaje enviado', description: `${ctx.folio} · el bot se lo hará llegar al cliente.` }
    case 'RESCHEDULE': {
      const when = formatScheduledFor(ctx.scheduledFor ?? null, { timeZone: ctx.timeZone })
      const lead = when ? `${ctx.folio} quedó para ${when}.` : `${ctx.folio} tiene una nueva hora.`
      if (ctx.customerNoticeExpected === undefined) return { title: 'Conversación reagendada', description: lead }
      return ctx.customerNoticeExpected
        ? { title: 'Conversación reagendada', description: `${lead} ${CUSTOMER_WILL_BE_TOLD}` }
        : { title: 'Conversación reagendada', description: `${lead} ${CUSTOMER_WILL_NOT_BE_TOLD}`, color: 'warning' }
    }
    case 'LINK_CUSTOMER':
      return {
        title: 'Cliente vinculado',
        description: ctx.customer
          ? `${ctx.customer} quedó en esta y otras solicitudes del teléfono.`
          : 'El cliente quedó en esta y otras solicitudes del teléfono.',
      }
  }
}
