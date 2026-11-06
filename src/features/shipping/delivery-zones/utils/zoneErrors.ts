/**
 * Backend errors of the zone and validation writes → Spanish copy next to the
 * field or action that caused them (S6). Switches on status, `code` and the
 * validation-pipe properties (readApiErrorEnvelope), never on `message`.
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import type { ZoneField, ZoneFieldErrors } from './zoneForm'

const NETWORK = 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.'

const FIELD_COPY: Record<ZoneField, string> = {
  zipCode: 'Escribe un código postal de 5 dígitos.',
  surchargeCents: 'Escribe un cargo en pesos con hasta 2 decimales.',
  etaDays: 'Escribe de 0 a 60 días.',
  state: 'Escribe de 1 a 120 caracteres.',
  municipality: 'Escribe de 1 a 120 caracteres.',
  neighborhood: 'Escribe de 1 a 120 caracteres.',
}

export type ZoneWriteError =
  | { kind: 'validation-pending'; validationId: string; message: string; fieldErrors: ZoneFieldErrors }
  | { kind: 'form' | 'reload' | 'logout'; message: string; fieldErrors: ZoneFieldErrors }

function readValidationId(err: unknown): string | null {
  const data = (err as { response?: { data?: { validationId?: unknown } } } | null)?.response?.data
  return typeof data?.validationId === 'string' && data.validationId.length > 0 ? data.validationId : null
}

export function mapZoneWriteError(err: unknown): ZoneWriteError {
  const { status, code, fieldErrors } = readApiErrorEnvelope(err)
  const none: ZoneFieldErrors = {}
  if (status === null) return { kind: 'form', message: NETWORK, fieldErrors: none }
  if (status === 401) return { kind: 'logout', message: 'Tu sesión terminó. Vuelve a iniciar sesión.', fieldErrors: none }
  if (status === 403) return { kind: 'form', message: 'Tu rol no permite cambiar zonas de entrega.', fieldErrors: none }
  if (code === 'DELIVERY_ZONE_VALIDATION_PENDING') {
    const message = 'Este código postal tiene una validación pendiente: resuélvela para responder a los clientes que esperan.'
    const validationId = readValidationId(err)
    return validationId
      ? { kind: 'validation-pending', validationId, message, fieldErrors: none }
      : { kind: 'form', message, fieldErrors: none }
  }
  if (status === 404) return { kind: 'reload', message: 'Esta zona ya no existe. Se actualizó la lista.', fieldErrors: none }
  if (code === 'INVALID_DELIVERY_ZONE') {
    return { kind: 'form', message: 'Revisa el tipo de entrega, el cargo y los días.', fieldErrors: none }
  }
  if (status === 400) {
    const mapped: ZoneFieldErrors = {}
    for (const path of Object.keys(fieldErrors)) {
      const field = path.split('.')[0] as ZoneField
      if (field in FIELD_COPY) mapped[field] = FIELD_COPY[field]
    }
    if (Object.keys(mapped).length > 0) return { kind: 'form', message: 'Revisa los datos marcados.', fieldErrors: mapped }
    // Envelope D: the only bad param on these routes is the postal code.
    return { kind: 'form', message: 'Revisa los datos marcados.', fieldErrors: { zipCode: FIELD_COPY.zipCode } }
  }
  return { kind: 'form', message: 'No se pudo guardar la zona. Intenta de nuevo.', fieldErrors: none }
}

export type ResolveErrorKind = 'network' | 'logout' | 'gone' | 'reload' | 'form'

export interface ResolveError {
  kind: ResolveErrorKind
  message: string
}

const RELOAD_COPY: Record<string, string> = {
  VERSION_CONFLICT: 'La validación cambió mientras la revisabas. Ya ves la versión actual; decide de nuevo.',
  ALREADY_RESOLVED: 'Otra persona ya resolvió esta validación. Abajo ves qué decidió.',
  IDEMPOTENCY_CONFLICT: 'Esta decisión no coincide con la que ya se registró. Ya ves la validación actual; revísala antes de decidir.',
}

export function mapResolveError(err: unknown): ResolveError {
  const { status, code } = readApiErrorEnvelope(err)
  // The outcome is unknown: retrying the same request (same id) is safe.
  if (status === null || status >= 500) {
    return { kind: 'network', message: 'No se pudo confirmar la decisión. Reintenta: se envía la misma decisión.' }
  }
  if (status === 401) return { kind: 'logout', message: 'Tu sesión terminó. Vuelve a iniciar sesión.' }
  if (status === 403) return { kind: 'form', message: 'Tu rol no permite resolver validaciones de zona.' }
  if (status === 404) return { kind: 'gone', message: 'Esta validación ya no existe en esta sucursal.' }
  if (code && RELOAD_COPY[code]) return { kind: 'reload', message: RELOAD_COPY[code] }
  if (status === 409) return { kind: 'reload', message: RELOAD_COPY.VERSION_CONFLICT! }
  if (status === 400) return { kind: 'form', message: 'Revisa el tipo de entrega, el cargo y los días.' }
  return { kind: 'form', message: 'No se pudo resolver la validación. Intenta de nuevo.' }
}
