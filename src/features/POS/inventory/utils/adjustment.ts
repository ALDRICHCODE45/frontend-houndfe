import type { AdjustmentInput, AdjustmentReason } from '../interfaces/inventory.types'

export const ADJUSTMENT_REASONS: ReadonlyArray<{ value: AdjustmentReason; label: string }> = [
  { value: 'PHYSICAL_COUNT', label: 'Conteo físico' },
  { value: 'DAMAGE', label: 'Merma/daño' },
  { value: 'EXPIRED', label: 'Caducado' },
  { value: 'THEFT_LOSS', label: 'Robo/pérdida' },
  { value: 'DATA_ENTRY_CORRECTION', label: 'Corrección de captura' },
  { value: 'OTHER', label: 'Otro' },
]
export const NOTE_MAX = 500
export const MAX_DELTA = 1_000_000_000
export const MAX_QUANTITY = 2_147_483_647

export type AdjustmentIssue =
  | 'DELTA_ZERO' | 'DELTA_INVALID' | 'DELTA_TOO_LARGE' | 'VERSION_INVALID' | 'REASON_INVALID'
  | 'NOTE_REQUIRED' | 'NOTE_TOO_LONG' | 'TARGET_AMBIGUOUS' | 'RESULT_NEGATIVE' | 'RESULT_TOO_LARGE'

export function signedDelta(direction: 'add' | 'remove', amount: number) {
  return direction === 'add' ? amount : -amount
}
// The adjustment takes a delta, not a target count: a physical count is the
// counted quantity minus the quantity shown (the version check keeps it current).
export function countDelta(counted: number, shown: number) {
  return counted - shown
}
export function normalizeNote(note: string | null | undefined) {
  const trimmed = note?.trim()
  return trimmed ? trimmed : undefined
}

// Mirrors the backend's closed contract so a doomed request is never sent. When the
// shown bucket quantity is known the result is checked too (no negative stock).
export function validateAdjustment(input: AdjustmentInput, shownQuantity?: number): AdjustmentIssue | null {
  const { delta, expectedVersion, reason, target } = input
  if (!Number.isInteger(delta)) return 'DELTA_INVALID'
  if (delta === 0) return 'DELTA_ZERO'
  if (Math.abs(delta) > MAX_DELTA) return 'DELTA_TOO_LARGE'
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return 'VERSION_INVALID'
  if (!ADJUSTMENT_REASONS.some(item => item.value === reason)) return 'REASON_INVALID'
  if (target.lotId !== undefined && target.variantId !== undefined) return 'TARGET_AMBIGUOUS'
  const note = normalizeNote(input.note)
  if (reason === 'OTHER' && !note) return 'NOTE_REQUIRED'
  if (note && note.length > NOTE_MAX) return 'NOTE_TOO_LONG'
  if (shownQuantity !== undefined) {
    if (shownQuantity + delta < 0) return 'RESULT_NEGATIVE'
    if (shownQuantity + delta > MAX_QUANTITY) return 'RESULT_TOO_LARGE'
  }
  return null
}

const ISSUE_COPY: Record<AdjustmentIssue, string> = {
  DELTA_ZERO: 'Escribe una cantidad distinta de cero.',
  DELTA_INVALID: 'Escribe una cantidad entera.',
  DELTA_TOO_LARGE: 'La cantidad es demasiado grande.',
  VERSION_INVALID: 'No pudimos leer la versión del stock.',
  REASON_INVALID: 'Elige un motivo.',
  NOTE_REQUIRED: 'Escribe una nota para el motivo «Otro».',
  NOTE_TOO_LONG: 'La nota admite hasta 500 caracteres.',
  TARGET_AMBIGUOUS: 'Elige un solo lote o variante.',
  RESULT_NEGATIVE: 'El stock no puede quedar en negativo.',
  RESULT_TOO_LARGE: 'El stock resultante es demasiado grande.',
}
export function adjustmentIssueCopy(issue: AdjustmentIssue) {
  return ISSUE_COPY[issue]
}

// Fixed human sentences: a server or HTTP message is never the text. The
// Reintentar button is the retry action, so no copy asks for it.
const ERROR_COPY: Record<string, string> = {
  STOCK_VERSION_CONFLICT: 'El stock cambió mientras lo ajustabas. Revisa la cantidad actual.',
  INSUFFICIENT_STOCK: 'No hay suficiente stock para restar esa cantidad.',
  STOCK_NOT_TRACKED: 'Este producto no lleva control de stock.',
  IDEMPOTENCY_KEY_CONFLICT: 'Este ajuste ya se había enviado con otros datos. Ábrelo de nuevo para ajustar.',
  IDEMPOTENCY_KEY_IN_FLIGHT: 'El ajuste sigue en proceso. Aún no sabemos si se aplicó.',
  FORBIDDEN: 'No tienes permiso para ajustar el stock.',
  NOT_FOUND: 'El producto, lote o variante ya no existe.',
  MALFORMED: 'Revisa la cantidad, el motivo y la nota.',
  INTERNAL_ERROR: 'No pudimos confirmar si el ajuste se aplicó.',
}
export function adjustmentErrorCopy(code: string | null | undefined) {
  if (!code) return ERROR_COPY.INTERNAL_ERROR!
  return ERROR_COPY[code] ?? 'No se pudo ajustar el stock.'
}
