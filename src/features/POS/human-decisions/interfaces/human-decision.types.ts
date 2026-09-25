/**
 * HD2A — RESTOCK human-decision read DTOs. `type` exactly `RESTOCK`, `status`
 * `PENDING | RESOLVED`. Bot-only poll/outcome fields (`sourceRequestId`,
 * `supersedesDecisionId`, `applyBefore`, provider evidence) are intentionally absent.
 */

import type { PaginatedResponse } from '@/core/shared/types/table.types'

export type HumanDecisionType = 'RESTOCK'

export type HumanDecisionStatus = 'PENDING' | 'RESOLVED'

export type HumanDecisionActionCode =
  | 'PROVIDE_RESTOCK_ESTIMATE'
  | 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'

export type HumanDecisionErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'ALREADY_RESOLVED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'REQUEST_ERROR'
  | 'INTERNAL_ERROR'

export interface HumanDecisionErrorResponse {
  statusCode: number
  code: HumanDecisionErrorCode
  message: string
}

type HumanDecisionStockObservation =
  | { observedStockAtRequest: number; stockObservedAt: string }
  | { observedStockAtRequest: null; stockObservedAt: null }

/** All nine snapshot keys required; the stock observation pair is both-or-neither. */
export type HumanDecisionSnapshot = {
  branchId: string
  branchName: string | null
  productId: string
  productName: string
  variantId: string | null
  sku: string | null
  requestedQuantity: number | null
} & HumanDecisionStockObservation

export interface HumanDecisionResolver {
  id: string
  displayName: string
}

export interface ProvideRestockEstimateResolution {
  action: 'PROVIDE_RESTOCK_ESTIMATE'
  restockDays: number
  resolvedAt: string
  resolvedBy: HumanDecisionResolver
}

export interface ReportRestockEstimateUnavailableResolution {
  action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'
  resolvedAt: string
  resolvedBy: HumanDecisionResolver
}

export type HumanDecisionResolution =
  | ProvideRestockEstimateResolution
  | ReportRestockEstimateUnavailableResolution

interface HumanDecisionBase {
  id: string
  type: HumanDecisionType
  title: string
  sanitizedSummary: string
  createdAt: string
  snapshot: HumanDecisionSnapshot
  version: number
  resolution: HumanDecisionResolution | null
  allowedActions: HumanDecisionActionCode[]
}

/** PENDING allowed actions: exact empty, or both approved codes in contract order. */
type PendingAllowedActions =
  | []
  | ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE']

export interface PendingHumanDecision extends HumanDecisionBase {
  status: 'PENDING'
  version: 1
  resolution: null
  allowedActions: PendingAllowedActions
}

export interface ResolvedHumanDecision extends HumanDecisionBase {
  status: 'RESOLVED'
  version: 2
  resolution: HumanDecisionResolution
  allowedActions: []
}

export type HumanDecision = PendingHumanDecision | ResolvedHumanDecision

/** Resolve payloads ship in HD4; `restockDays` is an integer 1..365. */
export interface ResolveProvideRestockEstimatePayload {
  action: 'PROVIDE_RESTOCK_ESTIMATE'
  restockDays: number
  expectedVersion: number
  resolutionRequestId: string
}

export interface ResolveReportRestockEstimateUnavailablePayload {
  action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'
  expectedVersion: number
  resolutionRequestId: string
}

export type HumanDecisionResolvePayload =
  | ResolveProvideRestockEstimatePayload
  | ResolveReportRestockEstimateUnavailablePayload

export type HumanDecisionPageSize = 20 | 50

/** List requires `status=PENDING`; `page` is one-based; `sortBy`/`sortOrder` fixed. */
export interface HumanDecisionListParams {
  status: 'PENDING'
  page: number
  limit: HumanDecisionPageSize
  search?: string
  sortBy: 'createdAt'
  sortOrder: 'asc'
}

/** Response pagination is zero-based (`pageIndex`/`pageSize`/`totalCount`/`pageCount`). */
export type HumanDecisionListResponse = PaginatedResponse<PendingHumanDecision>
