/** Errors of the chatbot settings API (handoff 16 §4-§5) → what the screen does. Switches on status and `code`, never on `message`. */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import {
  chatbotSettingsSchema,
  type ChatbotRecompute,
  type ChatbotSettings,
} from '../interfaces/chatbot-settings.types'

export type SettingsErrorKind = 'conflict' | 'validation' | 'forbidden' | 'network' | 'server'

export interface SettingsError {
  kind: SettingsErrorKind
  status: number | null
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
  return { kind, status, current: parsed?.success ? parsed.data : null }
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
