import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  ExpirationDecision,
  ExpirationDecisionSnapshot,
  ExpirationDecisionType,
  PendingExpirationDecision,
  ProvideExpirationTextResolution,
  ReportExpirationUnavailableResolution,
  ResolvedExpirationDecision,
  ResolveProvideExpirationTextPayload,
  ResolveReportExpirationUnavailablePayload,
} from '../expiration-decision.types'
/** Every `@ts-expect-error` is the assertion: an unused directive fails `vue-tsc`. */
const [PROVIDE, REPORT] = ['PROVIDE_EXPIRATION_TEXT', 'REPORT_EXPIRATION_UNAVAILABLE'] as const
const snapshot: ExpirationDecisionSnapshot = {
  branchId: 'branch-1',
  branchName: null,
  productId: 'product-1',
  productName: 'Alimento',
  unit: 'kg',
  variantId: null,
  variantName: null,
  variantOption: null,
  variantValue: null,
}
const pending: PendingExpirationDecision = {
  id: 'decision-1',
  type: 'EXPIRATION',
  title: 'Consulta de vencimiento',
  sanitizedSummary: 'Se solicitó información.',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'PENDING',
  version: 1,
  resolution: null,
  allowedActions: [PROVIDE, REPORT],
  snapshot,
}
const provide: ProvideExpirationTextResolution = {
  action: PROVIDE,
  expirationText: 'Vence en marzo',
  resolvedAt: '2026-01-01T01:00:00.000Z',
  resolvedBy: { id: 'user-1', displayName: 'Ana' },
}
const report: ReportExpirationUnavailableResolution = {
  action: REPORT,
  resolvedAt: '2026-01-01T01:00:00.000Z',
  resolvedBy: { id: 'user-1', displayName: 'Ana' },
}
const resolved: ResolvedExpirationDecision = {
  ...pending,
  status: 'RESOLVED',
  version: 2,
  resolution: provide,
  allowedActions: [],
}
const providePayload: ResolveProvideExpirationTextPayload = {
  action: PROVIDE,
  expirationText: 'Vence',
  expectedVersion: 1,
  resolutionRequestId: 'r-1',
}
const reportPayload: ResolveReportExpirationUnavailablePayload = {
  action: REPORT,
  expectedVersion: 1,
  resolutionRequestId: 'r-1',
}
const over = <T>(base: T, patch: Partial<T>): T => ({ ...base, ...patch })
describe('expiration-decision.types', () => {
  it('accepts PENDING (version 1, null resolution) and both RESOLVED variants', () => {
    const pendingEmpty: PendingExpirationDecision = { ...pending, allowedActions: [] }
    const resolvedReport: ResolvedExpirationDecision = { ...resolved, resolution: report }
    const union: ExpirationDecision[] = [pendingEmpty, resolved, resolvedReport]
    expect(union.map((d) => d.status)).toEqual(['PENDING', 'RESOLVED', 'RESOLVED'])
    expect([pendingEmpty.version, resolvedReport.resolution?.action]).toEqual([1, REPORT])
    expect(resolved.resolution?.action).toBe(PROVIDE)
  })
  it('pins EXPIRATION as the only type discriminant', () => {
    expectTypeOf<ExpirationDecisionType>().toEqualTypeOf<'EXPIRATION'>()
    // @ts-expect-error EXPIRATION decisions are never RESTOCK
    const wrongType = over(pending, { type: 'RESTOCK' })
    expect(wrongType.type).toBe('RESTOCK')
  })
  it('requires every snapshot key and forbids SKU/stock keys', () => {
    const { unit, ...withoutUnit } = snapshot
    // @ts-expect-error unit is required
    const missingUnit: ExpirationDecisionSnapshot = withoutUnit
    // @ts-expect-error sku is not part of the EXPIRATION snapshot
    const withSku = over(snapshot, { sku: 'sku-1' })
    // @ts-expect-error stock keys are RESTOCK/bot-only
    const withStock = over(snapshot, { observedStockAtRequest: 1, stockObservedAt: 't' })
    expect([unit, missingUnit.unit]).toStrictEqual(['kg', undefined])
    expect(Object.keys(withoutUnit)).toHaveLength(8)
    expect(['sku' in withSku, 'observedStockAtRequest' in withStock]).toEqual([true, true])
  })
  it('pins PENDING/RESOLVED version, resolution and the exact action tuple', () => {
    // @ts-expect-error PENDING is always version 1
    const pendingV2 = over(pending, { version: 2 })
    // @ts-expect-error RESOLVED is always version 2
    const resolvedV1 = over(resolved, { version: 1 })
    // @ts-expect-error the EXPIRATION action pair order is fixed
    const reordered = over(pending, { allowedActions: [REPORT, PROVIDE] })
    // @ts-expect-error a partial action list is rejected
    const partial = over(pending, { allowedActions: [PROVIDE] })
    // @ts-expect-error RESOLVED exposes no further actions
    const withActions = over(resolved, { allowedActions: [PROVIDE, REPORT] })
    expect([pendingV2.version, resolvedV1.version]).toEqual([2, 1])
    expect([reordered, partial, withActions].map((r) => r.allowedActions.length)).toEqual([2, 1, 2])
  })
  it('couples the resolution variants to expirationText presence', () => {
    const { expirationText, ...withoutText } = provide
    // @ts-expect-error REPORT_EXPIRATION_UNAVAILABLE omits expirationText
    const withText = over(report, { expirationText: 'x' })
    // @ts-expect-error PROVIDE_EXPIRATION_TEXT requires expirationText
    const missingText: ProvideExpirationTextResolution = withoutText
    expect([expirationText, 'expirationText' in withText]).toEqual(['Vence en marzo', true])
    expect(missingText.expirationText).toBeUndefined()
  })
  it('mirrors the exact resolve payload variants', () => {
    const { expirationText, ...provideNoText } = providePayload
    const { expectedVersion, ...reportNoVersion } = reportPayload
    const { resolutionRequestId, ...reportNoRequestId } = reportPayload
    // @ts-expect-error the positive payload requires expirationText
    const missingProvideText: ResolveProvideExpirationTextPayload = provideNoText
    // @ts-expect-error the negative payload omits expirationText
    const reportWithText = over(reportPayload, { expirationText: 'x' })
    // @ts-expect-error expectedVersion is required
    const missingVersion: ResolveReportExpirationUnavailablePayload = reportNoVersion
    // @ts-expect-error resolutionRequestId is required
    const missingRequestId: ResolveReportExpirationUnavailablePayload = reportNoRequestId
    expect([expirationText, expectedVersion, resolutionRequestId]).toEqual(['Vence', 1, 'r-1'])
    expect('expirationText' in reportWithText).toBe(true)
    expect([missingProvideText.expectedVersion, missingRequestId.expectedVersion]).toEqual([1, 1])
    expect(missingVersion.resolutionRequestId).toBe('r-1')
  })
})
