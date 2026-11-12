/**
 * Presentation helpers of the conversation block: bubble side and author, message time, day
 * separators and the inline treatment of each media type. Text is never HTML here; callers render
 * `message.text` as text.
 */
import type { ChatbotMessage, ChatbotMessageDeliveryStatus } from '../interfaces/chatbot-request.types'

export type MessageSide = 'them' | 'bot' | 'staff' | 'system'
export type MediaKind = 'image' | 'sticker' | 'pdf' | 'audio'

/** Customer left; bot and staff right (the design's `bubble.them / .bot / .staff`). By author, not direction. */
export function messageSide(message: ChatbotMessage): MessageSide {
  switch (message.author) {
    case 'CUSTOMER':
      return 'them'
    case 'STAFF':
      return 'staff'
    case 'SYSTEM':
      return 'system'
    default:
      return 'bot'
  }
}

export function authorLabel(message: ChatbotMessage): string {
  switch (message.author) {
    case 'CUSTOMER':
      return 'Cliente'
    case 'STAFF':
      return message.staff?.displayName?.trim() || 'Equipo'
    case 'SYSTEM':
      return 'Sistema'
    default:
      return 'Bot'
  }
}

function instantOf(message: ChatbotMessage): Date | null {
  const date = new Date(message.providerTimestamp ?? message.createdAt)
  return Number.isNaN(date.getTime()) ? null : date
}

/** «10:05» in the given zone; empty for an invalid date. */
export function messageTime(message: ChatbotMessage, timeZone?: string): string {
  const date = instantOf(message)
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${Number(part('hour'))}:${part('minute')}`
}

function dayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(date)
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

function dayLabel(date: Date, key: string, nowKey: string, timeZone?: string): string {
  const diff = dayNumber(key) - dayNumber(nowKey)
  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  const parts = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? '').replace(/\.$/, '')
  const base = `${part('weekday')} ${Number(part('day'))} ${part('month')}`
  return key.slice(0, 4) === nowKey.slice(0, 4) ? base : `${base} ${part('year')}`
}

export interface DayGroup {
  key: string
  label: string
  messages: ChatbotMessage[]
}

export interface DayOptions {
  now?: Date
  timeZone?: string
}

/** Consecutive messages (already in `seq` order) split at local midnight. A message with no valid date joins the previous day. */
export function groupByDay(messages: readonly ChatbotMessage[], options: DayOptions = {}): DayGroup[] {
  const { timeZone } = options
  const nowKey = dayKey(options.now ?? new Date(), timeZone)
  const groups: DayGroup[] = []
  for (const message of messages) {
    const date = instantOf(message)
    const last = groups[groups.length - 1]
    const key = date ? dayKey(date, timeZone) : (last?.key ?? 'unknown')
    if (last && last.key === key) {
      last.messages.push(message)
    } else {
      groups.push({
        key,
        label: date ? dayLabel(date, key, nowKey, timeZone) : 'Sin fecha',
        messages: [message],
      })
    }
  }
  return groups
}

/** How the file of a message is shown; `null` for messages with no file. */
export function mediaKind(message: ChatbotMessage): MediaKind | null {
  if (!message.media) return null
  switch (message.type) {
    case 'IMAGE':
      return 'image'
    case 'STICKER':
      return 'sticker'
    case 'DOCUMENT':
      return 'pdf'
    case 'AUDIO':
      return 'audio'
    default:
      return null
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DELIVERY_LABELS: Partial<Record<ChatbotMessageDeliveryStatus, string>> = {
  QUEUED: 'En cola',
  DEFERRED: 'En espera',
  SENT: 'Enviado',
  DELIVERED: 'Entregado',
  READ: 'Leído',
  FAILED: 'No se entregó',
}

/** Delivery state of an outgoing message; `null` for incoming ones and for `UNKNOWN`. */
export function deliveryLabel(status: ChatbotMessageDeliveryStatus | null | undefined): string | null {
  return (status && DELIVERY_LABELS[status]) || null
}
