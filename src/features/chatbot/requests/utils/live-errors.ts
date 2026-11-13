/**
 * Errors of the live conversation calls (handoff 20 §3, §3b, §3c) → what the composer does and says.
 * Switches on `code`, never on `message`. `readLiveError` wraps `readRequestError` and adds what the
 * live 409s carry in their body: `templateAllowed`, `whatsappWindowClosesAt`, `sessionState`,
 * `currentEpoch`.
 */
import { isRetryableError } from './command-copy'
import { attachmentErrorFor, attachmentTypeMessage } from './live-attachments'
import { readRequestError, requestErrorMessage, type ChatbotRequestError } from './requestErrors'

export interface LiveError extends ChatbotRequestError {
  /** `409 WINDOW_CLOSED`: the template button can be pressed now. */
  templateAllowed: boolean | null
  windowClosesAt: string | null
  /** `409 SESSION_NOT_ACTIVE`. */
  sessionState: string | null
  /** `409 STALE_EPOCH`. */
  currentEpoch: number | null
  /** Network failure or `5xx`: the answer is unknown, so the same key is resent safely. */
  retryable: boolean
}

function bodyOf(err: unknown): Record<string, unknown> {
  const response = (err as { response?: { data?: unknown } } | null)?.response
  const data = response?.data
  return data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
}

export function readLiveError(err: unknown): LiveError {
  const base = readRequestError(err)
  const body = bodyOf(err)
  return {
    ...base,
    templateAllowed: typeof body.templateAllowed === 'boolean' ? body.templateAllowed : null,
    windowClosesAt: typeof body.whatsappWindowClosesAt === 'string' ? body.whatsappWindowClosesAt : null,
    sessionState: typeof body.sessionState === 'string' ? body.sessionState : null,
    currentEpoch: typeof body.currentEpoch === 'number' ? body.currentEpoch : null,
    retryable: isRetryableError(base),
  }
}

export interface LiveNotice {
  tone: 'info' | 'warn' | 'danger'
  title: string
  detail: string
  /** The request moved: refetch the detail (the draft stays in the box). */
  refetch: boolean
}

export interface LiveNoticeOptions {
  /** Name of the attachment the call was about. */
  fileName?: string
}

const make = (tone: LiveNotice['tone'], title: string, detail: string, refetch = false): LiveNotice => ({
  tone,
  title,
  detail,
  refetch,
})

export function liveErrorNotice(error: LiveError, options: LiveNoticeOptions = {}): LiveNotice {
  const file = options.fileName ?? 'El archivo'
  if (error.status === null || error.retryable) {
    return make(
      'warn',
      'No se pudo confirmar el envío',
      'Revisa tu conexión. No se perderá: al pulsar Reintentar se envía una sola vez.',
    )
  }
  switch (error.code) {
    case 'WINDOW_CLOSED':
      return make(
        'warn',
        'La ventana de 24 h está cerrada',
        'WhatsApp solo deja escribir libremente 24 h después del último mensaje del cliente. Tu borrador se conservó.',
      )
    case 'WINDOW_OPEN':
      return make('info', 'La ventana sigue abierta', 'Ya puedes escribirle un mensaje al cliente: no hace falta la plantilla.')
    case 'STALE_EPOCH':
      return make(
        'warn',
        'La conversación cambió',
        'Otra persona la tomó o la reasignó mientras escribías. Actualizamos los datos y tu borrador sigue en el cuadro de mensaje.',
        true,
      )
    case 'NOT_ASSIGNEE':
      return make(
        'warn',
        'Ya no la atiendes tú',
        'Te la reasignaron o la tomó otra persona. El mensaje no se envió. Actualizamos los datos.',
        true,
      )
    case 'SESSION_NOT_ACTIVE':
      return error.sessionState === 'STARTING'
        ? make(
            'info',
            'La conversación todavía no está activa',
            'El bot aún no confirma que se calló. Podrás escribir en cuanto lo haga.',
            true,
          )
        : make(
            'warn',
            'La conversación ya no está activa',
            'Terminó mientras escribías. No se envió nada; tu borrador sigue en el cuadro.',
            true,
          )
    case 'TEMPLATE_NOT_CONFIGURED':
      return make(
        'warn',
        'No hay plantilla configurada',
        'Esta sucursal no tiene una plantilla en Ajustes del chatbot. Pide a un administrador que la configure.',
      )
    case 'TEMPLATE_ALREADY_SENT':
      return make(
        'info',
        'La plantilla ya se envió',
        'Solo se envía una por ventana cerrada. Espera a que el cliente responda.',
        true,
      )
    case 'MEDIA_TOO_LARGE':
      return make('danger', 'El archivo es muy grande', attachmentErrorFor(413, file) ?? '')
    case 'MEDIA_TYPE_NOT_ALLOWED':
      return make('danger', 'Tipo de archivo no permitido', attachmentTypeMessage(file))
    case 'MEDIA_NOT_FOUND':
    case 'MEDIA_PURGED':
      return make('danger', 'No encontramos el archivo', 'Ya no está disponible en el servidor. Súbelo de nuevo.')
    case 'MEDIA_TYPE_MISMATCH':
      return make('danger', 'El archivo no coincide con el tipo', 'Una imagen no puede ir como documento ni al revés. Súbelo de nuevo.')
    default:
      if (error.status === 413) return make('danger', 'El archivo es muy grande', attachmentErrorFor(413, file) ?? '')
      if (error.status === 415) return make('danger', 'Tipo de archivo no permitido', attachmentTypeMessage(file))
      return make('danger', 'No se pudo enviar', requestErrorMessage(error))
  }
}
