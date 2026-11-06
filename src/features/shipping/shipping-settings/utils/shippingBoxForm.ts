/**
 * Box form (handoff §5, S4): the draft holds what the user typed (cm, kg); the
 * body goes out in cm and grams. Errors from the backend are routed to the
 * field that caused them, in Spanish (S6).
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import type { ShippingBox, ShippingBoxBody, ShippingBoxPatch } from '../interfaces/shipping-settings.types'
import { cmFromText, formatCm, formatKg, gramsFromKgText } from './shippingUnits'

export interface BoxDraft {
  name: string
  length: string
  width: string
  height: string
  weightKg: string
  maxContentKg: string
}

export type BoxField = keyof BoxDraft
export type BoxErrors = Partial<Record<BoxField, string>>
export type BoxAction = 'save' | 'retire' | 'reactivate' | 'delete'

const NAME_MAX = 80
const CM_ERROR = 'Escribe una medida entre 0.1 y 300 cm, con un decimal como máximo.'
const KG_ERROR = 'Escribe un peso entre 0.001 y 70 kg.'

const SIZE_FIELDS = [
  ['length', 'innerLengthCm'],
  ['width', 'innerWidthCm'],
  ['height', 'innerHeightCm'],
] as const
const WEIGHT_FIELDS = [
  ['weightKg', 'weightG'],
  ['maxContentKg', 'maxContentWeightG'],
] as const

const FIELD_OF_PROPERTY: Record<string, BoxField> = {
  name: 'name',
  innerLengthCm: 'length',
  innerWidthCm: 'width',
  innerHeightCm: 'height',
  weightG: 'weightKg',
  maxContentWeightG: 'maxContentKg',
}

export function emptyBoxDraft(): BoxDraft {
  return { name: '', length: '', width: '', height: '', weightKg: '', maxContentKg: '' }
}

export function boxToDraft(box: ShippingBox): BoxDraft {
  return {
    name: box.name,
    length: formatCm(box.innerLengthCm),
    width: formatCm(box.innerWidthCm),
    height: formatCm(box.innerHeightCm),
    weightKg: formatKg(box.weightG),
    maxContentKg: formatKg(box.maxContentWeightG),
  }
}

function nameError(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return 'Escribe el nombre de la caja.'
  if ([...trimmed].length > NAME_MAX) return 'El nombre puede tener hasta 80 caracteres.'
  return undefined
}

export function validateBoxDraft(draft: BoxDraft): BoxErrors {
  const errors: BoxErrors = {}
  const name = nameError(draft.name)
  if (name) errors.name = name
  for (const [field] of SIZE_FIELDS) if (cmFromText(draft[field]) === null) errors[field] = CM_ERROR
  for (const [field] of WEIGHT_FIELDS) if (gramsFromKgText(draft[field]) === null) errors[field] = KG_ERROR
  return errors
}

/** Assumes a draft that passed {@link validateBoxDraft}. */
export function draftToBoxBody(draft: BoxDraft): ShippingBoxBody {
  return {
    name: draft.name.trim(),
    innerLengthCm: cmFromText(draft.length)!,
    innerWidthCm: cmFromText(draft.width)!,
    innerHeightCm: cmFromText(draft.height)!,
    weightG: gramsFromKgText(draft.weightKg)!,
    maxContentWeightG: gramsFromKgText(draft.maxContentKg)!,
  }
}

/** Only what changed, so an untouched name never trips the uniqueness check. */
export function boxPatch(box: ShippingBox, draft: BoxDraft): ShippingBoxPatch {
  const body = draftToBoxBody(draft)
  const patch: ShippingBoxPatch = {}
  for (const key of Object.keys(body) as (keyof ShippingBoxBody)[]) {
    if (body[key] !== box[key]) Object.assign(patch, { [key]: body[key] })
  }
  return patch
}

const FALLBACK: Record<BoxAction, string> = {
  save: 'No se pudo guardar la caja. Intenta de nuevo.',
  retire: 'No se pudo retirar la caja. Intenta de nuevo.',
  reactivate: 'No se pudo reactivar la caja. Intenta de nuevo.',
  delete: 'No se pudo eliminar la caja. Intenta de nuevo.',
}

const MESSAGE_OF_FIELD: Record<BoxField, string> = {
  name: 'Revisa el nombre: de 1 a 80 caracteres.',
  length: CM_ERROR,
  width: CM_ERROR,
  height: CM_ERROR,
  weightKg: KG_ERROR,
  maxContentKg: KG_ERROR,
}

export function mapBoxError(err: unknown, action: BoxAction): { fields: BoxErrors; message: string | null } {
  const envelope = readApiErrorEnvelope(err)
  if (envelope.code === 'ENTITY_ALREADY_EXISTS') {
    return { fields: { name: 'Ya existe una caja con ese nombre.' }, message: null }
  }
  if (envelope.status === 400) {
    const fields: BoxErrors = {}
    for (const path of Object.keys(envelope.fieldErrors)) {
      const field = FIELD_OF_PROPERTY[path.split('.')[0]!]
      if (field) fields[field] = MESSAGE_OF_FIELD[field]
    }
    if (Object.keys(fields).length > 0) return { fields, message: null }
    return { fields, message: 'Revisa los datos de la caja.' }
  }
  if (envelope.status === 404) return { fields: {}, message: 'Esta caja ya no existe. Actualiza la lista.' }
  if (envelope.status === 403) return { fields: {}, message: 'No tienes permiso para cambiar las cajas.' }
  return { fields: {}, message: FALLBACK[action] }
}
