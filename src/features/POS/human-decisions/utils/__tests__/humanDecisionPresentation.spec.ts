import { describe, expect, it } from 'vitest'
import type { HumanDecision } from '../../interfaces/human-decision.types'
import { pendingExpiration } from '../../interfaces/__tests__/expirationDecision.fixture'
import { productMetaPresentationLabel } from '../humanDecisionPresentation'

function restock(sku: string | null, variantId: string | null): HumanDecision {
  return {
    id: 'decision-1',
    type: 'RESTOCK',
    title: 'Solicitud de reposición de stock',
    sanitizedSummary: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'PENDING',
    version: 1,
    resolution: null,
    allowedActions: [],
    snapshot: {
      branchId: 'branch-1',
      branchName: 'Sucursal Centro',
      productId: 'product-1',
      productName: 'Alimento 15 kg',
      variantId,
      sku,
      requestedQuantity: 2,
      observedStockAtRequest: null,
      stockObservedAt: null,
    },
  }
}

describe('productMetaPresentationLabel', () => {
  it('omits an absent variant instead of saying so (text diet)', () => {
    expect(productMetaPresentationLabel(restock('ALI-15', null))).toBe('ALI-15')
    expect(productMetaPresentationLabel(restock(null, null))).toBe('Sin SKU')
  })

  it('keeps a present variant', () => {
    expect(productMetaPresentationLabel(restock('ALI-15', 'variant-1'))).toBe('ALI-15 · Con variante')
  })

  it('shows the unit by its readable name, never the catalog code', () => {
    const decision = {
      ...pendingExpiration,
      snapshot: { ...pendingExpiration.snapshot, unit: 'UNIDAD', variantId: null },
    } as HumanDecision
    expect(productMetaPresentationLabel(decision)).toBe('Unidad')
  })

  it('keeps an unknown unit as sent and the variant descriptor when present', () => {
    const decision = {
      ...pendingExpiration,
      snapshot: {
        ...pendingExpiration.snapshot,
        unit: 'TARIMA',
        variantId: 'variant-1',
        variantName: 'Chico',
        variantOption: 'Talla',
        variantValue: 'S',
      },
    } as HumanDecision
    expect(productMetaPresentationLabel(decision)).toBe('TARIMA · Chico (Talla: S)')
  })
})
