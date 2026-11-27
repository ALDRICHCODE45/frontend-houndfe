/**
 * S1 subset — cash-register contract types (registers, sessions, blind count,
 * declaration/verification, custody, FLOAT and drawer release).
 *
 * Source of truth: the authoritative backend contract
 * `houndfe-backend/.tmp/cash-register-closing/docs/cash-register-closing.md`
 * (routes/envelopes/status/errors and fictional examples A–G) plus the
 * frontend handoff `docs/cash-register-frontend-handoff.md`.
 *
 * Hard invariants encoded here:
 *   - every monetary field is an integer number of cents;
 *   - `blind` session projections omit `expectedCashCents` / `differenceCents`
 *     (optional = absent, never `null` and never coerced to `0`);
 *   - `requiredChannels` is a detail-level, identity-only field present only in
 *     the owner's frozen blind window;
 *   - the declaration `comparison` is a normal/fallback union.
 *
 * Close + corte (`CashClosing`, frozen snapshot), the closings list, handover
 * recipients and the `status` / `drawerOpen` session filters follow
 * houndfe-backend `docs/frontend-handoff/25-cash-redesign.md`. Sales binding
 * (`cashSessionId`) stays out of this module.
 */

// ─── Enums and unions ────────────────────────────────────────────────────────

/** `method` domain of every channel identity. */
export type CashMethod = 'CASH' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'TRANSFER'

/** `OPEN → COUNTING → SUBMITTED → CLOSED`; drawer release is a separate event. */
export type CashSessionStatus = 'OPEN' | 'COUNTING' | 'SUBMITTED' | 'CLOSED'

/** Movement kinds observable in a visible session detail. */
export type CashMovementKind =
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'SALE_PAYMENT'
  | 'SALE_CHANGE'
  | 'REFUND_SETTLEMENT'

/** Origin of a ledger movement. */
type CashMovementSourceType = 'MANUAL' | 'PAYMENT' | 'SALE' | 'REFUND'

/** Count revisions: the cashier declaration and the verifier recount. */
type CashCountKind = 'DECLARATION' | 'VERIFICATION'

/** `FLOAT` is retained as the next opening fund; `WITHDRAWAL` leaves the drawer. */
export type CashHandoverKind = 'WITHDRAWAL' | 'FLOAT'

// ─── Registers ───────────────────────────────────────────────────────────────

/** Identity-only register view embedded in session documents. */
interface CashRegisterSummary {
  id: string
  name: string
  isActive: boolean
}

/**
 * Who holds a register's drawer (handoff 31). Present only with `read:CashSession`
 * and when the session is the caller's own or they hold `read:CashSessionAudit`.
 */
export interface CashRegisterHeldBy {
  sessionId: string
  status: CashSessionStatus
  openedAt: string
  cashierDisplayName: string | null
  byMe: boolean
}

/** `GET /cash-registers` item and `POST`/`PATCH /cash-registers` document. */
export interface CashRegister extends CashRegisterSummary {
  createdAt: string
  /**
   * Held-drawer snapshot (handoff 31, GET /cash-registers): `true` while any
   * session of the register has the drawer unreleased — the same rule that
   * refuses an open with `CASH_REGISTER_UNRELEASED_SESSION`. Optional only
   * because the POST/PATCH documents omit it; absent is read as free and the
   * server's refusal on open remains the safety net.
   */
  drawerHeld?: boolean
  /** Non-null whenever `drawerHeld` is true; never carries a name. */
  drawerHeldStatus?: CashSessionStatus | null
  /** `openedAt` of the holding session (ISO); non-null whenever held. */
  drawerHeldSince?: string | null
  heldBy?: CashRegisterHeldBy | null
}

export interface CashRegisterListResponse {
  items: CashRegister[]
}

export interface CashRegisterCreatePayload {
  name: string
}

