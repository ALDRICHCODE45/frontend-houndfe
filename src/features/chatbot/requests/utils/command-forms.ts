/**
 * Form rules and request bodies of the chatbot request commands (handoffs 11 and 12).
 *
 * Each form keeps its answers as typed text (a draft); `validate*` returns the es-MX message per
 * field (keyed by the backend property, so a `400` field error lands on the same field) and
 * `build*Body` turns a valid draft into the exact body of the contract: trimmed text, blank
 * optional fields left out, and the fields of one action only (the backend answers `400` to any
 * extra or missing key).
 */
import { parseMoneyInput } from '@/core/shared/utils/money-input.utils'
import {
  ETA_MAX_DAYS,
  SURCHARGE_MAX_CENTS,
  etaDaysError,
  zoneTypeUses,
} from '@/features/shipping/delivery-zones/utils/zoneForm'
import type {
  CancelRequestBody,
  ChatbotComplaintOutcome,
  ChatbotRequestStaffCancelReason,
  ChatbotRequestSubtype,
  FinishRequestBody,
  LinkCustomerRequestBody,
  MergeRequestBody,
  ReassignRequestBody,
  ReplyRequestBody,
  ResolveRequestBody,
  ZoneType,
} from '../interfaces/chatbot-request.types'

export type FieldErrors = Record<string, string>

export const NOTE_MAX = 500
export const RESTOCK_DAYS_MIN = 1
export const RESTOCK_DAYS_MAX = 365
export const EXPIRATION_TEXT_MAX = 500
export const RECEIPT_REASON_MAX = 1000
export const RECEIPT_CUSTOMER_REASON_MAX = 300
export const REPLY_MAX = 1500
export const FINISH_NOTE_MAX = 1000

const tooLong = (max: number) => `Máximo ${max} caracteres.`
const text = (value: string) => value.trim()

// ─── Cancel ───────────────────────────────────────────────────────────────────

export interface CancelDraft {
  reason: ChatbotRequestStaffCancelReason
  note: string
  customerNote: string
}

export const emptyCancelDraft = (): CancelDraft => ({
  reason: 'NOT_ACTIONABLE',
  note: '',
  customerNote: '',
})

export function validateCancel(draft: CancelDraft): FieldErrors {
  const errors: FieldErrors = {}
  const note = text(draft.note)
  if (draft.reason === 'OTHER' && note === '') {
    errors.note = 'Con «Otro motivo» la nota interna es obligatoria.'
  } else if (note.length > NOTE_MAX) {
    errors.note = tooLong(NOTE_MAX)
  }
  // The customer message is not sent with DUPLICATE, so it is not judged either.
  if (draft.reason !== 'DUPLICATE' && text(draft.customerNote).length > NOTE_MAX) {
    errors.customerNote = tooLong(NOTE_MAX)
  }
  return errors
}

export function buildCancelBody(draft: CancelDraft, expectedVersion: number): CancelRequestBody {
  const body: CancelRequestBody = { expectedVersion, reason: draft.reason }
  const note = text(draft.note)
  if (note !== '') body.note = note
  const customerNote = text(draft.customerNote)
  if (draft.reason !== 'DUPLICATE' && customerNote !== '') body.customerNote = customerNote
  return body
}

// ─── Reassign, merge, link ────────────────────────────────────────────────────

export interface ReassignDraft {
  toUserId: string
  note: string
}

export const emptyReassignDraft = (): ReassignDraft => ({ toUserId: '', note: '' })

export function validateReassign(draft: ReassignDraft): FieldErrors {
  const errors: FieldErrors = {}
  if (draft.toUserId.trim() === '') errors.toUserId = 'Elige a quién se la pasas.'
  if (text(draft.note).length > NOTE_MAX) errors.note = tooLong(NOTE_MAX)
  return errors
}

export function buildReassignBody(draft: ReassignDraft, expectedVersion: number): ReassignRequestBody {
  const body: ReassignRequestBody = { expectedVersion, toUserId: draft.toUserId.trim() }
  const note = text(draft.note)
  if (note !== '') body.note = note
  return body
}

export function buildMergeBody(
  target: { id: string; version: number },
  expectedVersion: number,
): MergeRequestBody {
  return { expectedVersion, intoRequestId: target.id, intoExpectedVersion: target.version }
}

export function buildLinkBody(customerId: string, expectedVersion: number): LinkCustomerRequestBody {
  return { expectedVersion, customerId }
}

// ─── Reply (handoff 19) ───────────────────────────────────────────────────────

export interface ReplyDraft {
  text: string
}

export const emptyReplyDraft = (): ReplyDraft => ({ text: '' })

