import type { CollectionPaymentMethod, PaymentEntry } from '../interfaces/sale.types'

export const COLLECTION_PAYMENT_METHODS: CollectionPaymentMethod[] = [
  'cash',
  'card_credit',
  'card_debit',
  'transfer',
]

export const MAX_PAYMENT_ENTRIES = 5

type PaymentEntryPatch = Partial<Pick<PaymentEntry, 'amountCents' | 'reference'>>
type PaymentEntryValidation = Partial<Record<'amountCents' | 'reference', string>>

export function createEntry(method: CollectionPaymentMethod, remainingCents: number): PaymentEntry {
  return {
    method,
    amountCents: method === 'cash' ? remainingCents : 0,
  }
}

export function addEntry(
  entries: PaymentEntry[],
  method: CollectionPaymentMethod,
  debtCents: number,
): PaymentEntry[] {
  if (entries.length >= MAX_PAYMENT_ENTRIES) {
    return entries
  }

  return [...entries, createEntry(method, remaining(entries, debtCents))]
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
  const errors: PaymentEntryValidation = {}

  if (entry.amountCents < 1) {
    errors.amountCents = 'El monto debe ser mayor a 0'
  }

  if (entry.method !== 'cash') {
    const reference = entry.reference?.trim() ?? ''
    if (!reference) {
      errors.reference = 'La referencia es obligatoria'
    }
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
