import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type {
  RefundSettlementMethod,
  RefundSettlementRequest,
} from '@/features/POS/sales/interfaces/refund-settlement.types'

/** The settle form as the user fills it. */
export interface SettlementFormValues {
  /** Typed MXN amount, for example `45.55`. */
  amount: string
  method: RefundSettlementMethod
  reference: string
  /** `null` is «Ahora»; otherwise a `datetime-local` value (`2026-11-05T11:05`, local time). */
  settledAt: string | null
  /** «Registrar como salida de mi caja». */
  useCashSession: boolean
}

export interface SettlementFormErrors {
  amount?: string
  settledAt?: string
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/
/** A comma is accepted only as a thousands separator in groups of three (`1,234.50`). */
const THOUSANDS_PATTERN = /^[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/

/** Read a typed MXN amount (`$1,234.50`, `20`) as integer cents. A comma decimal (`70,55`) is
 * rejected, never read as thousands: that would settle 100× the amount, and money is irreversible. */
export function parseAmountInput(text: string): { cents: number } | { error: string } {
  const compact = text.replace(/[\s$]/g, '')
  if (compact.includes(',') && !THOUSANDS_PATTERN.test(compact))
    return { error: 'Usa punto para los centavos, por ejemplo 70.55.' }
  const plain = compact.replace(/,/g, '')
  if (!plain) return { error: 'Escribe el monto que devolviste.' }
  if (!AMOUNT_PATTERN.test(plain)) return { error: 'Escribe un monto válido, por ejemplo 250.00.' }
  const [whole = '0', fraction = ''] = plain.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (cents < 1) return { error: 'El monto debe ser mayor que $0.00.' }
  return { cents }
}

/** Cents as the plain decimal the amount input shows (`4555` → `45.55`). */
export function centsToAmountInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

const pad = (value: number) => String(Math.abs(value)).padStart(2, '0')

/** An instant as ISO-8601 with the browser's offset (`2026-11-05T11:05:00-06:00`). */
export function toZonedIso(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const zone = `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${zone}`
  )
}

/** A `datetime-local` value read in the browser's zone; `null` when it is not a date. */
function localInputToDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function validateSettlementForm(
  values: SettlementFormValues,
  context: { outstandingCents: number; now: Date },
): SettlementFormErrors {
  const errors: SettlementFormErrors = {}
  const amount = parseAmountInput(values.amount)
  if ('error' in amount) errors.amount = amount.error
  else if (amount.cents > context.outstandingCents) {
    errors.amount = `No puede ser mayor que lo pendiente (${formatCentsMXN(context.outstandingCents)}).`
  }

  if (values.settledAt !== null) {
    const date = localInputToDate(values.settledAt)
    if (!date) errors.settledAt = 'Elige la fecha y hora de la devolución.'
    // The input has minute precision, so the current minute still counts as «now».
    else if (date.getTime() > context.now.getTime() + 60_000) {
      errors.settledAt = 'La fecha no puede ser posterior a este momento.'
    }
  }
  return errors
}

/**
 * The request for a VALID form. «Ahora» is resolved here, once per attempt: a retry resends
 * the frozen request, so the instant never changes under the same Idempotency-Key.
 */
export function buildSettlementRequest(
  values: SettlementFormValues,
  context: { now: Date; cashSessionId: string | null },
): RefundSettlementRequest {
  const amount = parseAmountInput(values.amount)
  if ('error' in amount) throw new Error(amount.error)
  const settledAt =
    values.settledAt === null ? context.now : (localInputToDate(values.settledAt) ?? context.now)
  const reference = values.reference.trim()
  const bindCash = values.useCashSession && values.method !== 'credit' && context.cashSessionId

  return {
    amountCents: amount.cents,
    method: values.method,
    ...(reference ? { reference } : {}),
    settledAt: toZonedIso(settledAt),
    ...(bindCash ? { cashSessionId: context.cashSessionId as string } : {}),
  }
}

/** Identity of one attempt: the refund plus every answer, with «Ahora» kept symbolic. */
export function formSignature(refundId: string, values: SettlementFormValues): string {
  const amount = parseAmountInput(values.amount)
  return JSON.stringify([
    refundId,
    'cents' in amount ? amount.cents : values.amount,
    values.method,
    values.reference.trim(),
    values.settledAt ?? 'now',
    values.useCashSession && values.method !== 'credit',
  ])
}