/** Characters as the backend counts them: an emoji is one (like WhatsApp). */
const characters = (value: string) => Array.from(value).length

export function validateReply(draft: ReplyDraft): FieldErrors {
  const value = text(draft.text)
  if (value === '') return { text: 'Escribe la respuesta para el cliente.' }
  if (characters(value) > REPLY_MAX) return { text: tooLong(REPLY_MAX) }
  return {}
}

/** Exactly `{expectedVersion, text}`, the text trimmed (line breaks inside stay). */
export function buildReplyBody(draft: ReplyDraft, expectedVersion: number): ReplyRequestBody {
  return { expectedVersion, text: text(draft.text) }
}

// ─── Finish (handoff 20 §4) ───────────────────────────────────────────────────

export const COMPLAINT_OUTCOMES: readonly ChatbotComplaintOutcome[] = [
  'RETURN',
  'REPLACEMENT',
  'REFUND',
  'NO_ACTION',
]

export interface FinishDraft {
  note: string
  /** One of the four, or `''` while nothing is chosen. */
  complaintOutcome: string
}

export const emptyFinishDraft = (): FinishDraft => ({ note: '', complaintOutcome: '' })

const isOutcome = (value: string): value is ChatbotComplaintOutcome =>
  (COMPLAINT_OUTCOMES as readonly string[]).includes(value)

export function validateFinish(subtype: ChatbotRequestSubtype, draft: FinishDraft): FieldErrors {
  const errors: FieldErrors = {}
  const note = text(draft.note)
  if (note === '') errors.note = 'Escribe una nota interna.'
  else if (note.length > FINISH_NOTE_MAX) errors.note = tooLong(FINISH_NOTE_MAX)
  // Only a complaint is classified: the backend ignores the field for any other subtype.
  if (subtype === 'COMPLAINT' && !isOutcome(draft.complaintOutcome)) {
    errors.complaintOutcome = 'Elige cómo terminó la queja.'
  }
  return errors
}

/** `null` for an invalid draft. `complaintOutcome` is sent for a complaint only. */
export function buildFinishBody(
  subtype: ChatbotRequestSubtype,
  draft: FinishDraft,
  expectedVersion: number,
): FinishRequestBody | null {
  if (Object.keys(validateFinish(subtype, draft)).length > 0) return null
  const body: FinishRequestBody = { expectedVersion, note: text(draft.note) }
  if (subtype === 'COMPLAINT' && isOutcome(draft.complaintOutcome)) body.complaintOutcome = draft.complaintOutcome
  return body
}

// ─── Resolve ──────────────────────────────────────────────────────────────────

/**
 * Answers of the resolve form of any subtype. `option` is the radio of the subtype:
 * RESTOCK / EXPIRATION `GIVE | NONE`, DELIVERY_ZONE `APPROVE | REJECT`,
 * TRANSFER_RECEIPT `CONFIRM | REJECT`.
 */
export interface ResolveDraft {
  option: string
  restockDays: string
  expirationText: string
  zoneType: ZoneType
  /** Pesos, as typed. */
  surcharge: string
  etaDays: string
  /** Pesos, as typed. */
  amount: string
  reason: string
  customerReason: string
}

export const emptyResolveDraft = (): ResolveDraft => ({
  option: '',
  restockDays: '',
  expirationText: '',
  zoneType: 'FREE',
  surcharge: '',
  etaDays: '',
  amount: '',
  reason: '',
  customerReason: '',
})

export function defaultResolveOption(subtype: ChatbotRequestSubtype): string {
  switch (subtype) {
    case 'RESTOCK':
    case 'EXPIRATION':
      return 'GIVE'
    case 'DELIVERY_ZONE':
      return 'APPROVE'
    case 'TRANSFER_RECEIPT':
      return 'CONFIRM'
    default:
      return ''
  }
}

const optionOf = (subtype: ChatbotRequestSubtype, draft: ResolveDraft) =>
  draft.option || defaultResolveOption(subtype)

function restockDays(draft: ResolveDraft): number | null {
  const value = text(draft.restockDays)
  if (!/^\d{1,3}$/.test(value)) return null
  const days = Number(value)
  return days >= RESTOCK_DAYS_MIN && days <= RESTOCK_DAYS_MAX ? days : null
}

function etaDays(draft: ResolveDraft): number {
  return Number(text(draft.etaDays))
}

function surchargeCents(draft: ResolveDraft): number | null {
  const parsed = parseMoneyInput(draft.surcharge, { minCents: 1, maxCents: SURCHARGE_MAX_CENTS })
  return 'cents' in parsed ? parsed.cents : null
}