/** Rename / activate. Absent keys are not sent. */
export interface CashRegisterUpdatePayload {
  name?: string
  isActive?: boolean
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/**
 * `CashSessionProjection`. `expectedCashCents` and `differenceCents` exist only
 * when visible; in the blind window they are absent (not `null`, not `0`).
 *
 * Display fields (handoff 09-cash-display-fields.md) hold no amounts, so a blind
 * projection carries them too. They are optional only so an older payload still
 * reads; `null` (or absent) shows nothing, never an id.
 */
export interface CashSession {
  id: string
  tenantId: string
  registerId: string
  status: CashSessionStatus
  cashierUserId: string
  openingCents: number
  frozenAt: string | null
  drawerReleasedAt: string | null
  blind: boolean
  expectedCashCents?: number
  differenceCents?: number
  openedAt?: string
  /** `null` until the session is `CLOSED`. */
  closedAt?: string | null
  cashierDisplayName?: string | null
}

/** 1-based `page` / `limit`, optional register, ISO-8601 timezone, cashier, pending-only. */
export interface CashSessionListParams {
  page?: number
  limit?: number
  registerId?: string
  from?: string
  to?: string
  cashierUserId?: string
  pendingOnly?: boolean
  /** Exact lifecycle, any of (handoff 25 §2). Sent as a comma list; empty is not sent. */
  status?: CashSessionStatus[]
  /** `true` = drawer still held (`drawerReleasedAt: null`), `false` = released. */
  drawerOpen?: boolean
}

export interface CashSessionListResponse {
  items: CashSession[]
  page: number
  limit: number
  total: number
}

/** Identity-only channel entry (`CASH` or `PM:<id>` / `METHOD:<METHOD>`). */
export interface CashChannelIdentity {
  channelKey: string
  channelLabel: string
  method: CashMethod
}

/** Frozen expected channel list (`channelSnapshot`), never the closing `channels[]`. */
interface CashChannelSnapshotLine extends CashChannelIdentity {
  expectedCents: number
}

interface CashCountLine {
  channelKey: string
  amountCents: number
}

interface CashDenomination {
  denominationCents: number
  quantity: number
}

/** Blind count body: `lines`, optional `denominations`, optional `notes` only. */
export interface CashCountPayload {
  lines: CashCountLine[]
  denominations?: CashDenomination[]
  notes?: string
}

export interface CashDeclaration {
  revision: number
  lines: CashCountLine[]
  denominations: CashDenomination[] | null
  notes: string | null
  cashCents: number
}

interface CashVerification extends CashDeclaration {
  actorUserId: string
}

interface CashCount {
  id: string
  kind: CashCountKind
  revision: number
  actorUserId: string
  lines: CashCountLine[]
  denominations: CashDenomination[] | null
  notes: string | null
  createdAt: string
}

interface CashMovement {
  id: string
  kind: CashMovementKind
  deltaCents: number
  method: CashMethod
  channelKey: string
  channelLabel: string
  sourceType: CashMovementSourceType
  sourceId: string
  actorUserId: string
  reason: string | null
  occurredAt: string
}

// ─── Comparisons (declare normal/fallback union) ─────────────────────────────

/** Normal comparison returned by VERIFY/CLOSE and by DECLARE when accepted. */
export interface CashComparisonNormal {
  expectedCents: number
  declaredCents: number
  verifiedCents: number | null
  declarationDifferenceCents: number
  verificationDifferenceCents: number | null
  verifiedVsExpectedDifferenceCents: number | null
  requiresDeclarationNotes: boolean
  requiresVerificationNotes: boolean
  hasDiscrepancy: boolean
}

/**
 * Fallback comparison returned only by DECLARE when `compareSafely` catches a
 * missing-note or overflow rule. Deliberately has no
 * `declarationDifferenceCents`; `differenceCents` is `null` when the
 * subtraction itself is unrepresentable.
 */
export interface CashComparisonFallback {
  expectedCents: number
  declaredCents: number
  verifiedCents: number | null
  differenceCents: number | null
  requiresDeclarationNotes: boolean
  requiresVerificationNotes: boolean
  hasDiscrepancy: boolean
  notesRequired: boolean
}

export type CashComparison = CashComparisonNormal | CashComparisonFallback

/**
 * Discriminates the DECLARE fallback from the normal comparison. The fallback is
 * the only shape carrying `notesRequired` and lacking `declarationDifferenceCents`.
 */
export function isCashComparisonFallback(
  comparison: CashComparison,
): comparison is CashComparisonFallback {
  return 'notesRequired' in comparison
}

// ─── Command / read responses ────────────────────────────────────────────────

export interface CashSessionOpenedResponse {
  session: CashSession
  register: CashRegisterSummary
}

export interface CashStartCountResponse {
  session: CashSession
}

/** `POST /cash-sessions/:id/declarations` — `201` plain JSON document. */
export interface CashDeclareResponse {
  sessionId: string
  status: 'SUBMITTED'
  declaration: CashDeclaration
  comparison: CashComparison
}

/** Append-only explanation after submission. */
export interface CashAnnotationNotesPayload {
  notes: string
}

export interface CashDeclarationNotesResponse {
  sessionId: string
  revision: number
  lines: CashCountLine[]
  denominations: CashDenomination[] | null
  notes: string
}

export interface CashVerifyResponse {
  sessionId: string
  verification: CashVerification
  comparison: CashComparisonNormal
}

export interface CashMovementPayload {
  amountCents: number
  reason: string
}

export interface CashMovementResponse {
  id: string
  sessionId: string
  kind: 'CASH_IN' | 'CASH_OUT'
  deltaCents: number
  occurredAt: string
}

export interface CashDrawerReleaseResponse {
  sessionId: string
  drawerReleasedAt: string
}

// ─── Custody and FLOAT ───────────────────────────────────────────────────────

export interface CashHandover {
  id: string
  sessionId: string
  kind: CashHandoverKind
  declaredCents: number
  receivedCents: number | null
  senderUserId: string
  receiverUserId: string
  receiptActorUserId: string | null
  declaredAt: string
  receivedAt: string | null
  notes: string | null
  receiptNotes: string | null
}

/** Outgoing custody declaration. The receipt actor is always the JWT subject. */
export interface CashHandoverDeclarationPayload {
  handoverKind: CashHandoverKind
  recipientUserId: string
  declaredCents: number
  notes?: string
}

/** Recipient receipt: explicit received amount, optional notes. */
export interface CashHandoverReceivePayload {
  receivedCents: number
  notes?: string
}

/**
 * Narrow custody item; `FLOAT` items add the source register and drawer state.
 * Every kind carries the sender's name, the source register's name and the
 * sender's notes (handoff 09), each `null` when missing.
 */
export interface CashCustodyItem {
  id: string
  sessionId: string
  kind: CashHandoverKind
  declaredCents: number
  receivedCents: number | null
  senderUserId: string
  receiverUserId: string
  declaredAt: string
  receivedAt: string | null
  sourceRegisterId?: string
  sourceDrawerReleasedAt?: string | null
  senderDisplayName?: string | null
  sourceRegisterName?: string | null
  /** Notes the sender wrote when declaring; the receiver's receipt notes are not included. */
  notes?: string | null
}

/** Eligible FLOAT always reports its source register and drawer state. */
export interface CashEligibleFloatItem extends CashCustodyItem {
  sourceRegisterId: string
  sourceDrawerReleasedAt: string | null
}

interface CashCustodyPage<T> {
  items: T[]
  page: number
  limit: number
  total: number
}

/** `GET /cash-handovers/custody` — recipient-scoped, no client filters. */
export interface CashCustody {
  pendingHandovers: CashCustodyPage<CashCustodyItem>
  eligibleFloat: CashCustodyPage<CashEligibleFloatItem>
}

export interface CashCustodyParams {
  page?: number
  limit?: number
}

// ─── Session detail ──────────────────────────────────────────────────────────

/**
 * Closing reference embedded in a session detail. It carries no snapshot; the
 * full document is {@link CashClosing} (`GET /cash-closings/:id`).
 */
export interface CashClosingReference {
  id: string
  sessionId: string
  folio: string
  createdAt: string
}

/** `GET /cash-sessions/:id` — plain JSON, no wrapper key. */
export interface CashSessionDetail {
  session: CashSession
  register: CashRegisterSummary | null
  movements: CashMovement[]
  counts: CashCount[]
  handovers: CashHandover[]
  closing: CashClosingReference | null
  channelSnapshot: CashChannelSnapshotLine[] | null
  /** Identity-only, present only for the owner's frozen blind window. */
  requiredChannels?: CashChannelIdentity[]
}

// ─── Handover recipients (handoff 25 §1) ─────────────────────────────────────

/** `GET /cash-handovers/recipients?kind=` item: pick by name and role, send `userId`. */
export interface CashHandoverRecipient {
  userId: string
  displayName: string
  /** Role(s) in this sucursal that grant receipt, sorted and joined with ", ". */
  roleName: string
}

export interface CashHandoverRecipientsResponse {
  items: CashHandoverRecipient[]
}

// ─── Close and corte (handoff 25 §5, §6) ─────────────────────────────────────

/** `POST /cash-sessions/:id/close` body: optional notes (trimmed, 1–2000 chars). */
export interface CashClosePayload {
  notes?: string
}

/** One frozen channel. `differenceCents` is declared − expected only. */
export interface CashClosingChannel extends CashChannelIdentity {
  expectedCents: number
  declaredCents: number
  verifiedCents: number | null
  differenceCents: number
}

/** One frozen handover. No guaranteed order: sort by `declaredAt` in the UI. */
export interface CashClosingHandover {
  handoverId: string
  kind: CashHandoverKind
  declaredCents: number
  receivedCents: number | null
  senderUserId: string
  receiverUserId: string | null
  receiptActorUserId: string | null
  /** Names frozen with the corte (additive; absent on old cortes). Display only. */
  senderName?: string | null
  receiverName?: string | null
  receiptActorName?: string | null
  declaredAt: string
  receivedAt: string | null
}

/**
 * Frozen snapshot (never recomputed). `expectedCents` / `declaredCents` /
 * `verifiedCents` and `comparison` are PHYSICAL CASH totals only.
 */
export interface CashClosingSnapshot {
  sessionId: string
  tenantId: string
  registerId: string
  folio: string
  cashierUserId: string
  openingCents: number
  expectedCents: number
  declaredCents: number
  verifiedCents: number | null
  verifierUserId: string | null
  channels: CashClosingChannel[]
  handovers: CashClosingHandover[]
  /** Original declaration (revision 1) time. */
  countedAt: string
  verifiedAt: string | null
  closedAt: string
  closedByUserId: string
  /**
   * Session opening time, frozen at close. `null` for cortes closed before it
   * was stored (the backend never fills it from the live session): read
   * `GET /cash-sessions/:id` → `session.openedAt` instead.
   */
  openedAt: string | null
  registerName: string | null
  cashierName: string | null
  verifierName: string | null
  closedByName: string | null
  declarationNotes: string | null
  verificationNotes: string | null
  comparison: CashComparisonNormal
  closingNotes: string | null
}

/** `POST /cash-sessions/:id/close` (201) and `GET /cash-closings/:id`. */
export interface CashClosing extends CashClosingReference {
  snapshot: CashClosingSnapshot
}

/**
 * `GET /cash-closings` item (handoff 25 §3.1): identity plus the closed
 * session's register and cashier with their CURRENT names (the detail keeps the
 * names frozen at close) and the frozen cash difference declared − expected
 * (negative = faltante, `null` when the snapshot has none). No snapshot.
 */
export interface CashClosingListItem extends CashClosingReference {
  register: { id: string; name: string | null } | null
  cashier: { userId: string; displayName: string | null } | null
  differenceCents: number | null
}

/** 1-based paging; `cashierUserId` is the closed session's cashier (§3). */
export interface CashClosingListParams {
  page?: number
  limit?: number
  registerId?: string
  cashierUserId?: string
  from?: string
  to?: string
}

export interface CashClosingListResponse {
  items: CashClosingListItem[]
  page: number
  limit: number
  total: number
}
