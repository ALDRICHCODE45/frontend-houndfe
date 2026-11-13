/**
 * In-app notifications — wire types, typed against houndfe-backend
 * `docs/frontend-handoff/13-notifications.md` at 8c12ae09.
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
  | 'CONVERSATION_CUSTOMER_MESSAGE'
  | 'CONVERSATION_UNANSWERED'

/** Close causes of a REQUEST_CANCELLED notice (13 §2). A future cause still renders (no cause line). */
export type NotificationCause =
  | 'CUSTOMER'
  | 'RESOLVED_BY_OTHER'
  | 'CANCELLED_BY_OTHER'
  | 'SIBLING_RESOLVED'
  | 'MERGED'

export type NotificationReason = 'ASSIGNEE' | 'ESCALATION'

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

  // Structured fields (13 §3, 8c12ae09). All optional: a backend before 8c12ae09 omits them, and
  // the row must then render exactly as it did without them.
  /** Formatted like the inbox (`S-000123`); `null` only on a row that has none. */
  folio?: string | null
  /** Request subtype code (`UNKNOWN_QUESTION`, …), not the Spanish label. */
  subtype?: string | null
  /** Why a REQUEST_CANCELLED closed; `null` for other types and for rows written before causes. */
  cause?: NotificationCause | null
  /** Only on REQUEST_ESCALATION / REQUEST_OVERDUE: yours (`ASSIGNEE`, wins) or by permission (`ESCALATION`). */
  reason?: NotificationReason | null
  /** The linked request is NEW / IN_PROGRESS at the moment of the read; `null` without a request. */
  requestOpen?: boolean | null
  /** Only on CONVERSATION_UNANSWERED (handoff 20 §T11d): minutes the customer has waited, 5 or 15. Absent → the label has no minutes. */
  level?: number | null
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
