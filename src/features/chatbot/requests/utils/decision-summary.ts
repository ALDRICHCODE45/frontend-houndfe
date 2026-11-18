/**
 * Summaries derived from the request decision. `needs` stays bot/customer text only (the backend
 * never fills it for DELIVERY_ZONE from /human-decisions nor for TRANSFER_RECEIPT), so the page
 * builds a short Spanish summary from the decision instead, shown as generated. Every field is
 * read defensively: the decision is server JSON and a later backend may leave a part out.
 */
import type {
  ChatbotRequestDecision,
  TransferReceiptDestinationCheck,
  TransferReceiptExtracted,
  TransferReceiptMismatch,
} from '../interfaces/chatbot-request.types'
import { formatDate, formatMoney } from './detail-format'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/** Text within the contract length; longer values break the contract and are dropped. */
function boundedText(value: unknown, max: number): string | null {
  const value_ = text(value)
  return value_ && value_.length <= max ? value_ : null
}

function cents(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** The automatic image reading the bot stored, keeping only well-typed fields; `null` when empty. */
export function readExtracted(value: unknown): TransferReceiptExtracted | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const reading: TransferReceiptExtracted = {}
  const amount = cents(raw.amountCents)
  if (amount !== null) reading.amountCents = amount
  const date = text(raw.date)
  if (date) reading.date = date
  const reference = text(raw.reference)
  if (reference) reading.reference = reference
  const bank = text(raw.bank)
  if (bank) reading.bank = bank
  const confidence = cents(raw.confidence)
  if (confidence !== null && confidence >= 0 && confidence <= 1) reading.confidence = confidence
  const destinationBank = boundedText(raw.destinationBank, 80)
  if (destinationBank) reading.destinationBank = destinationBank
  const destinationName = boundedText(raw.destinationName, 120)
  if (destinationName) reading.destinationName = destinationName
  const last4 = text(raw.destinationAccountLast4)
  if (last4 && /^\d{4}$/.test(last4)) reading.destinationAccountLast4 = last4
  const originName = boundedText(raw.originName, 120)
  if (originName) reading.originName = originName
  return Object.keys(reading).length > 0 ? reading : null
}

/** «$178.00 · BanCoppel · ref. 167050 · 16 nov 2026 · confianza 90 %»; `null` with nothing to show. */
export function extractedReading(value: unknown): string | null {
  const reading = readExtracted(value)
  if (!reading) return null
  // A date-only value is a calendar day: read it in UTC so it never shifts a day back.
  const dateZone = reading.date && /^\d{4}-\d{2}-\d{2}$/.test(reading.date) ? 'UTC' : undefined
  const parts = [
    reading.amountCents !== undefined ? formatMoney(reading.amountCents) : null,
    reading.bank ?? null,
    reading.reference ? `ref. ${reading.reference}` : null,
    reading.date ? formatDate(reading.date, dateZone) : null,
    reading.confidence !== undefined ? `confianza ${Math.round(reading.confidence * 100)} %` : null,
  ].filter((part): part is string => !!part)
  return parts.length ? parts.join(' · ') : null
}

/** «Beneficiario: … · Banco destino: … · Cuenta destino: ****9616» (handoff 22 labels); `null` when unread. */
export function extractedDestination(value: unknown): string | null {
  const reading = readExtracted(value)
  if (!reading) return null
  const parts = [
    reading.destinationName ? `Beneficiario: ${reading.destinationName}` : null,
    reading.destinationBank ? `Banco destino: ${reading.destinationBank}` : null,
    reading.destinationAccountLast4
      ? `Cuenta destino: ****${reading.destinationAccountLast4}`
      : null,
  ].filter((part): part is string => !!part)
  return parts.length ? parts.join(' · ') : null
}

/** «Ordenante: …»; `null` when the bot did not read the payer. */
export function extractedOrigin(value: unknown): string | null {
  const origin = readExtracted(value)?.originName
  return origin ? `Ordenante: ${origin}` : null
}

/** Handoff 22 §2: `match` / `mismatch` pass through; absent, old or any other value is `unknown`. */
export function readDestinationCheck(value: unknown): TransferReceiptDestinationCheck {
  return value === 'match' || value === 'mismatch' ? value : 'unknown'
}

/** Only `mismatch` raises the staff alert; `match` and `unknown` show nothing. */
export function isDestinationMismatch(value: unknown): boolean {
  return readDestinationCheck(value) === 'mismatch'
}

/** The backend sends `{ debtCents, declaredDiffCents?, extractedDiffCents?, flagged } | null`. */
export function isMismatchFlagged(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Partial<TransferReceiptMismatch>).flagged === true
  )
}

/** The summary for an empty `needs`, or `null` for the subtypes that keep the quiet line. */
export function generatedNeeds(decision: ChatbotRequestDecision | null | undefined): string | null {
  if (!decision || typeof decision !== 'object') return null
  if (decision.subtype === 'DELIVERY_ZONE') {
    const zip = text(decision.zipCode)
    const neighborhood = text(decision.neighborhood)
    const place = [
      zip ? `CP ${zip}` : null,
      neighborhood ? `Col. ${neighborhood}` : null,
      text(decision.municipality),
      text(decision.state),
    ].filter((part): part is string => !!part)
    const sentences = place.length ? [`Entrega en ${place.join(', ')}.`] : []
    const count = cents(decision.requesterCount)
    if (count !== null && count >= 1) {
      sentences.push(count === 1 ? 'Lo pidió 1 cliente.' : `Lo pidieron ${count} clientes.`)
    }
    return sentences.length ? sentences.join(' ') : null
  }
  if (decision.subtype === 'TRANSFER_RECEIPT') {
    const folio = text(decision.saleFolio)
    const facts = [
      `total ${formatMoney(decision.saleTotalCents)}`,
      `debe ${formatMoney(decision.saleDebtCents)}`,
    ]
    if (decision.declaredAmountProvided === true && cents(decision.declaredAmountCents) !== null) {
      facts.push(`el cliente declaró ${formatMoney(decision.declaredAmountCents)}`)
    }
    const read = readExtracted(decision.extracted)?.amountCents
    if (read !== undefined) facts.push(`la imagen dice ${formatMoney(read)}`)
    return `Revisar comprobante de la venta${folio ? ` ${folio}` : ''}: ${facts.join(', ')}.`
  }
  return null
}
