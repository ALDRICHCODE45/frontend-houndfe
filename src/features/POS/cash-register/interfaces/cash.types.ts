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
 * Out of S1 scope: sales binding (`cashSessionId`) and closing/PDF. A closing
 * reference is modeled narrowly so a detail read stays type-honest, but its
 * frozen `snapshot` is intentionally not modeled here.
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
export type CashMovementSourceType = 'MANUAL' | 'PAYMENT' | 'SALE' | 'REFUND'

/** Count revisions: the cashier declaration and the verifier recount. */
export type CashCountKind = 'DECLARATION' | 'VERIFICATION'

/** `FLOAT` is retained as the next opening fund; `WITHDRAWAL` leaves the drawer. */
export type CashHandoverKind = 'WITHDRAWAL' | 'FLOAT'

// ─── Registers ───────────────────────────────────────────────────────────────

/** Identity-only register view embedded in session documents. */
export interface CashRegisterSummary {
  id: string
  name: string
  isActive: boolean
}

/** `GET /cash-registers` item and `POST`/`PATCH /cash-registers` document. */
export interface CashRegister extends CashRegisterSummary {
  createdAt: string
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
export interface CashChannelSnapshotLine extends CashChannelIdentity {
  expectedCents: number
}

export interface CashCountLine {
  channelKey: string
  amountCents: number
}

export interface CashDenomination {
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

export interface CashVerification extends CashDeclaration {
  actorUserId: string
}

export interface CashCount {
  id: string
  kind: CashCountKind
  revision: number
  actorUserId: string
  lines: CashCountLine[]
  denominations: CashDenomination[] | null
  notes: string | null
  createdAt: string
}

export interface CashMovement {
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

/** Narrow custody item; `FLOAT` items add the source register and drawer state. */
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
}

/** Eligible FLOAT always reports its source register and drawer state. */
export interface CashEligibleFloatItem extends CashCustodyItem {
  sourceRegisterId: string
  sourceDrawerReleasedAt: string | null
}

export interface CashCustodyPage<T> {
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
 * Minimal closing reference. S1 does not implement closing/PDF, so the frozen
 * `snapshot` is intentionally not modeled; never treat this as the full
 * `GET /cash-closings/:id` document.
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
