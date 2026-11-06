/**
 * Packaging form rules (S4): the weight is typed in kg and sent as integer
 * grams (1..70000), the sizes are typed and sent in cm (0.1..300, one decimal
 * at most). All four are required. Text is parsed as strings, so 0.45 kg is
 * 450 g without float drift, and a decimal comma is accepted.
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import type {
  PackagingBody,
  PackagingField,
  PackagingRecord,
} from '../interfaces/product-packaging.types'

export interface PackagingFormInput {
  weightKg: string
  lengthCm: string
  widthCm: string
  heightCm: string
}

export type PackagingFieldErrors = Partial<Record<PackagingField, string>>

export const PACKAGING_FIELDS: readonly PackagingField[] = ['weightG', 'lengthCm', 'widthCm', 'heightCm']

const SIZE_NAMES: Record<Exclude<PackagingField, 'weightG'>, string> = {
  lengthCm: 'largo',
  widthCm: 'ancho',
  heightCm: 'alto',
}

const MIN_G = 1
const MAX_G = 70_000
const MIN_TENTHS = 1
const MAX_TENTHS = 3000

const WEIGHT_RANGE = 'El peso va de 0.001 a 70 kg.'
const DECIMAL_TEXT = /^(-?)(\d*)(?:\.(\d*))?$/

export function emptyPackagingForm(): PackagingFormInput {
  return { weightKg: '', lengthCm: '', widthCm: '', heightCm: '' }
}

interface ParsedDecimal {
  negative: boolean
  whole: string
  fraction: string
}

function parseDecimal(text: string): ParsedDecimal | null {
  const match = DECIMAL_TEXT.exec(text.trim().replace(',', '.'))
  if (!match || (!match[2] && !match[3])) return null
  return { negative: match[1] === '-', whole: match[2] || '0', fraction: match[3] ?? '' }
}

/** The number in units of 10^-places, or null when it has more decimals. */
function scaled(parsed: ParsedDecimal, places: number): number | null {
  if (parsed.fraction.length > places) return null
  const value = Number(parsed.whole) * 10 ** places + Number(parsed.fraction.padEnd(places, '0') || '0')
  return parsed.negative ? -value : value
}

function readWeight(text: string): { grams?: number; error?: string } {
  if (!text.trim()) return { error: 'Escribe el peso.' }
  const parsed = parseDecimal(text)
  if (!parsed) return { error: 'Escribe el peso en kg, por ejemplo 1.25.' }
  const grams = scaled(parsed, 3)
  if (grams === null) return { error: 'Usa hasta 3 decimales: el peso se guarda en gramos.' }
  if (grams < MIN_G || grams > MAX_G) return { error: WEIGHT_RANGE }
  return { grams }
}

function readSize(text: string, name: string): { cm?: number; error?: string } {
  if (!text.trim()) return { error: `Escribe el ${name}.` }
  const parsed = parseDecimal(text)
  if (!parsed) return { error: `Escribe el ${name} en cm, por ejemplo 8.5.` }
  const tenths = scaled(parsed, 1)
  if (tenths === null) return { error: 'Usa un decimal como máximo.' }
  if (tenths < MIN_TENTHS || tenths > MAX_TENTHS) return { error: `El ${name} va de 0.1 a 300 cm.` }
  return { cm: tenths / 10 }
}

/** The request body when every field is valid; otherwise the errors by field. */
export function readPackagingForm(form: PackagingFormInput): {
  body: PackagingBody | null
  errors: PackagingFieldErrors
} {
  const errors: PackagingFieldErrors = {}
  const weight = readWeight(form.weightKg)
  if (weight.error) errors.weightG = weight.error
  const sizes = {} as Record<Exclude<PackagingField, 'weightG'>, number>
  for (const field of ['lengthCm', 'widthCm', 'heightCm'] as const) {
    const size = readSize(form[field], SIZE_NAMES[field])
    if (size.error) errors[field] = size.error
    else sizes[field] = size.cm as number
  }
  if (Object.keys(errors).length > 0) return { body: null, errors }
  return { body: { weightG: weight.grams as number, ...sizes }, errors }
}

export function packagingToForm(record: PackagingRecord | PackagingBody | null | undefined): PackagingFormInput {
  if (!record) return emptyPackagingForm()
  return {
    weightKg: String(record.weightG / 1000),
    lengthCm: String(record.lengthCm),
    widthCm: String(record.widthCm),
    heightCm: String(record.heightCm),
  }
}

export function formatPackagingWeight(weightG: number): string {
  return `${weightG / 1000} kg`
}

export function formatPackagingSize(record: Pick<PackagingBody, 'lengthCm' | 'widthCm' | 'heightCm'>): string {
  return `${record.lengthCm} × ${record.widthCm} × ${record.heightCm} cm`
}

export type PackagingOwner = 'product' | 'variant'

/**
 * A failed packaging write in Spanish (S6): 400 constraints go to the field
 * that caused them, everything else to one message for the action. The
 * backend's English text and ids never reach the screen.
 */
export function packagingErrorMessages(
  err: unknown,
  owner: PackagingOwner,
): { fields: PackagingFieldErrors; message: string } {
  const envelope = readApiErrorEnvelope(err)
  if (envelope.status === 404 || envelope.code === 'ENTITY_NOT_FOUND') {
    return {
      fields: {},
      message:
        owner === 'product'
          ? 'Este producto ya no existe en la sucursal. Recarga la página.'
          : 'Esta variante ya no existe en este producto. Recarga la página.',
    }
  }
  if (envelope.status === 403) return { fields: {}, message: 'Tu rol no permite cambiar el empaque.' }
  if (envelope.status === 400) {
    const fields: PackagingFieldErrors = {}
    for (const field of PACKAGING_FIELDS) {
      if (!envelope.fieldErrors[field]) continue
      fields[field] =
        field === 'weightG'
          ? WEIGHT_RANGE
          : `Revisa el ${SIZE_NAMES[field]}: va de 0.1 a 300 cm, con un decimal como máximo.`
    }
    if (Object.keys(fields).length > 0) return { fields, message: 'Revisa los datos marcados.' }
    return { fields, message: 'No se pudo guardar el empaque. Recarga la página e intenta de nuevo.' }
  }
  return { fields: {}, message: 'No se pudo guardar el empaque. Intenta de nuevo.' }
}
