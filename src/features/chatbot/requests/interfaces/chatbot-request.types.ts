/**
 * Chatbot request inbox — wire types. Typed exactly against houndfe-backend
 * `docs/frontend-handoff/14-chatbot-request-inbox.md` (incl. §14 v1.3),
 * `11-chatbot-request-commands.md` and `12-chatbot-request-resolve.md` at 86f9b6b7, plus
 * `19-clarification-replies.md` and `20-live-conversation.md` (§2 liveSession, §4 finish) at ff5baa0d,
 * and `21-scheduled-conversations.md` (scheduling, reschedule) at 5b549e18.
 *
 * Text that comes from the bot or the customer (`summary`, `needs`, `context`, snapshots) is
 * plain text: never render it as HTML. The backend decides what a phone looks like (masked
 * unless `read:CustomerPhone`); nothing here masks or unmasks.
 */

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export type ChatbotRequestKind = 'DECISION' | 'CLARIFICATION' | 'CONVERSATION'

export type ChatbotRequestSubtype =
  | 'RESTOCK'
  | 'EXPIRATION'
  | 'DELIVERY_ZONE'
  | 'TRANSFER_RECEIPT'
  | 'TALK_TO_HUMAN'
  | 'COMPLAINT'
  | 'UNKNOWN_QUESTION'
  | 'DISCOUNT'

export type ChatbotRequestStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED'

/** `EXPIRED` is an open request with `overdueAt`; otherwise it equals `status`. */
export type ChatbotRequestDisplayStatus = ChatbotRequestStatus | 'EXPIRED'

/** Business-time traffic light computed by the backend. The FE never computes thresholds. */
export type ChatbotRequestSlaLevel = 'OK' | 'HALF' | 'ESCALATION' | 'OVERDUE'

export type ChatbotRequestCancelReason =
  | 'CUSTOMER_WITHDREW'
  | 'SUPERSEDED'
  | 'AUTO_RESOLVED'
  | 'STAFF'

export type ChatbotRequestStaffCancelReason =
  | 'DUPLICATE'
  | 'NOT_ACTIONABLE'
  | 'CUSTOMER_UNREACHABLE'
  | 'OTHER'

/**
 * Order of the contract (handoff 19 §2: `CLAIM, RELEASE, REASSIGN, RESOLVE, REPLY, MERGE,
 * LINK_CUSTOMER, CANCEL`); rows never carry MERGE / LINK_CUSTOMER, the detail can. The live ones
 * (handoff 20 §2) are typed so a list never breaks, but `SEND_MESSAGE` and `SEND_TEMPLATE` have no
 * UI until the live chat (T5L): the action panel hides what the FE does not handle.
 */
export type ChatbotRequestAction =
  | 'CLAIM'
  | 'RELEASE'
  | 'REASSIGN'
  | 'RESOLVE'
  | 'REPLY'
  | 'MERGE'
  | 'LINK_CUSTOMER'
  | 'CANCEL'
  | 'SEND_MESSAGE'
  | 'SEND_TEMPLATE'
  | 'FINISH'
  | 'FINISH_IDLE'
  /** Handoff 21 §1.2: an open, scheduled, not-started request. */
  | 'RESCHEDULE'

/** Codes of `deniedActions` (handoff 14 §14.4): exactly what the command would answer. */
export type ChatbotRequestDeniedCode =
  | 'INSUFFICIENT_PERMISSIONS'
  | 'REQUEST_CLAIMED_BY_OTHER'
  | 'NOT_ASSIGNEE'
  | 'CANCEL_NOT_ALLOWED'
  /** Handoff 21 §1.2: `CLAIM` of a scheduled request more than 5 minutes ahead of its time. */
  | 'SCHEDULED_TOO_EARLY'

export interface ChatbotRequestDeniedAction {
  action: ChatbotRequestAction
  code: ChatbotRequestDeniedCode
  /** Only with `SCHEDULED_TOO_EARLY`: ISO instant (`scheduledFor − 5 min`) from which `CLAIM` is offered. */
  claimableAt?: string
}

export interface ChatbotRequestPerson {
  id: string
  displayName: string
}

/**
 * `STARTING` → `ACTIVE` → `ENDING` → `ENDED`; `WAITING` is an open request whose session ended
 * without finishing it (the start-timeout revert). Handoff 20 §1.
 */
