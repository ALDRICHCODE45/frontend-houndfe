/**
 * The live session as the detail shows it (handoff 20 §1–§2): the five state badges, the elapsed
 * time of «Conectando…», how long the customer has been silent, and which composer the viewer gets.
 */
import type {
  ChatbotLiveSessionState,
  ChatbotRequestDetail,
  ChatbotRequestLiveSession,
} from '../interfaces/chatbot-request.types'

export type SessionTone = 'info' | 'success' | 'warning' | 'neutral'

export interface SessionBadge {
  label: string
  tone: SessionTone
  /** Shows a spinner: the session is changing state. */
  busy: boolean
}

const BADGES: Record<ChatbotLiveSessionState, SessionBadge> = {
  STARTING: { label: 'Conectando…', tone: 'info', busy: true },
  ACTIVE: { label: 'En vivo', tone: 'success', busy: false },
  ENDING: { label: 'Terminando…', tone: 'warning', busy: true },
  ENDED: { label: 'Terminada', tone: 'neutral', busy: false },
  WAITING: { label: 'Sin confirmar', tone: 'warning', busy: false },
}

export function sessionBadge(state: ChatbotLiveSessionState): SessionBadge {
  return BADGES[state]
}

/** «m:ss» since `since` (the claim time while STARTING); `null` without a valid date. Never negative. */
export function elapsedLabel(since: string | null | undefined, now: Date): string | null {
  const start = since ? Date.parse(since) : Number.NaN
  if (!Number.isFinite(start)) return null
  const seconds = Math.max(0, Math.floor((now.getTime() - start) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Whole minutes since the customer's last message; `null` when unknown. */
export function silentMinutes(session: ChatbotRequestLiveSession | null, now: Date): number | null {
  const last = session?.lastCustomerMessageAt ? Date.parse(session.lastCustomerMessageAt) : Number.NaN
  if (!Number.isFinite(last)) return null
  return Math.max(0, Math.floor((now.getTime() - last) / 60_000))
}

/**
 * The attendee: the assignee of an open request that has a session. Without `read:ChatbotConversation`
 * the server still answers them their own session's messages (handoff 20 §5).
 */
export function isAttendee(detail: ChatbotRequestDetail, currentUserId: string | null | undefined): boolean {
  return (
    !!currentUserId &&
    detail.status === 'IN_PROGRESS' &&
    detail.liveSession !== null &&
    detail.assignee?.id === currentUserId
  )
}

export type ComposerMode =
  | 'none'
  | 'composer'
  | 'blocked'
  | 'connecting'
  | 'waiting'
  | 'ended'
  | 'readonly'

export interface ComposerModeInput {
  detail: ChatbotRequestDetail
  currentUserId: string | null | undefined
  windowClosed: boolean
}

/** What sits under the thread: the composer, its blocked variant, or an explanation. */
export function composerMode({ detail, currentUserId, windowClosed }: ComposerModeInput): ComposerMode {
  const session = detail.liveSession
  if (!session) return 'none'
  if (session.state === 'ENDING' || session.state === 'ENDED') return 'ended'
  if (session.state === 'WAITING') return 'waiting'
  if (!isAttendee(detail, currentUserId)) return 'readonly'
  if (session.state === 'STARTING') return 'connecting'
  if (!detail.allowedActions.includes('SEND_MESSAGE')) return 'readonly'
  return windowClosed ? 'blocked' : 'composer'
}
