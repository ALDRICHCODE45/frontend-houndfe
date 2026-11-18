/**
 * HD2A — RESTOCK human-decision read DTOs. `type` exactly `RESTOCK`, `status`
 * `PENDING | RESOLVED`. Bot-only poll/outcome fields (`sourceRequestId`,
 * `supersedesDecisionId`, `applyBefore`, provider evidence) are intentionally absent.
 */

import type { ExpirationDecision } from './expiration-decision.types'

export type HumanDecisionType = 'RESTOCK' | 'EXPIRATION'

type HumanDecisionActionCode =
  | 'PROVIDE_RESTOCK_ESTIMATE'
  | 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'

type HumanDecisionStockObservation =
  | { observedStockAtRequest: number; stockObservedAt: string }
  | { observedStockAtRequest: null; stockObservedAt: null }

/** All nine snapshot keys required; the stock observation pair is both-or-neither. */
type HumanDecisionSnapshot = {
  branchId: string
  branchName: string | null
  productId: string
  productName: string
  variantId: string | null
  sku: string | null
  requestedQuantity: number | null
} & HumanDecisionStockObservation

interface HumanDecisionResolver {
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
  /** Pinned: widening `HumanDecisionType` must never widen a RESTOCK row. */
  type: 'RESTOCK'
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

export type HumanDecision = PendingHumanDecision | ResolvedHumanDecision | ExpirationDecision
