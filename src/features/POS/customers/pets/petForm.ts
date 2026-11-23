/**
 * Pet form ⇄ payloads (handoff 27 §2–§3.3) and the Spanish labels.
 *
 * Age: `approxAge` or an exact date, never both. The server stores an approximate age as a date with
 * MONTH/YEAR precision, so an approximate age is edited by typing a new `approxAge` while `ageLabel`
 * shows the current one; it is never rebuilt from `birthDate`, and age is never computed here.
 */
import type {
  CreatePetPayload,
  Pet,
  PetApproxAge,
  PetSize,
  PetSpecies,
  UpdatePetPayload,
} from './pet.types'

export const PET_SPECIES_LABELS: Record<Exclude<PetSpecies, 'OTHER'>, string> = {
  DOG: 'Perro',
  CAT: 'Gato',
}

export const PET_SPECIES_OPTIONS: { label: string; value: PetSpecies }[] = [
  { label: 'Perro', value: 'DOG' },
  { label: 'Gato', value: 'CAT' },
  { label: 'Otra', value: 'OTHER' },
]

export const PET_SIZE_LABELS: Record<PetSize, string> = {
  SMALL: 'Chico',
  MEDIUM: 'Mediano',
  LARGE: 'Grande',
  GIANT: 'Gigante',
}

export function petSpeciesLabel(pet: Pick<Pet, 'species' | 'speciesOther'>): string {
  return pet.species === 'OTHER' ? pet.speciesOther || 'Otra' : PET_SPECIES_LABELS[pet.species]
}

export function petSizeLabel(size: PetSize | null): string | null {
  return size ? PET_SIZE_LABELS[size] : null
}

export type PetAgeMode = 'none' | 'approx' | 'date'

export interface PetFormValues {
  name: string
  species: PetSpecies
  speciesOther: string
  breed: string
  size: PetSize | null
  ageMode: PetAgeMode
  approxYears: number | null
  approxMonths: number | null
  /** `YYYY-MM-DD`, sent with EXACT precision. */
  birthDate: string
  allergies: string
  notes: string
}

export function emptyPetForm(): PetFormValues {
  return {
    name: '',
    species: 'DOG',
    speciesOther: '',
    breed: '',
    size: null,
    ageMode: 'none',
    approxYears: null,
    approxMonths: null,
    birthDate: '',
    allergies: '',
    notes: '',
  }
}

export function petToForm(pet: Pet): PetFormValues {
  const exact = pet.birthDatePrecision === 'EXACT' && !!pet.birthDate
  return {
    ...emptyPetForm(),
    name: pet.name,
    species: pet.species,
    speciesOther: pet.speciesOther ?? '',
    breed: pet.breed ?? '',
    size: pet.size,
    ageMode: !pet.birthDate ? 'none' : exact ? 'date' : 'approx',
    birthDate: exact ? (pet.birthDate ?? '') : '',
    allergies: pet.allergies ?? '',
    notes: pet.notes ?? '',
  }
}

/** A typed whole number, or `null` for an empty input. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function approxAge(values: PetFormValues): PetApproxAge | null {
  const years = num(values.approxYears)
  const months = num(values.approxMonths)
  if (years === null && months === null) return null
  return { ...(years !== null ? { years } : {}), ...(months !== null ? { months } : {}) }
}

const TEXT_FIELDS = ['breed', 'allergies', 'notes'] as const

export function toCreatePetPayload(values: PetFormValues): CreatePetPayload {
  const payload: CreatePetPayload = { name: values.name.trim(), species: values.species }
  if (values.species === 'OTHER' && values.speciesOther.trim()) {
    payload.speciesOther = values.speciesOther.trim()
  }
  for (const field of TEXT_FIELDS) {
    const text = values[field].trim()
    if (text) payload[field] = text
  }
  if (values.size) payload.size = values.size
  const approx = values.ageMode === 'approx' ? approxAge(values) : null
  if (approx) payload.approxAge = approx
  if (values.ageMode === 'date' && values.birthDate) {
    payload.birthDate = values.birthDate
    payload.birthDatePrecision = 'EXACT'
  }
  return payload
}

/** Only what changed; `null` clears a nullable field. */
export function toUpdatePetPayload(pet: Pet, values: PetFormValues): UpdatePetPayload {
  const payload: UpdatePetPayload = { version: pet.version }
  const name = values.name.trim()
  if (name !== pet.name) payload.name = name
  if (values.species !== pet.species) payload.species = values.species
  if (values.species === 'OTHER') {
    const other = values.speciesOther.trim()
    if (other !== (pet.speciesOther ?? '') || payload.species) payload.speciesOther = other || null
  }
  for (const field of TEXT_FIELDS) {
    const text = values[field].trim()
    if (text !== (pet[field] ?? '')) payload[field] = text || null
  }
  if (values.size !== pet.size) payload.size = values.size

  if (values.ageMode === 'none') {
    if (pet.birthDate) payload.birthDate = null
  } else if (values.ageMode === 'approx') {
    const approx = approxAge(values)
    if (approx) payload.approxAge = approx
  } else if (
    values.birthDate &&
    (values.birthDate !== pet.birthDate || pet.birthDatePrecision !== 'EXACT')
  ) {
    payload.birthDate = values.birthDate
    payload.birthDatePrecision = 'EXACT'
  }
  return payload
}

const isWhole = (n: number | null, max: number) =>
  n === null || (Number.isInteger(n) && n >= 0 && n <= max)

/** Client checks that mirror the server limits (§2); the server's 400 stays the authority. */
export function validatePetForm(values: PetFormValues, today: string): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Escribe el nombre de la mascota.'
  else if (name.length > 60) errors.name = 'El nombre admite hasta 60 caracteres.'
  if (values.species === 'OTHER') {
    const other = values.speciesOther.trim()
    if (!other) errors.speciesOther = 'Indica qué especie es.'
    else if (other.length > 40) errors.speciesOther = 'Admite hasta 40 caracteres.'
  }
  if (values.breed.trim().length > 80) errors.breed = 'La raza admite hasta 80 caracteres.'
  if (values.allergies.trim().length > 500) errors.allergies = 'Admite hasta 500 caracteres.'
  if (values.notes.trim().length > 500) errors.notes = 'Admite hasta 500 caracteres.'
  if (
    values.ageMode === 'approx' &&
    (!isWhole(num(values.approxYears), 50) || !isWhole(num(values.approxMonths), 600))
  ) {
    errors.approxAge = 'Usa números enteros: hasta 50 años y 600 meses.'
  }
  if (values.ageMode === 'date') {
    if (!values.birthDate) errors.birthDate = 'Elige la fecha de nacimiento.'
    else if (values.birthDate > today) errors.birthDate = 'La fecha no puede ser futura.'
  }
  return errors
}