export type ChatbotLiveSessionState = 'STARTING' | 'ACTIVE' | 'ENDING' | 'ENDED' | 'WAITING'

/** The attendee is the row's `assignee`, not repeated here. */
export interface ChatbotRequestLiveSession {
  state: ChatbotLiveSessionState
  /** `expectedEpoch` of messages and templates. */
  handoffEpoch: number
  /** The attendee's last message in this session (at the claim: the claim time). */
  lastStaffActivityAt: string | null
  lastCustomerMessageAt: string | null
}

export type ChatbotComplaintOutcome = 'RETURN' | 'REPLACEMENT' | 'REFUND' | 'NO_ACTION'

/** Handoff 19 §3: the answer of a clarification, `null` until it is answered. */
export interface ChatbotRequestReply {
  id: string
  /** Plain text: never HTML. */
  text: string
  repliedBy: ChatbotRequestPerson
  repliedAt: string
}

// ─── Row (groups, ?customerKey=, history, otherOpenRequests, merge-candidates) ─

export interface ChatbotRequestMergedInto {
  id: string
  /** `S-000123`. */
  folio: string
}

/** Handoff 21 §1: the cause of «Por reagendar». */
export type ChatbotRescheduleReason = 'CLOSED_DATE' | 'HOURS_CHANGED'

export interface ChatbotRequestRow {
  id: string
  /** `S-000123`. */
  folio: string
  /** Opaque sealed token (`k1.…`): group and cache by it, never parse or build one. */
  customerKey: string
  kind: ChatbotRequestKind
  subtype: ChatbotRequestSubtype
  status: ChatbotRequestStatus
  displayStatus: ChatbotRequestDisplayStatus
  /** Bot text: show as text. */
  summary: string
  assignee: ChatbotRequestPerson | null
  createdAt: string
  claimDeadlineAt: string | null
  resolveDeadlineAt: string | null
  overdueAt: string | null
  /** The tenant calendar is closed now and the request is open. Derived on every read. */
  slaPaused: boolean
  /** Next opening while `slaPaused`, else `null`. */
  slaResumesAt: string | null
  whatsappWindowClosesAt: string | null
  /** Handoff 14 §16: open and inside the branch windowWarningMinutes (same rule as the filter). */
  windowClosingSoon?: boolean
  unreadCustomerMessages: number
  /** ISO UTC instant the customer booked, or `null`. Show it in the branch's time zone. */
  scheduledFor: string | null
  /** Handoff 21 §1: 1 at booking, +1 per reschedule and cancel, `0` when never scheduled. Not a concurrency token. */
  scheduleVersion: number
  requiresTemplateAtStart: boolean
  /** Handoff 21 §1: the branch hours changed and `scheduledFor` is outside them; staff must move it. */
  needsReschedule: boolean
  /**
   * Handoff 21 §1: why `needsReschedule` is set — `CLOSED_DATE` (the day is closed; wins over the hours) or
   * `HOURS_CHANGED`. `null` when not flagged or flagged before the field existed (show the generic copy);
   * absent from an older backend.
   */
  needsRescheduleReason?: ChatbotRescheduleReason | null
  /** Handoff 20 §2: `null` unless the request is a conversation that had a session. */
  liveSession: ChatbotRequestLiveSession | null
  closedAt: string | null
  /** Null for open and for cancelled rows. */
  resolvedBy: ChatbotRequestPerson | null
  /** Value to send as `expectedVersion` in the commands. */
  version: number
  cancelReason: ChatbotRequestCancelReason | null
  staffCancelReason: ChatbotRequestStaffCancelReason | null
  mergedInto: ChatbotRequestMergedInto | null
  slaLevel: ChatbotRequestSlaLevel | null
  allowedActions: ChatbotRequestAction[]
  deniedActions: ChatbotRequestDeniedAction[]
  /**
   * Only on `/history` rows (handoff 14 §15.4): the same card as a group header. Absent on a
   * backend before 269804ce, so the history simply has no «Cliente» column then.
   */
  customer?: ChatbotRequestGroupCustomer
}

// ─── Groups, counts ───────────────────────────────────────────────────────────

