/** es-MX copy of the conversation errors (handoff 18 §6). Switches on status, never on `message`. */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'

export const MEDIA_PURGED_COPY = 'Este archivo ya no está disponible (se elimina a los 12 meses)'

export function mediaErrorMessage(err: unknown): string {
  switch (readApiErrorEnvelope(err).status) {
    case 410:
      return MEDIA_PURGED_COPY
    case 403:
      return 'No tienes permiso para ver este archivo.'
    case 404:
      return 'No encontramos este archivo.'
    default:
      return 'No se pudo cargar el archivo. Revisa tu conexión e inténtalo de nuevo.'
  }
}

export function conversationErrorMessage(err: unknown): string {
  if (readApiErrorEnvelope(err).status === 403) {
    return 'No tienes permiso para ver la conversación de esta solicitud.'
  }
  return 'No pudimos cargar la conversación. Aquí solo se lee, no se perdió nada. Revisa tu conexión e inténtalo de nuevo.'
}
