/**
 * In-app notifications — wire types, typed against houndfe-backend
 * `docs/frontend-handoff/13-notifications.md` at 86f9b6b7.
 *
 * `title` and `body` are Spanish text built by the server. They are plain text: never render them
 * as HTML. There is no CASL permission; the user and the branch come from the JWT.
 */

/** Types the backend produces today (13 §2) and the ones unit 7 adds; unknown future types still render. */
export type NotificationType =
  | 'REQUEST_CREATED'
  | 'REQUEST_REASSIGNED'
  | 'REQUEST_CANCELLED'
  | 'REQUEST_CLAIM_REMINDER'
  | 'REQUEST_ESCALATION'
  | 'REQUEST_OVERDUE'

export interface NotificationItem {
  id: string
  /** Typed as the known union, but the client tolerates a type it has never seen. */
  type: NotificationType | (string & {})
  title: string
  body: string
  /** `null` only for notices that are not about a request (none today). */
  requestId: string | null
  /** ISO instant. For a notice held out of hours, the instant it was released. */
  createdAt: string
  /** ISO instant, `null` while unread. */
  readAt: string | null

  // Announced by the backend, not yet on the wire (parent update). Typed now so the row can use
  // them later; nothing in this unit depends on them.
  folio?: string | null
  subtype?: string | null
  /** Why a REQUEST_CANCELLED closed (may include `MERGED`). */
  cause?: string | null
  /** On 80 % / overdue notices: yours (`ASSIGNEE`) or by permission (`ESCALATION`). */
  reason?: 'ASSIGNEE' | 'ESCALATION' | null
  requestOpen?: boolean | null
}

export interface NotificationsPage {
  items: NotificationItem[]
  /** Opaque: send it back unchanged. `null` is the last page. */
  nextCursor: string | null
}

export interface NotificationsListParams {
  cursor?: string
  /** 1–50, default 20. */
  limit?: number
  /** Only `true` is ever sent; `false` is the unfiltered list. */
  unread?: boolean
}

export interface UnreadCountResponse {
  count: number
}

export interface MarkReadResponse {
  id: string
  readAt: string
}

export interface MarkAllReadResponse {
  updated: number
}

/** `GET /me/notification-preferences`. Only `soundEnabled` is read here; /perfil edits them. */
export interface NotificationPreferences {
  emailEnabled: boolean
  soundEnabled: boolean
}

export interface NotificationReadOptions {
  /** The executing TanStack query signal. */
  signal?: AbortSignal
}