export interface ChatbotRequestGroupCustomer {
  /** `null` when the request is not linked to a Customer: the phone is the only identity. */
  id: string | null
  displayName: string | null
  /** `"55 **** 5678"`, or the full E.164 with `read:CustomerPhone`; `null` on old rows. */
  phone: string | null
  isTrusted: boolean
}

export interface ChatbotRequestGroup {
  customerKey: string
  customer: ChatbotRequestGroupCustomer
  /** `null` for resolved / cancelled groups and for groups with no deadline. */
  mostUrgentAt: string | null
  /** The customer's open total, whatever the filter. */
  openCount: number
  /**
   * Exact count of the customer's open requests with `overdueAt`, whatever the filter (`0` on the
   * closed tabs). Absent on a backend before 269804ce: count the loaded rows instead.
   */
  overdueCount?: number
  /** Up to 10 matching rows. */
  requests: ChatbotRequestRow[]
  /** Matching rows left; page them with `GET /chatbot-requests?customerKey=`. */
  moreRequests: number
  /** Only on the resolved / cancelled tabs. */
  lastClosedAt?: string
}

export interface ChatbotRequestPage<T> {
  items: T[]
  nextCursor: string | null
}

export type ChatbotRequestGroupsPage = ChatbotRequestPage<ChatbotRequestGroup>
export type ChatbotRequestRowsPage = ChatbotRequestPage<ChatbotRequestRow>

export interface ChatbotRequestCounts {
  new: number
  inProgress: number
  mine: number
  overdue: number
  windowClosingSoon: number
  scheduled: number
  needsReschedule: number
  resolved7d: number
  cancelled7d: number
  openGroups: number
  /** Open requests with no assignee, per request. Absent on a backend before 269804ce. */
  unassigned?: number
}

// ─── Query params (only these keys are ever sent) ─────────────────────────────

/** `groups` and `?customerKey=` tabs; `scheduled` only exists on `groups`. */
export type ChatbotRequestListStatus = 'open' | 'resolved' | 'cancelled' | 'scheduled'

export interface ChatbotRequestGroupsParams {
  status?: ChatbotRequestListStatus
  subtype?: ChatbotRequestSubtype
  /** `me`, `unassigned` (alias `none`) or a user id. */
  assignee?: string
  overdue?: boolean
  windowClosingSoon?: boolean
  /** Folio, customer name or phone digits; at most 100 characters. */
  q?: string
  cursor?: string
  /** 1–50, default 25. */
  limit?: number
}

export type ChatbotRequestGroupsFilters = Omit<ChatbotRequestGroupsParams, 'cursor'>

/** The list filters `?customerKey=` accepts, with the same values and 400s as `groups` (§15.1). */
export type ChatbotRequestCustomerFilters = Pick<
  ChatbotRequestGroupsParams,
  'subtype' | 'assignee' | 'overdue' | 'windowClosingSoon' | 'q'
>

export interface ChatbotRequestCustomerParams extends ChatbotRequestCustomerFilters {
  /** Required token of a group. */
  customerKey: string
  status?: ChatbotRequestListStatus
  cursor?: string
  limit?: number
}