export function validateResolve(subtype: ChatbotRequestSubtype, draft: ResolveDraft): FieldErrors {
  const option = optionOf(subtype, draft)
  const errors: FieldErrors = {}

  if (subtype === 'RESTOCK' && option === 'GIVE' && restockDays(draft) === null) {
    errors.restockDays = `Escribe un número de días entre ${RESTOCK_DAYS_MIN} y ${RESTOCK_DAYS_MAX}.`
  }

  if (subtype === 'EXPIRATION' && option === 'GIVE') {
    const value = text(draft.expirationText)
    if (value === '') errors.expirationText = 'Escribe la caducidad que verá el cliente.'
    else if (value.length > EXPIRATION_TEXT_MAX) errors.expirationText = tooLong(EXPIRATION_TEXT_MAX)
  }

  if (subtype === 'DELIVERY_ZONE' && option === 'APPROVE') {
    const uses = zoneTypeUses(draft.zoneType)
    if (uses.surcharge && surchargeCents(draft) === null) {
      errors.surchargeCents = 'Escribe un cargo mayor a $0.00.'
    }
    if (uses.eta) {
      const error = etaDaysError(draft.etaDays)
      if (error) errors.etaDays = error
    }
  }

  if (subtype === 'TRANSFER_RECEIPT') {
    if (option === 'CONFIRM') {
      if (text(draft.amount) === '') {
        errors.amountCents = 'Escribe el monto recibido.'
      } else {
        const parsed = parseMoneyInput(draft.amount)
        if ('error' in parsed) errors.amountCents = parsed.error
        else if (parsed.cents < 1) errors.amountCents = 'El monto debe ser mayor que $0.00.'
      }
    } else {
      const reason = text(draft.reason)
      if (reason === '') errors.reason = 'Escribe el motivo interno.'
      else if (reason.length > RECEIPT_REASON_MAX) errors.reason = tooLong(RECEIPT_REASON_MAX)
      const customerReason = text(draft.customerReason)
      if (customerReason === '') errors.customerReason = 'El mensaje para el cliente es obligatorio.'
      else if (customerReason.length > RECEIPT_CUSTOMER_REASON_MAX) {
        errors.customerReason = tooLong(RECEIPT_CUSTOMER_REASON_MAX)
      }
    }
  }

  return errors
}

/**
 * The flat body of the chosen action, or `null` when the draft is not valid, the subtype has no
 * resolve form, or a zone action has no `expectedZoneSetVersion` (it is never guessed).
 */
export function buildResolveBody(
  subtype: ChatbotRequestSubtype,
  draft: ResolveDraft,
  expectedVersion: number,
  zoneSetVersion?: number,
): ResolveRequestBody | null {
  const option = optionOf(subtype, draft)
  if (Object.keys(validateResolve(subtype, draft)).length > 0) return null

  switch (subtype) {
    case 'RESTOCK':
      return option === 'GIVE'
        ? { expectedVersion, action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: restockDays(draft)! }
        : { expectedVersion, action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' }
    case 'EXPIRATION':
      return option === 'GIVE'
        ? { expectedVersion, action: 'PROVIDE_EXPIRATION_TEXT', expirationText: text(draft.expirationText) }
        : { expectedVersion, action: 'REPORT_EXPIRATION_UNAVAILABLE' }
    case 'DELIVERY_ZONE': {
      if (zoneSetVersion === undefined) return null
      if (option !== 'APPROVE') {
        return { expectedVersion, action: 'REJECT_DELIVERY_ZONE', expectedZoneSetVersion: zoneSetVersion }
      }
      const uses = zoneTypeUses(draft.zoneType)
      const body: Extract<ResolveRequestBody, { action: 'APPROVE_DELIVERY_ZONE' }> = {
        expectedVersion,
        action: 'APPROVE_DELIVERY_ZONE',
        zoneType: draft.zoneType,
        expectedZoneSetVersion: zoneSetVersion,
      }
      if (uses.surcharge) body.surchargeCents = surchargeCents(draft)!
      if (uses.eta) body.etaDays = Math.min(etaDays(draft), ETA_MAX_DAYS)
      return body
    }
    case 'TRANSFER_RECEIPT': {
      if (option === 'CONFIRM') {
        const parsed = parseMoneyInput(draft.amount)
        return 'cents' in parsed ? { expectedVersion, action: 'CONFIRM_RECEIPT', amountCents: parsed.cents } : null
      }
      return {
        expectedVersion,
        action: 'REJECT_RECEIPT',
        reason: text(draft.reason),
        customerReason: text(draft.customerReason),
      }
    }
    default:
      return null
  }
}
