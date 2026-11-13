/**
 * Delivery state of an outgoing message as the live chat shows it (handoff 20 §3, design 04 «Estados
 * de entrega»): icon + words (colour only reinforces), the one extra line that explains the state,
 * and the one button that fits. «Pendiente de envío» is computed here: the backend has no such
 * status, it is a `QUEUED` message that did not reach `SENT` in 30 s.
 */
import type { ChatbotMessage } from '../interfaces/chatbot-request.types'

export const PENDING_SEND_MS = 30_000

export type DeliveryKey =
  | 'QUEUED'
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'DEFERRED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'UNCONFIRMED'
export type DeliveryTone = 'neutral' | 'read' | 'warn' | 'bad'
/**
 * `retry`: «Reintentar» (FAILED creates a new message; UNCONFIRMED resends the same id, which the
 * server answers without duplicating). `resend`: «Enviar como mensaje nuevo» (UNKNOWN, a new message).
 */
export type DeliveryAction = 'retry' | 'resend'

export interface DeliveryView {
  key: DeliveryKey
  label: string
  tone: DeliveryTone
  icon: string
  note: string | null
  action: DeliveryAction | null
}

export interface DeliveryOptions {
  now: Date
  /** The attendee already sent this one again as a new message. */
  retried?: boolean
  /** The viewer is the attendee who may send; others never see the buttons. Default true. */
  canAct?: boolean
}

const BASE: Record<DeliveryKey, Omit<DeliveryView, 'key' | 'note' | 'action'>> = {
  QUEUED: { label: 'En cola', tone: 'neutral', icon: 'i-lucide-clock' },
  PENDING: { label: 'Pendiente de envío', tone: 'warn', icon: 'i-lucide-triangle-alert' },
  SENT: { label: 'Enviado', tone: 'neutral', icon: 'i-lucide-check' },
  DELIVERED: { label: 'Entregado', tone: 'neutral', icon: 'i-lucide-check-check' },
  READ: { label: 'Leído', tone: 'read', icon: 'i-lucide-check-check' },
  DEFERRED: { label: 'No enviado, ventana cerrada', tone: 'warn', icon: 'i-lucide-triangle-alert' },
  FAILED: { label: 'No enviado', tone: 'bad', icon: 'i-lucide-triangle-alert' },
  UNKNOWN: { label: 'Entrega dudosa', tone: 'warn', icon: 'i-lucide-circle-help' },
  UNCONFIRMED: { label: 'No sabemos si se envió', tone: 'warn', icon: 'i-lucide-circle-help' },
}

function keyOf(message: ChatbotMessage, now: Date): DeliveryKey | null {
  const status = message.deliveryStatus
  if (!status) return null
  if (status === 'FAILED' && message.unconfirmed) return 'UNCONFIRMED'
  if (status === 'QUEUED') {
    const created = Date.parse(message.createdAt)
    if (Number.isFinite(created) && now.getTime() - created >= PENDING_SEND_MS) return 'PENDING'
  }
  return status
}

function noteOf(key: DeliveryKey, message: ChatbotMessage, now: Date, staff: boolean): string | null {
  if (!staff) return null
  const template = message.type === 'TEMPLATE'
  switch (key) {
    case 'PENDING': {
      const seconds = Math.floor((now.getTime() - Date.parse(message.createdAt)) / 1000)
      return `Sigue en cola desde hace ${seconds} s. Todavía no sale; no hace falta escribirlo otra vez.`
    }
    case 'DEFERRED':
      return 'WhatsApp cerró la ventana. Se reenvía solo si el cliente vuelve a escribir; si la conversación termina antes, queda como «No enviado».'
    case 'FAILED':
      return template
        ? 'La plantilla no se entregó. Puedes reintentar desde el recuadro de abajo.'
        : 'No se pudo enviar. El cliente no lo recibió.'
    case 'UNCONFIRMED':
      return 'Puede que el cliente ya lo haya recibido: se perdió la conexión antes de la respuesta. Reintentar es seguro, no se duplica.'
    case 'UNKNOWN':
      return template
        ? 'Puede que ya se haya enviado y costado. No se puede reenviar: espera la respuesta del cliente.'
        : 'Puede que el cliente ya lo haya recibido. Reenviarlo crea un mensaje nuevo.'
    default:
      return null
  }
}

/** `null` for incoming messages and for marks with no status. */
export function deliveryView(message: ChatbotMessage, options: DeliveryOptions): DeliveryView | null {
  if (message.direction !== 'OUT') return null
  const key = keyOf(message, options.now)
  if (!key) return null

  const staff = message.author === 'STAFF'
  const template = message.type === 'TEMPLATE'
  const retried = options.retried === true
  let action: DeliveryAction | null = null
  if (staff && !template && !retried && options.canAct !== false) {
    if (key === 'FAILED' || key === 'UNCONFIRMED') action = 'retry'
    else if (key === 'UNKNOWN') action = 'resend'
  }
  const resent = staff && !template && retried && (key === 'FAILED' || key === 'UNKNOWN')
  return {
    key,
    ...BASE[key],
    note: resent ? 'Reenviado como mensaje nuevo.' : noteOf(key, message, options.now, staff),
    action,
  }
}
