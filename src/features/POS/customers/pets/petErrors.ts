/**
 * Pet route errors (handoff 27 §3.7–§3.9) → es-MX copy. Switches on `error`, never on `message`; a
 * server string is never shown. A 400 per-field body is mapped by `property` to the form field.
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'

export interface PetErrorInfo {
  status: number | null
  code: string | null
  message: string
  /** The pets changed under the user (or are gone): reload the list from the server. */
  reload: boolean
  /** `PET_VERSION_CONFLICT {currentVersion}`. */
  currentVersion: number | null
  /** Spanish copy by form field (`name`, `birthDate`, `approxAge`…). */
  fields: Record<string, string>
}

const CODE_COPY: Record<string, { message: string; reload: boolean }> = {
  PET_VERSION_CONFLICT: {
    message:
      'Otra persona modificó esta mascota. Actualizamos los datos; revísalos y vuelve a intentar.',
    reload: true,
  },
  PET_ARCHIVED: {
    message: 'Esta mascota está archivada. Restáurala para cambiarla.',
    reload: true,
  },
  PET_NOT_ARCHIVED: { message: 'Esta mascota ya está activa.', reload: true },
  PET_LIMIT_REACHED: {
    message: 'Este cliente ya tiene 20 mascotas activas. Archiva una para añadir otra.',
    reload: false,
  },
  PET_NOT_FOUND: { message: 'Esta mascota ya no existe. Actualizamos la lista.', reload: true },
  CUSTOMER_NOT_FOUND: { message: 'Este cliente ya no existe.', reload: false },
}

const FIELD_COPY: Record<string, string> = {
  name: 'Revisa el nombre (de 1 a 60 caracteres).',
  species: 'Elige la especie.',
  speciesOther: 'Indica qué especie es (hasta 40 caracteres), solo con «Otra».',
  breed: 'La raza admite hasta 80 caracteres.',
  size: 'Elige un tamaño válido.',
  approxAge: 'Revisa la edad: números enteros, hasta 50 años y 600 meses.',
  birthDate: 'Revisa la fecha de nacimiento.',
  birthDatePrecision: 'Revisa la fecha de nacimiento.',
  allergies: 'Las alergias admiten hasta 500 caracteres.',
  notes: 'Las notas admiten hasta 500 caracteres.',
  reason: 'El motivo admite hasta 280 caracteres.',
}

/** Constraint keys of the cross-field rules (§3.8) with their own copy. */
const CONSTRAINT_COPY: Record<string, string> = {
  birthDateInFuture: 'La fecha no puede ser futura.',
  approxAgeConflict: 'Indica la edad aproximada o la fecha, no ambas.',
}

const FIELDS_COPY = 'Revisa los datos marcados.'
const GENERIC_COPY = 'No pudimos guardar los cambios de la mascota. Intenta de nuevo.'
const NETWORK_COPY = 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Constraint keys by top-level property, children included (`approxAge.years` → `approxAge`). */
function constraintKeys(entries: unknown, into: Map<string, string[]>, root?: string) {
  if (!Array.isArray(entries)) return
  for (const entry of entries) {
    const item = asRecord(entry)
    if (!item || typeof item.property !== 'string') continue
    const field = root ?? item.property
    into.set(field, [...(into.get(field) ?? []), ...Object.keys(asRecord(item.constraints) ?? {})])
    constraintKeys(item.children, into, field)
  }
}

function fieldCopy(field: string, keys: string[]): string {
  const special = keys.find((key) => CONSTRAINT_COPY[key])
  return special ? CONSTRAINT_COPY[special]! : (FIELD_COPY[field] ?? FIELDS_COPY)
}

export function readPetError(err: unknown): PetErrorInfo {
  const envelope = readApiErrorEnvelope(err)
  const body = asRecord(asRecord(asRecord(err)?.response)?.data)
  const rawVersion = body?.currentVersion
  const base = {
    status: envelope.status,
    code: envelope.code,
    currentVersion: typeof rawVersion === 'number' ? rawVersion : null,
    fields: {} as Record<string, string>,
  }

  const known = envelope.code ? CODE_COPY[envelope.code] : undefined
  if (known) return { ...base, ...known }

  if (envelope.status === 400 && Array.isArray(body?.message)) {
    const keys = new Map<string, string[]>()
    constraintKeys(body.message, keys)
    for (const [field, fieldKeys] of keys) base.fields[field] = fieldCopy(field, fieldKeys)
    return { ...base, message: FIELDS_COPY, reload: false }
  }

  return { ...base, message: envelope.status === null ? NETWORK_COPY : GENERIC_COPY, reload: false }
}
