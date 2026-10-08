/** WU3 — compact EXPIRATION read fixtures; HTML title/summary prove literal rendering. */
import type {
  PendingExpirationDecision,
  ProvideExpirationTextResolution,
  ReportExpirationUnavailableResolution,
  ResolvedExpirationDecision,
} from '../expiration-decision.types'

const resolver = { id: 'user-1', displayName: 'Ana' }
const resolvedAt = '2026-02-02T00:00:00.000Z'

export const pendingExpiration: PendingExpirationDecision = {
  id: 'exp-1',
  type: 'EXPIRATION',
  title: '<b>Vencimiento</b>',
  sanitizedSummary: '<img src=x onerror=alert(1)>',
  createdAt: '2026-02-01T00:00:00.000Z',
  status: 'PENDING',
  version: 1,
  resolution: null,
  allowedActions: ['PROVIDE_EXPIRATION_TEXT', 'REPORT_EXPIRATION_UNAVAILABLE'],
  snapshot: {
    branchId: 'branch-1',
    branchName: 'Sucursal Centro',
    productId: 'product-1',
    productName: 'Alimento húmedo',
    unit: 'kg',
    variantId: 'variant-1',
    variantName: 'Presentación',
    variantOption: 'Tamaño',
    variantValue: 'Grande',
  },
}

export const provideExpiration: ProvideExpirationTextResolution = {
  action: 'PROVIDE_EXPIRATION_TEXT',
  expirationText: 'Consumir antes del 20 de marzo de 2026.',
  resolvedAt,
  resolvedBy: resolver,
}

export const unavailableExpiration: ReportExpirationUnavailableResolution = {
  action: 'REPORT_EXPIRATION_UNAVAILABLE',
  resolvedAt,
  resolvedBy: resolver,
}

export function resolvedExpiration(
  resolution: ProvideExpirationTextResolution | ReportExpirationUnavailableResolution,
): ResolvedExpirationDecision {
  return { ...pendingExpiration, status: 'RESOLVED', version: 2, allowedActions: [], resolution }
}
