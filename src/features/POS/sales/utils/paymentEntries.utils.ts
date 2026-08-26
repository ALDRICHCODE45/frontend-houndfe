import type { CollectionPaymentMethod, PaymentEntry } from '../interfaces/sale.types'
import { PAYMENT_METHOD } from '../constants/sale.constants' // sdd/magic-string-constants slice 3 — lowercase contract.

export const COLLECTION_PAYMENT_METHODS: CollectionPaymentMethod[] = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.CARD_CREDIT,
  PAYMENT_METHOD.CARD_DEBIT,
  PAYMENT_METHOD.TRANSFER,
]

export const MAX_PAYMENT_ENTRIES = 5

type PaymentEntryPatch = Partial<Pick<PaymentEntry, 'amountCents' | 'reference' | 'paymentMethodId'>>
type PaymentEntryValidation = Partial<Record<'amountCents' | 'reference', string>>

/**
 * createEntry — sdd custom-payment-methods S4B (REQ-CAT-001 / design §1.3).
 *
 * The optional `paymentMethodId` is threaded ONLY when provided (custom tiles).
 * Fixed tiles omit it entirely so the legacy wire shape stays byte-identical
 * (the idempotency hash must not change for fixed-only charges).
 */
export function createEntry(
  method: CollectionPaymentMethod,
  remainingCents: number,
  paymentMethodId?: string,
): PaymentEntry {
  const entry: PaymentEntry = {
    method,
    amountCents: method === PAYMENT_METHOD.CASH ? remainingCents : 0,
  }

  if (paymentMethodId !== undefined) {
    entry.paymentMethodId = paymentMethodId
  }

  return entry
}

export function addEntry(
  entries: PaymentEntry[],
  method: CollectionPaymentMethod,
  debtCents: number,
  paymentMethodId?: string,
): PaymentEntry[] {
  if (entries.length >= MAX_PAYMENT_ENTRIES) {
    return entries
  }

  return [...entries, createEntry(method, remaining(entries, debtCents), paymentMethodId)]
}

export function removeEntry(entries: PaymentEntry[], index: number): PaymentEntry[] {
  return entries.filter((_, entryIndex) => entryIndex !== index)
}

export function updateEntry(entries: PaymentEntry[], index: number, patch: PaymentEntryPatch): PaymentEntry[] {
  const target = entries[index]

  if (!target) {
    return entries
  }

  return entries.map((entry, entryIndex) => {
    if (entryIndex !== index) {
      return entry
    }

    return {
      ...target,
      ...patch,
    }
  })
}

export function validateEntry(entry: PaymentEntry): PaymentEntryValidation {
  // sales-pos-charge WU-C.1 (REQ-NEW-9, REQ-NEW-10): reference is OPTIONAL
  // for non-CASH entries. The cashier can submit a card/transfer payment
  // without typing a reference; the backend treats the missing reference
  // as null. Only the amount still gates validation.
  const errors: PaymentEntryValidation = {}

  if (entry.amountCents < 1) {
    errors.amountCents = 'El monto debe ser mayor a 0'
  }

  return errors
}

export function validateAggregate(entries: PaymentEntry[], debtCents: number): string | undefined {
  if (entries.length === 0) {
    return 'Debes agregar al menos un pago'
  }

  if (paidSum(entries) > debtCents) {
    return 'El total supera la deuda'
  }

  return undefined
}

export function paidSum(entries: PaymentEntry[]): number {
  return entries.reduce((acc, entry) => acc + entry.amountCents, 0)
}

export function remaining(entries: PaymentEntry[], debtCents: number): number {
  return debtCents - paidSum(entries)
}

/**
 * sales-pos-charge WU-B.6 / design D8: normalize raw reference input from a
 * text field before it crosses the wire.
 *
 * Contract:
 *   - `null`  → `null`   (slideover uses this as the explicit "clear" signal)
 *   - `undefined` → `undefined` (modal payload builders treat this as
 *     "omit the key entirely" so the backend default kicks in)
 *   - empty / whitespace-only string → `undefined` (same omit semantics)
 *   - any other string → trimmed string
 *
 * Used by:
 *   - `EditReferenceSlideover.submit` (WU-B.5) — sends `null` on clear, or
 *     the trimmed value when set.
 *   - `PaymentModal.buildPayload` (WU-C) — omits the `reference` key when
 *     the user left the field blank.
 */
export function normalizeReferenceInput(raw: string | null | undefined): string | null | undefined {
  if (raw === null) return null
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed.length === 0 ? undefined : trimmed
}
