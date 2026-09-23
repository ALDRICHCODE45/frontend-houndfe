// branchSalesSummary.utils.spec.ts — empty-state contract for the eight metrics.
//
// Mutation-sensitive: collapsing the check to `saleCount === 0`, ignoring a
// single metric, or treating a missing payload as empty fails these tests.

import { describe, it, expect } from 'vitest'
import {
  BRANCH_SALES_SUMMARY_METRIC_KEYS,
  isBranchSalesSummaryEmpty,
  type BranchSalesSummaryMetrics,
} from '../branchSalesSummary.utils'

function metrics(overrides: Partial<BranchSalesSummaryMetrics> = {}): BranchSalesSummaryMetrics {
  return {
    grossSalesCents: 0,
    netSalesCents: 0,
    collectedCents: 0,
    outstandingDebtCents: 0,
    saleCount: 0,
    averageTicketCents: 0,
    settledRefundsCents: 0,
    pendingRefundObligationsCents: 0,
    ...overrides,
  }
}

describe('isBranchSalesSummaryEmpty (ODD branch-sales-summary A2)', () => {
  it('tracks exactly the eight authoritative metrics', () => {
    expect([...BRANCH_SALES_SUMMARY_METRIC_KEYS]).toEqual([
      'grossSalesCents',
      'netSalesCents',
      'collectedCents',
      'outstandingDebtCents',
      'saleCount',
      'averageTicketCents',
      'settledRefundsCents',
      'pendingRefundObligationsCents',
    ])
  })

  it('is empty only when every metric is zero', () => {
    expect(isBranchSalesSummaryEmpty(metrics())).toBe(true)
  })

  it('is non-empty when any single metric is non-zero', () => {
    for (const key of BRANCH_SALES_SUMMARY_METRIC_KEYS) {
      expect(isBranchSalesSummaryEmpty(metrics({ [key]: 1 }))).toBe(false)
    }
  })

  it('treats refund-only activity as non-empty even with zero sales count', () => {
    expect(isBranchSalesSummaryEmpty(metrics({ saleCount: 0, settledRefundsCents: 12_300 }))).toBe(
      false,
    )
    expect(
      isBranchSalesSummaryEmpty(metrics({ saleCount: 0, pendingRefundObligationsCents: 7_700 })),
    ).toBe(false)
  })

  it('treats a missing payload as not empty', () => {
    expect(isBranchSalesSummaryEmpty(undefined)).toBe(false)
    expect(isBranchSalesSummaryEmpty(null)).toBe(false)
  })
})
