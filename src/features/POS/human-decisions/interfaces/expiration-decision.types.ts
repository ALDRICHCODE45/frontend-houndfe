/**
 * EXPIRATION WU1 — additive EXPIRATION human-decision DTOs.
 *
 * Isolated mirror of the backend `HumanDecisionExpiration*` projection. Kept
 * OUT of the existing `HumanDecision` union so RESTOCK types and consumers stay
 * untouched. Snapshot has `unit` and no `sku`/stock keys. PENDING is `version:1`
 * with `resolution:null`; RESOLVED is `version:2` with `allowedActions:[]`. The
 * EXPIRATION action pair is only `[]` or both codes in exact contract order. The
 * negative resolution/payload variant OMITS `expirationText` (never `null`).
 */

export type ExpirationDecisionType = 'EXPIRATION'

export type ExpirationDecisionActionCode =
  | 'PROVIDE_EXPIRATION_TEXT'
  | 'REPORT_EXPIRATION_UNAVAILABLE'

export interface ExpirationDecisionResolver {
  id: string
  displayName: string
}

/** Immutable EXPIRATION snapshot: `unit` present, no SKU/stock key. */
export interface ExpirationDecisionSnapshot {
  branchId: string
  branchName: string | null
  productId: string
  productName: string
  unit: string
  variantId: string | null
  variantName: string | null
  variantOption: string | null
  variantValue: string | null
}

export interface ProvideExpirationTextResolution {
  action: 'PROVIDE_EXPIRATION_TEXT'
  expirationText: string
  resolvedAt: string
  resolvedBy: ExpirationDecisionResolver
}

export interface ReportExpirationUnavailableResolution {
  action: 'REPORT_EXPIRATION_UNAVAILABLE'
  resolvedAt: string
  resolvedBy: ExpirationDecisionResolver
}

export type ExpirationDecisionResolution =
  | ProvideExpirationTextResolution
  | ReportExpirationUnavailableResolution

/** Exact empty, or both approved codes in contract order. */
type ExpirationPendingAllowedActions =
  | []
  | ['PROVIDE_EXPIRATION_TEXT', 'REPORT_EXPIRATION_UNAVAILABLE']

interface ExpirationDecisionBase {
  id: string
  type: ExpirationDecisionType
  title: string
  sanitizedSummary: string
  createdAt: string
  snapshot: ExpirationDecisionSnapshot
}

export interface PendingExpirationDecision extends ExpirationDecisionBase {
  status: 'PENDING'
  version: 1
  resolution: null
  allowedActions: ExpirationPendingAllowedActions
}

export interface ResolvedExpirationDecision extends ExpirationDecisionBase {
  status: 'RESOLVED'
  version: 2
  resolution: ExpirationDecisionResolution
  allowedActions: []
}

export type ExpirationDecision = PendingExpirationDecision | ResolvedExpirationDecision

/** Positive resolve payload; `expirationText` normalized to 1..500 units. */
export interface ResolveProvideExpirationTextPayload {
  action: 'PROVIDE_EXPIRATION_TEXT'
  expirationText: string
  expectedVersion: number
  resolutionRequestId: string
}

/** Negative resolve payload; `expirationText` deliberately ABSENT. */
export interface ResolveReportExpirationUnavailablePayload {
  action: 'REPORT_EXPIRATION_UNAVAILABLE'
  expectedVersion: number
  resolutionRequestId: string
}

export type ExpirationDecisionResolvePayload =
  | ResolveProvideExpirationTextPayload
  | ResolveReportExpirationUnavailablePayload
