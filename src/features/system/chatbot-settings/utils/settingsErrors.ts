/** Errors of the chatbot settings API (handoff 16 §4-§5) → what the screen does. Switches on status and `code`, never on `message`. */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import {
  chatbotSettingsSchema,
  type ChatbotRecompute,
  type ChatbotSettings,
  type ChatbotSettingsAuthor,
} from '../interfaces/chatbot-settings.types'

export type SettingsErrorKind = 'conflict' | 'validation' | 'forbidden' | 'network' | 'server'

/** One entry of a `400 VALIDATION_ERROR` `fieldErrors`: where (a path into the request) and why (a code). Never a value. */
export interface SettingsFieldError {
  path: string
  code: string
}

export interface SettingsError {
  kind: SettingsErrorKind
  status: number | null
  /** `400` `fieldErrors`, malformed entries dropped; empty = the problem could not be located. */
  fieldErrors: SettingsFieldError[]
  /** `409 VERSION_CONFLICT` body `current`; `null` when absent (apply-to-all without read permission) or malformed. */
  current: ChatbotSettings | null
}

function bodyOf(err: unknown): Record<string, unknown> | null {
  const response = (err as { response?: { data?: unknown } } | null)?.response
  const data = response?.data
  return data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null
}

export function readSettingsError(err: unknown): SettingsError {
  const { status, code } = readApiErrorEnvelope(err)
  let kind: SettingsErrorKind = 'server'
  if (status === null) kind = 'network'
  else if (status === 409 || code === 'VERSION_CONFLICT') kind = 'conflict'
  else if (status === 400) kind = 'validation'
  else if (status === 401 || status === 403) kind = 'forbidden'
  const parsed = kind === 'conflict' ? chatbotSettingsSchema.safeParse(bodyOf(err)?.current) : null
  return {
    kind,
    status,
    fieldErrors: kind === 'validation' ? readFieldErrors(bodyOf(err)?.fieldErrors) : [],
    current: parsed?.success ? parsed.data : null,
  }
}

function readFieldErrors(value: unknown): SettingsFieldError[] {
  if (!Array.isArray(value)) return []
  const out: SettingsFieldError[] = []
  for (const entry of value) {
    const { path, code } = (entry ?? {}) as { path?: unknown; code?: unknown }
    if (typeof path === 'string' && typeof code === 'string') out.push({ path, code })
  }
  return out
}

function clockParts(iso: string, timeZone: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = (zone: string | undefined) =>
    new Intl.DateTimeFormat('es-MX', {
      timeZone: zone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
  let found: Intl.DateTimeFormatPart[]
  try {
    found = parts(timeZone)
  } catch {
    found = parts(undefined) // an unknown zone must not hide the time
  }
  const get = (type: Intl.DateTimeFormatPartTypes) => (found.find((p) => p.type === type)?.value ?? '').replace(/\.$/, '')
  return { day: get('day'), month: get('month'), year: get('year'), hour: get('hour'), minute: get('minute') }
}

const authorName = (by: ChatbotSettingsAuthor | null) => by?.displayName.trim() || null

/** «Guardado por Ana López · 12 nov 2026, 10:30» in the branch zone; nothing when nobody saved. */
export function formatSavedBy(by: ChatbotSettingsAuthor | null, at: string | null, timeZone: string): string | null {
  const name = authorName(by)
  if (!name) return null
  const clock = at ? clockParts(at, timeZone) : null
  if (!clock) return `Guardado por ${name}`
  return `Guardado por ${name} · ${clock.day} ${clock.month} ${clock.year}, ${clock.hour}:${clock.minute}`
}

/** Headline of the 409 banner: «Ana López guardó cambios a las 10:30»; «otra persona» / «antes que tú» when current lacks them. */
export function conflictHeadline(by: ChatbotSettingsAuthor | null, at: string | null, timeZone: string): string {
  const who = authorName(by) ?? 'Otra persona'
  const clock = at ? clockParts(at, timeZone) : null
  if (!clock) return `${who} guardó cambios antes que tú`
  const article = Number(clock.hour) === 1 ? 'a la' : 'a las'
  return `${who} guardó cambios ${article} ${clock.hour}:${clock.minute}`
}

export type SaveNoticeKind = 'failed' | 'partial'

/** `recompute` after a save: only FAILED and PARTIAL deserve a notice. */
export function saveNotice(recompute: ChatbotRecompute): SaveNoticeKind | null {
  if (recompute === 'FAILED') return 'failed'
  if (recompute === 'PARTIAL') return 'partial'
  return null
}

/** Generic copy; a 400 never names a field because the server does not. */
const MESSAGES: Record<SettingsErrorKind, string> = {
  validation: 'Revisa los datos e intenta de nuevo. Algún valor no es válido.',
  forbidden: 'Ya no tienes permiso para hacer esto. Pide el permiso a quien administra tu rol.',
  server: 'No se pudo completar la operación. No se perdió nada; es seguro volver a intentarlo.',
  network: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.',
  conflict: 'La configuración cambió mientras la revisabas. Recárgala y vuelve a intentarlo.',
}

export const applyErrorMessage = (kind: SettingsErrorKind): string => MESSAGES[kind]
