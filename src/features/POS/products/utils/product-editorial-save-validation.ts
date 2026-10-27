import type { EditorialDocument } from '../interfaces/product-editorial.types'
import { decodeEditorialDocument } from './product-editorial-document'

export type EditorialSaveValidation =
  | { valid: true; document: EditorialDocument }
  | { valid: false; reason: 'structure' | 'limits' }

// Fresh-save checks only. T4 MUST gate vocabulary/binding/archived conservation
// and complete variant-context validation before calling save. No invented catalog.
export function validateEditorialSave(raw: unknown): EditorialSaveValidation {
  const decoded = decodeEditorialDocument(raw)
  if (!decoded.readable) return { valid: false, reason: 'structure' }
  const document = decoded.document
  if ((document.commercialTitle !== null && [...document.commercialTitle].length > 200) ||
    (document.description !== null && [...document.description].length > 20000) ||
    document.mediaRefs.length > 20 || document.values.length > 200) {
    return { valid: false, reason: 'limits' }
  }
  // The framework's 100 kB boundary is not defined in bytes by the closed
  // contract. Do not invent a client byte cap; handle framework 413 safely.
  return { valid: true, document }
}
