/**
 * Shipping origin form (handoff §6): the address carriers pick up from. Field
 * rules mirror the DTO; backend errors land on their field in Spanish (S6).
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import type { ShippingOrigin, ShippingOriginBody } from '../interfaces/shipping-settings.types'

export interface OriginDraft {
  addressLine1: string
  addressLine2: string
  neighborhood: string
  municipality: string
  state: string
  postalCode: string
  contactPhone: string
}

export type OriginField = keyof OriginDraft
export type OriginErrors = Partial<Record<OriginField, string>>

const POSTAL_CODE = /^\d{5}$/
const PHONE = /^\+?\d{10,15}$/
// Spaces, dashes, dots and parentheses people type in a phone; the rest stays.
const PHONE_SEPARATORS = /[\s\-().]/g

const REQUIRED: Partial<Record<OriginField, string>> = {
  addressLine1: 'Escribe la calle y el número.',
  neighborhood: 'Escribe la colonia.',
  municipality: 'Escribe la alcaldía o el municipio.',
  state: 'Escribe el estado.',
}
const MAX: Partial<Record<OriginField, number>> = {
  addressLine1: 200,
  addressLine2: 200,
  neighborhood: 120,
  municipality: 120,
  state: 120,
}
const POSTAL_CODE_ERROR = 'El código postal tiene 5 dígitos.'
const PHONE_ERROR = 'Escribe un teléfono de 10 a 15 dígitos; puede empezar con +.'

const normalizePhone = (phone: string) => phone.replace(PHONE_SEPARATORS, '')

export function originToDraft(origin: ShippingOrigin | null): OriginDraft {
  return {
    addressLine1: origin?.addressLine1 ?? '',
    addressLine2: origin?.addressLine2 ?? '',
    neighborhood: origin?.neighborhood ?? '',
    municipality: origin?.municipality ?? '',
    state: origin?.state ?? '',
    postalCode: origin?.postalCode ?? '',
    contactPhone: origin?.contactPhone ?? '',
  }
}

function textError(field: OriginField, value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed && REQUIRED[field]) return REQUIRED[field]
  const max = MAX[field]
  if (max && [...trimmed].length > max) return `Puede tener hasta ${max} caracteres.`
  return undefined
}

export function validateOriginDraft(draft: OriginDraft): OriginErrors {
  const errors: OriginErrors = {}
  for (const field of Object.keys(MAX) as OriginField[]) {
    const error = textError(field, draft[field])
    if (error) errors[field] = error
  }
  if (!POSTAL_CODE.test(draft.postalCode.trim())) errors.postalCode = POSTAL_CODE_ERROR
  if (!PHONE.test(normalizePhone(draft.contactPhone))) errors.contactPhone = PHONE_ERROR
  return errors
}

export function draftToOriginBody(draft: OriginDraft): ShippingOriginBody {
  const line2 = draft.addressLine2.trim()
  return {
    addressLine1: draft.addressLine1.trim(),
    addressLine2: line2 === '' ? null : line2,
    neighborhood: draft.neighborhood.trim(),
    municipality: draft.municipality.trim(),
    state: draft.state.trim(),
    postalCode: draft.postalCode.trim(),
    contactPhone: normalizePhone(draft.contactPhone),
  }
}

const SERVER_MESSAGE: Record<OriginField, string> = {
  addressLine1: 'Revisa la calle y el número: de 1 a 200 caracteres.',
  addressLine2: 'Revisa el interior o la referencia: hasta 200 caracteres.',
  neighborhood: 'Revisa la colonia: de 1 a 120 caracteres.',
  municipality: 'Revisa la alcaldía o el municipio: de 1 a 120 caracteres.',
  state: 'Revisa el estado: de 1 a 120 caracteres.',
  postalCode: POSTAL_CODE_ERROR,
  contactPhone: PHONE_ERROR,
}

export function mapOriginError(err: unknown): { fields: OriginErrors; message: string | null } {
  const envelope = readApiErrorEnvelope(err)
  if (envelope.status === 400) {
    const fields: OriginErrors = {}
    for (const path of Object.keys(envelope.fieldErrors)) {
      const field = path.split('.')[0] as OriginField
      if (field in SERVER_MESSAGE) fields[field] = SERVER_MESSAGE[field]
    }
    if (Object.keys(fields).length > 0) return { fields, message: null }
    return { fields, message: 'Revisa los datos del origen.' }
  }
  if (envelope.status === 403) return { fields: {}, message: 'No tienes permiso para cambiar el origen.' }
  return { fields: {}, message: 'No se pudo guardar el origen. Intenta de nuevo.' }
}