export interface ChatbotRequestHistoryParams {
  subtype?: ChatbotRequestSubtype
  /** User id of who resolved it. */
  resolvedBy?: string
  customerKey?: string
  /** `from` and `to` go together; span at most 92 days. */
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export interface ChatbotRequestAuditParams {
  cursor?: string
  /** 1–50, default 50. */
  limit?: number
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export interface ChatbotRequestCustomerCandidate {
  id: string
  displayName: string | null
  phone: string | null
  isTrusted: boolean
  customerSince: string | null
  lastOrderAt: string | null
}

export interface ChatbotRequestRecentOrder {
  saleId: string
  folio: string
  createdAt: string
  totalCents: number
  status: string
  paymentStatus: string
}

export interface ChatbotRequestDetailCustomer {
  id: string | null
  displayName: string | null
  phone: string | null
  customerSince: string | null
  isTrusted: boolean
  priceList: { id: string; name: string } | null
  /** Several customers share the phone and the bot left the request unlinked. */
  ambiguous: boolean
  /** For LINK_CUSTOMER; only while open and with no customer; at most 10. */
  candidates: ChatbotRequestCustomerCandidate[]
  /** Last five confirmed or canceled sales, newest first. */
  recentOrders: ChatbotRequestRecentOrder[]
}

/** Flat bot context (render as plain text). */
export interface ChatbotRequestContext {
  cartRef?: string
  saleId?: string
  orderId?: string
  productIds?: string[]
  variantIds?: string[]
  quantity?: number
}

/** What resolving would settle for a zone request: send `setVersion` as `expectedZoneSetVersion`. */
export interface ChatbotRequestZoneImpact {
  /** Open requesters of the postal code. */
  requests: number
  /** Their distinct customers. */
  customers: number
  /** Opaque, only grows. */
  setVersion: number
  /** On the detail (and, per handoff 14, on the route); `current.zoneImpact` of a 409 omits it. */
  validationId?: string
}

/** Chosen option after a resolve, plus who and when; `null` while open and on cancelled requests. */
export type ChatbotRequestResolution = {
  action: string
  resolvedBy: ChatbotRequestPerson
  resolvedAt: string
  [parameter: string]: unknown
} | null

export interface RestockDecision {
  subtype: 'RESTOCK'
  snapshot: {
    branchName: string | null
    productId: string
    productName: string
    variantId: string | null
    sku: string | null
    requestedQuantity: number
    observedStockAtRequest: number
    stockObservedAt: string
  }
  resolution: ChatbotRequestResolution
}

export interface ExpirationDecision {
  subtype: 'EXPIRATION'
  snapshot: {
    branchId: string
    branchName: string | null
    productId: string
    productName: string
    unit: string | null
    variantId: string | null
    variantName: string | null
    variantOption: string | null
    variantValue: string | null
  }
  resolution: ChatbotRequestResolution
}

export interface DeliveryZoneDecision {
  subtype: 'DELIVERY_ZONE'
  /** `null` (and `requesterCount` 1) when the request has no validation. */
  validationId: string | null
  zipCode: string
  state: string | null
  municipality: string | null
  neighborhood: string | null
  /** Every requester of the validation, also resolved and cancelled ones. */
  requesterCount: number
  lastCustomerMessageAt: string | null
  resolution: ChatbotRequestResolution
}

export interface TransferReceiptFile {
  mimeType: string
  sizeBytes: number
  previewStatus: string
  originalUrl: string | null
  previewUrl: string | null
}

export interface TransferReceiptDecision {
  subtype: 'TRANSFER_RECEIPT'
  receiptId: string
  saleId: string
  saleFolio: string | null
  declaredAmountCents: number | null
  declaredAmountProvided: boolean
  declaredDate: string | null
  declaredReference: string | null
  saleTotalCents: number
  salePaidCents: number
  saleDebtCents: number
  /** `null` once purged. */
  file: TransferReceiptFile | null
  /** Handoff 14 does not type these two. */
  extracted: unknown
  mismatch: unknown
  resolution: ChatbotRequestResolution
}

/** `null` on the request for CLARIFICATION and CONVERSATION; discriminated by `subtype`. */
export type ChatbotRequestDecision =
  | RestockDecision
  | ExpirationDecision
  | DeliveryZoneDecision
  | TransferReceiptDecision

export type ChatbotRequestDeliveryOutcome =
  | 'PENDING'
  | 'PROVIDER_ACCEPTED'
  | 'DELIVERY_UNKNOWN'
  | 'DEFERRED_WINDOW_CLOSED'
  | 'DEFERRED_HUMAN_SESSION'
  | 'STALE'

export interface ChatbotRequestDelivery {
  deliveryId: string
  type: string
  createdAt: string
  outcome: ChatbotRequestDeliveryOutcome
  attemptedAt: string | null
  providerStatus: string | null
  /** True for `DELIVERY_UNKNOWN` («entrega dudosa»). */
  needsReconciliation: boolean
}

// ─── Audit ────────────────────────────────────────────────────────────────────

/** Official list (handoff 14 §14.6). A later unit may add types: render unknown ones generically. */
export type ChatbotRequestAuditType =
  | 'CREATED'
  | 'MERGED'
  | 'CLAIMED'
  | 'RELEASED'
  | 'AUTO_RELEASED'
  | 'REASSIGNED'
  | 'RESOLVED'
  | 'REPLIED'
  | 'TEMPLATE_SENT'
  | 'FINISHED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'CUSTOMER_LINKED'
  | 'SLA_MILESTONE'
  | 'DELIVERY_OUTCOME'

export interface ChatbotRequestAuditActor {
  kind: 'USER' | 'SERVICE' | 'SYSTEM'
  /** `null` for `SYSTEM`. */
  id: string | null
  displayName: string | null
}

export type ChatbotRequestSlaMilestone = 'HALF' | 'ESCALATION' | 'OVERDUE'

/** `data` per audit type. Small, never customer text (except a cancel's `customerNote`). */
export interface ChatbotRequestAuditDataByType {
  CREATED: {
    subtype: ChatbotRequestSubtype
    sourceRequestId?: string
    triggerWaMessageId?: string
    wrapped?: boolean
    backfilled?: boolean
  }
  /** `intoFolio` / `sourceFolio` are numbers: format as `S-000123`. */
  MERGED:
    | { role: 'SOURCE'; intoRequestId: string; intoFolio: number }
    | { role: 'TARGET'; sourceRequestId: string; sourceFolio: number }
  CLAIMED: Record<string, never>
  RELEASED: { previousAssignee: ChatbotRequestPerson }
  /** Not emitted yet (unit 11). */
  AUTO_RELEASED: Record<string, unknown>
  REASSIGNED: { fromUser: ChatbotRequestPerson; toUser: ChatbotRequestPerson; note?: string }
  RESOLVED: {
    action: string
    /** With `action: 'SIBLING_RESOLVED'`. */
    viaRequestId?: string
    /** `'LEGACY_ROUTE'` when the old staff screen resolved it. */
    via?: string
    [parameter: string]: unknown
  }
  /** Not emitted yet (units 9/11). */
  REPLIED: Record<string, unknown>
  TEMPLATE_SENT: Record<string, unknown>
  FINISHED: Record<string, unknown>
  CANCELLED:
    | { reason: ChatbotRequestStaffCancelReason; note?: string; customerNote?: string }
    | { reason: 'CUSTOMER_WITHDREW' | 'AUTO_RESOLVED' }
  /** Not emitted yet (unit 14). */
  RESCHEDULED: Record<string, unknown>
  CUSTOMER_LINKED: { customerId: string }
  SLA_MILESTONE: {
    milestone: ChatbotRequestSlaMilestone
    clock: 'CLAIM' | 'RESOLVE'
    /** The clock's start in ms, as a string. */
    cycle: string
    dueAt: string
    notice: string | null
    noticeNotBefore?: string
    /** First overdue only. */
    customerNotice?: 'SENT' | 'SKIPPED_STALE'
  }
  DELIVERY_OUTCOME: {
    deliveryId: string
    feedType: string
    outcome: ChatbotRequestDeliveryOutcome
    attemptId: string
    evidenceHash: string
    ackReceivedAt: string
    needsReconciliation: boolean
  }
}

export type ChatbotRequestAuditItem = {
  [T in ChatbotRequestAuditType]: {
    id: string
    type: T
    createdAt: string
    actor: ChatbotRequestAuditActor
    fromStatus: ChatbotRequestStatus | null
    toStatus: ChatbotRequestStatus | null
    version: number
    data: ChatbotRequestAuditDataByType[T]
  }
}[ChatbotRequestAuditType]

export type ChatbotRequestAuditPage = ChatbotRequestPage<ChatbotRequestAuditItem>

export interface ChatbotRequestDetail extends ChatbotRequestRow {
  /**
   * Handoff 20 §3c: the tenant's `templateCostText`, readable without `read:ChatbotSettings`; `null` when the
   * tenant has no settings row. Absent from list rows (and from an older backend): fall back to the settings.
   */
  templateCostText?: string | null
  /** Free text ≤1000, bot-untrusted: plain text. */
  needs: string | null
  context: ChatbotRequestContext | null
  customer: ChatbotRequestDetailCustomer
  /** Up to 20 open rows of the same customer, not this one. */
  otherOpenRequests: ChatbotRequestRow[]
  /** `null` for CLARIFICATION and CONVERSATION. */
  decision: ChatbotRequestDecision | null
  /** Only on DELIVERY_ZONE with a validation. */
  zoneImpact?: ChatbotRequestZoneImpact | null
  /** Handoff 19 §3: the answer of a clarification; `null` until answered. Absent on an older backend. */
  reply?: ChatbotRequestReply | null
  /** Handoff 20 §4: `null` while open, for non-complaints and for a complaint the backend closed itself. */
  complaintOutcome?: ChatbotComplaintOutcome | null
  /** Newest first, at most 50. */
  deliveries: ChatbotRequestDelivery[]
  /** The 20 most recent events, newest first. */
  audit: ChatbotRequestAuditItem[]
  auditNextCursor: string | null
}

export interface ChatbotRequestMergeCandidatesResponse {
  items: ChatbotRequestRow[]
}

export interface ChatbotRequestAssignableUsersResponse {
  items: ChatbotRequestPerson[]
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/** Every body carries the `version` the user is looking at. */
export interface ChatbotRequestVersionedBody {
  expectedVersion: number
}

export type ClaimRequestBody = ChatbotRequestVersionedBody
export type ReleaseRequestBody = ChatbotRequestVersionedBody

export interface ReassignRequestBody extends ChatbotRequestVersionedBody {
  /** 1..100 chars. */
  toUserId: string
  /** 1..500 chars, kept in the audit only. */
  note?: string
}

export interface CancelRequestBody extends ChatbotRequestVersionedBody {
  reason: ChatbotRequestStaffCancelReason
  /** Internal, 1..500 chars; required with `OTHER`. */
  note?: string
  /** What the bot relays, 1..500 chars. Never sent with `DUPLICATE`. */
  customerNote?: string
}

export interface MergeRequestBody extends ChatbotRequestVersionedBody {
  /** The request that stays. */
  intoRequestId: string
  /** Its `version` (merge-candidates row); it is only checked. */
  intoExpectedVersion: number
}

export interface LinkCustomerRequestBody extends ChatbotRequestVersionedBody {
  customerId: string
}

/** Handoff 19 §1: nothing else (type, mediaId and caption are 400). */
export interface ReplyRequestBody extends ChatbotRequestVersionedBody {
  /** 1..1500 characters after trimming; plain text. */
  text: string
}

/** Handoff 20 §4. */
export interface FinishRequestBody extends ChatbotRequestVersionedBody {
  /** Internal, 1..1000 characters, required. */
  note: string
  /** Only for `subtype === 'COMPLAINT'` (mandatory there); ignored for any other subtype. */
  complaintOutcome?: ChatbotComplaintOutcome
}

/** Handoff 21 §3: exactly this body; `scheduledFor` is a block start of the picker (ISO with a zone). */
export interface RescheduleRequestBody extends ChatbotRequestVersionedBody {
  scheduledFor: string
}

export type ZoneType = 'FREE' | 'SURCHARGE' | 'CARRIER_ONLY'

/** Flat body: `expectedVersion`, `action` and the fields of that action. Never `resolutionRequestId`. */
export type ResolveRequestBody =
  | (ChatbotRequestVersionedBody & { action: 'PROVIDE_RESTOCK_ESTIMATE'; restockDays: number })
  | (ChatbotRequestVersionedBody & { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' })
  | (ChatbotRequestVersionedBody & { action: 'PROVIDE_EXPIRATION_TEXT'; expirationText: string })
  | (ChatbotRequestVersionedBody & { action: 'REPORT_EXPIRATION_UNAVAILABLE' })
  | (ChatbotRequestVersionedBody & {
      action: 'APPROVE_DELIVERY_ZONE'
      zoneType: ZoneType
      surchargeCents?: number
      etaDays?: number
      expectedZoneSetVersion: number
    })
  | (ChatbotRequestVersionedBody & { action: 'REJECT_DELIVERY_ZONE'; expectedZoneSetVersion: number })
  | (ChatbotRequestVersionedBody & { action: 'CONFIRM_RECEIPT'; amountCents: number })
  | (ChatbotRequestVersionedBody & {
      action: 'REJECT_RECEIPT'
      /** Internal, 1..1000 chars. */
      reason: string
      /** Sent to the customer, 1..300 chars after trimming; required. */
      customerReason: string
    })

export type ResolveRequestAction = ResolveRequestBody['action']

/** The small `200 {request}` of every command (no phone, no `customerKey`; the full row comes by SSE). */
export interface ChatbotRequestCommandSummary {
  id: string
  folio: string
  kind: ChatbotRequestKind
  subtype: ChatbotRequestSubtype
  status: ChatbotRequestStatus
  displayStatus: ChatbotRequestDisplayStatus
  version: number
  assignee: ChatbotRequestPerson | null
  claimedAt: string | null
  overdueAt: string | null
  closedAt: string | null
  /** Only on the answer of a reschedule (handoff 21 §3). */
  scheduledFor?: string | null
  previousScheduledFor?: string | null
  scheduleVersion?: number
  requiresTemplateAtStart?: boolean
  customerNotice?: ChatbotCustomerNotice
}

/** Handoff 21 §3 (S19 Q9): whether the bot will tell the customer about the new time. */
export interface ChatbotCustomerNotice {
  expected: boolean
}

export interface ChatbotRequestCommandResponse {
  request: ChatbotRequestCommandSummary
  /** Only on the answer of a reschedule; also repeated inside `request`. `false` → the customer is NOT told. */
  customerNotice?: ChatbotCustomerNotice
}

// ─── Command errors ───────────────────────────────────────────────────────────

/** Typed codes of handoffs 11 and 12 (switch on `code`, never on `message`). */
export type ChatbotRequestErrorCode =
  | 'VERSION_CONFLICT'
  | 'REQUEST_CLAIMED_BY_OTHER'
  | 'REQUEST_CLOSED'
  | 'CANCEL_NOT_ALLOWED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'MERGE_NOT_ALLOWED'
  | 'ZONE_SET_CHANGED'
  | 'NOT_ASSIGNEE'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'ACTION_NOT_ALLOWED'
  | 'USER_NOT_ASSIGNABLE'
  | 'CUSTOMER_PHONE_MISMATCH'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  // Replies, finish and the live conversation (handoffs 19 and 20).
  | 'COMPLAINT_OUTCOME_REQUIRED'
  | 'SESSION_NOT_ACTIVE'
  | 'STALE_EPOCH'
  | 'WINDOW_CLOSED'
  | 'WINDOW_OPEN'
  | 'TEMPLATE_NOT_CONFIGURED'
  | 'TEMPLATE_ALREADY_SENT'
  | 'MEDIA_NOT_FOUND'
  | 'MEDIA_PURGED'
  | 'MEDIA_TYPE_MISMATCH'
  // Scheduled conversations (handoff 21).
  | 'SCHEDULED_TOO_EARLY'
  | 'SLOT_UNAVAILABLE'
  | 'RESCHEDULE_NOT_ALLOWED'
  | 'NOT_SCHEDULED'
  | 'SCHEDULING_DISABLED'

/** The `current` of a typed error: enough to patch the row without reloading. */
export interface ChatbotRequestErrorCurrent {
  version?: number
  status?: ChatbotRequestStatus
  claimedBy?: ChatbotRequestPerson | null
  /** `ZONE_SET_CHANGED` only: the new impact (without `validationId`). */
  zoneImpact?: ChatbotRequestZoneImpact
}

// ─── Conversation mirror (handoff 18, read only) ──────────────────────────────

export type ChatbotMessageDirection = 'IN' | 'OUT'
export type ChatbotMessageAuthor = 'CUSTOMER' | 'BOT' | 'STAFF' | 'SYSTEM'
export type ChatbotMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'STICKER'
  | 'DOCUMENT'
  | 'AUDIO'
  | 'TEMPLATE'
  | 'SYSTEM'
  | 'UNSUPPORTED'
export type ChatbotMessageDeliveryStatus =
  | 'QUEUED'
  | 'DEFERRED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'UNKNOWN'

export interface ChatbotMessageMedia {
  id: string
  /** `null` once the retention purge removed the file row. */
  mimeType: string | null
  sizeBytes: number | null
  /** Always `null` today: read it from the browser. */
  durationSec: number | null
  /** Always `false` today: there are no thumbnails, show the original. */
  hasThumb: boolean
  /** The 12-month retention deleted the file (`GET /chatbot-media/:id` answers 410). */
  purged: boolean
  /** Only on a message the attendee just sent (handoff 20 §3b): the name the customer sees. */
  filename?: string | null
}

export interface ChatbotMessage {
  id: string
  /** Backend order inside the chat (1, 2, 3… no gaps): the only sort key. */
  seq: number
  direction: ChatbotMessageDirection
  author: ChatbotMessageAuthor
  /** Only for `STAFF` (unit 11). */
  staff: ChatbotRequestPerson | null
  type: ChatbotMessageType
  /** Plain text typed by the customer: never HTML. Caption for IMAGE / DOCUMENT. */
  text: string | null
  media: ChatbotMessageMedia | null
  deliveryStatus: ChatbotMessageDeliveryStatus | null
  clientMessageId: string | null
  providerTimestamp: string | null
  createdAt: string
  /** Only on `TEMPLATE` messages (handoff 20 §3c). */
  templateName?: string | null
  /**
   * Client only, never sent by the backend: the POST ended in a network error or a `5xx`, so the
   * message may have reached the customer. Its local `FAILED` status then reads «No sabemos si se
   * envió» (not «El cliente no lo recibió»), and «Reintentar» resends the same id.
   */
  unconfirmed?: boolean
}

export interface ChatbotConversationPage {
  /** Always ascending by `seq`, whichever cursor was used. */
  items: ChatbotMessage[]
  /** A message with a lower `seq` than the first item exists. */
  hasMoreBefore: boolean
}

export interface ChatbotConversationParams {
  /** 1–100, default 50. */
  limit?: number
  /** Older than this `seq` (≥ 2). Never together with `after`. */
  before?: number
  /** Newer than this `seq` (≥ 0). Never together with `before`. */
  after?: number
}

// ─── Live conversation (handoff 20 §3) ────────────────────────────────────────

/** A text message, or a photo / PDF already uploaded with `POST …/media`. `type` defaults to `TEXT`. */
export type SendMessageBody =
  | { clientMessageId: string; expectedEpoch: number; text: string }
  | {
      clientMessageId: string
      expectedEpoch: number
      type: 'IMAGE' | 'DOCUMENT'
      mediaId: string
      /** Optional, trimmed, at most 1024. */
      caption?: string
    }

/** `POST …/messages` and `POST …/template` answer `200 {message}` (QUEUED). */
export interface SendMessageResponse {
  message: ChatbotMessage
}

/** `POST …/template`: exactly this body; the template name and language come from the branch settings. */
export interface SendTemplateBody {
  expectedEpoch: number
}

/** `POST …/media` (`201` first time, `200` replay). */
export interface UploadMediaResponse {
  mediaId: string
  mimeType: string
  sizeBytes: number
  sha256: string
  /** The name the customer will see, cleaned by the backend. */
  filename: string
}

// ─── Scheduling (handoff 21 §2) ───────────────────────────────────────────────

export interface ChatbotSchedulingSlot {
  /** ISO UTC start of a block (render in `timeZone`). */
  startsAt: string
  /** `false`: the greeting at that time is outside the free 24 h window — the paid template will be needed. */
  withinWindow: boolean
  /** Always `true`: a full block is simply not listed. */
  available: boolean
}

export interface ChatbotSchedulingBusinessHours {
  openNow: boolean
  nextOpenAt: string | null
  timeZone: string
  weeklyRanges: Array<{ day: string; ranges: Array<{ open: string; close: string }> }>
  /** `YYYY-MM-DD` in the branch zone, today through the next 14 days. */
  closedDates: string[]
}

/** `GET /chatbot-requests/:id/scheduling/slots`: up to 24 blocks, earliest first, 10 min to 14 days ahead. */
export interface ChatbotSchedulingSlots {
  /** IANA zone of the branch: every instant is shown in it. */
  timeZone: string
  /** When the customer's free 24 h window closes; decides `customerNotice` before confirming. */
  whatsappWindowClosesAt: string | null
  businessHours?: ChatbotSchedulingBusinessHours
  slots: ChatbotSchedulingSlot[]
}

/** The fresh list a `409 SLOT_UNAVAILABLE` carries (the offered few; no business hours). */
export type ChatbotSchedulingSlotsUpdate = Pick<
  ChatbotSchedulingSlots,
  'timeZone' | 'whatsappWindowClosesAt' | 'slots'
>
