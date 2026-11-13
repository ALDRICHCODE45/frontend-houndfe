/**
 * Realtime (SSE) contract types. Source: houndfe-backend
 * `docs/frontend-handoff/17-realtime-sse.md` (BE bf051a42).
 *
 * Row-shaped payloads (`request`, `message`) are the same objects the REST
 * routes return (handoff 14 §3 / 18 §2). They are kept structurally open here:
 * the feature layer (T4b) owns their precise types, and this core module must
 * not import from `features/`.
 */

export type RealtimeRow = Record<string, unknown> & { id?: string }

export interface RealtimeCustomerCard {
  id: string | null
  displayName: string | null
  /** Masked unless the user has `read:CustomerPhone`. Never mask/unmask in the FE. */
  phone: string | null
  isTrusted: boolean
}

/** Payload shared by every `request.*` event (handoff 17 §3.1). */
export interface RequestEventPayload {
  /** Same row as `GET /chatbot-requests/groups`, including `version`. */
  request: RealtimeRow & { version?: number; customerKey?: string }
  customer: RealtimeCustomerCard
  /** `null` today; a sealed `k1.…` token when a request moved groups. */
  previousCustomerKey: string | null
}

export const REQUEST_EVENT_TYPES = [
  'request.created',
  'request.claimed',
  'request.released',
  'request.reassigned',
  'request.resolved',
  'request.cancelled',
  'request.overdue',
  'request.updated',
] as const
export type RequestEventType = (typeof REQUEST_EVENT_TYPES)[number]

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  requestId?: string | null
  createdAt: string
  readAt: string | null
}

export interface NotificationCreatedPayload {
  notification: NotificationItem
  /** The person's unread count at delivery time: set the badge to it. */
  unreadCount: number
}

export interface NotificationReadPayload {
  /** `null` when `all` is true. */
  ids: string[] | null
  all: boolean
  unreadCount: number
}

export interface ConversationMessagePayload {
  requestId: string
  /** The message of handoff 18 §2 (state at delivery, replace by `seq`). */
  message: RealtimeRow & { seq?: number }
}

export interface MessageStatusPayload {
  requestId: string
  messageId: string
  seq: number
  deliveryStatus: string
}

/** `session.*` events arrive with handoff unit 11; payload is intentionally open. */
export type SessionEventType = `session.${string}`
export type SessionEventPayload = Record<string, unknown>

export type ResyncReason = 'CURSOR_EXPIRED' | 'REPLAY_TOO_LARGE' | 'DELIVERY_FAILED'

export interface ReadyPayload {
  serverTime: string
  heartbeatSeconds: number
}

export interface ResyncPayload {
  reason: ResyncReason
}

/** Events a feature can subscribe to (control events `ready` and `resync` included). */
export interface RealtimeEventMap {
  ready: ReadyPayload
  resync: ResyncPayload
  'request.created': RequestEventPayload
  'request.claimed': RequestEventPayload
  'request.released': RequestEventPayload
  'request.reassigned': RequestEventPayload
  'request.resolved': RequestEventPayload
  'request.cancelled': RequestEventPayload
  'request.overdue': RequestEventPayload
  'request.updated': RequestEventPayload
  'notification.created': NotificationCreatedPayload
  'notification.read': NotificationReadPayload
  'conversation.message': ConversationMessagePayload
  'message.status': MessageStatusPayload
}
export type RealtimeEventType = keyof RealtimeEventMap

export interface RealtimeEventMeta {
  /** The `id:` of the message (cursor); `null` for control events without one. */
  id: string | null
}

export type RealtimeHandler<P> = (payload: P, meta: RealtimeEventMeta) => void

/** Any delivered event, as it travels between tabs. */
export interface RealtimeEnvelope {
  type: string
  id: string | null
  data: unknown
}

export type StopReason =
  /** `connection-replaced`: a 6th stream replaced this one. Offer «Abierto en otra ventana». */
  | 'replaced'
  /** `access-revoked`: refetch permissions, restart only if still allowed. */
  | 'revoked'
  /** HTTP 403: no membership / no `read:ChatbotRequest`. */
  | 'forbidden'
  /** 401 that a refresh could not fix. */
  | 'unauthorized'
  /**
   * The access token in the shared storage is not (or cannot be shown to be) the one of the
   * session the stream was started for: another tab signed in or switched sucursal, or the token
   * is undecodable. Nothing was sent. The lifecycle starts a new session when the auth store's
   * user / tenant change; `reconnect()` checks again.
   */
  | 'identity-mismatch'
  /** Anything unrecoverable (for example a 400 that persists without a cursor). */
  | 'error'

export type RealtimeState =
  /** Flag off, `start()` not called, or `stop()` called: nothing connects. */
  | 'idle'
  | 'connecting'
  | 'open'
  /** Waiting to retry after a failure or a server-side close. */
  | 'reconnecting'
  /** Stopped on purpose; `reason` says why. Does not retry by itself. */
  | 'stopped'

export interface RealtimeStatus {
  state: RealtimeState
  /** Which role this tab plays; `none` while idle. */
  role: 'leader' | 'follower' | 'none'
  reason?: StopReason
}

export interface RealtimeIdentity {
  userId: string
  tenantId: string
}

/** The pieces of the auth layer the stream needs (kept behind a port so tests can fake them). */
export interface RealtimeAuthPort {
  getAccessToken(): string | null
  /**
   * Make sure a fresh token is stored after `staleToken` was rejected (or expired).
   * Resolves `true` when `getAccessToken()` is worth retrying, `false` when the
   * session is gone (the caller must stop).
   */
  refresh(staleToken: string | null): Promise<boolean>
  /**
   * Does `token` belong to this session (same user and tenant)? Checked before every connect, so a
   * token written by another tab's login / tenant switch is never sent. Absent: no check (tests).
   */
  tokenMatches?(token: string, identity: RealtimeIdentity): boolean
}
