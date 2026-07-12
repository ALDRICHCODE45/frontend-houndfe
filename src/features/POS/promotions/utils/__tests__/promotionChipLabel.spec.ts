import { describe, it, expect } from 'vitest'
import { chipLabel } from '../promotionChipLabel'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../../interfaces/promotion.types'

// Helper to keep test data terse and focused on the contract.
function entry(
  partial: Partial<PromotionTargetItemFormEntry> & Pick<PromotionTargetItemFormEntry, 'targetId'>,
): PromotionTargetItemFormEntry {
  return { name: '', ...partial }
}

describe('chipLabel — shared dedupe util', () => {
  describe('all four target types — same behavior', () => {
    it('CATEGORIES: renders "{productName} · {name}" only when both present', () => {
      const item = entry({
        targetId: 'c1',
        name: 'Camisetas',
        productId: 'p1',
        productName: 'Camisa',
      })
      const out = chipLabel(item, 'CATEGORIES')
      expect(out).toBe('Camisa · Camisetas')
    })

    it('BRANDS: renders "{productName} · {name}" only when both present', () => {
      const item = entry({
        targetId: 'b1',
        name: 'Nike',
        productId: 'p1',
        productName: 'Camisa',
      })
      const out = chipLabel(item, 'BRANDS')
      expect(out).toBe('Camisa · Nike')
    })

    it('PRODUCTS: renders "{productName} · {name}" only when both present', () => {
      const item = entry({
        targetId: 'p9',
        name: 'Camisa Azul',
        productId: 'p1',
        productName: 'Camisa',
      })
      const out = chipLabel(item, 'PRODUCTS')
      expect(out).toBe('Camisa · Camisa Azul')
    })

    it('VARIANTS: renders "{productName} · {name}" when both present (the only branch that needs it today)', () => {
      const item = entry({
        targetId: 'v1',
        name: 'Talle M',
        productId: 'p1',
        productName: 'Camisa',
      })
      const out = chipLabel(item, 'VARIANTS')
      expect(out).toBe('Camisa · Talle M')
    })
  })

  describe('fallback — name only or empty', () => {
    it('returns name when productName is absent', () => {
      const item = entry({ targetId: 'p1', name: 'Camisa Azul' })
      expect(chipLabel(item, 'PRODUCTS')).toBe('Camisa Azul')
    })

    it('returns name when productName is empty string', () => {
      const item = entry({ targetId: 'p1', name: 'Camisa Azul', productName: '' })
      expect(chipLabel(item, 'PRODUCTS')).toBe('Camisa Azul')
    })

    it('falls back to targetId when name is empty and productName is absent', () => {
      const item = entry({ targetId: 'uuid-1234', name: '' })
      expect(chipLabel(item, 'VARIANTS')).toBe('uuid-1234')
    })

    it('falls back to targetId when name is empty even with productName', () => {
      // Variant entry without resolved name (edit-mode unresolvable) — chip
      // must NOT render "Product · " with trailing dot, must show identifier.
      const item = entry({ targetId: 'uuid-1234', name: '', productName: 'Camisa' })
      expect(chipLabel(item, 'VARIANTS')).toBe('uuid-1234')
    })
  })

  describe('type argument is optional (no behavior change when omitted)', () => {
    it('chipLabel(item) without type still produces the deduped label', () => {
      const item = entry({
        targetId: 'v1',
        name: 'Talle M',
        productId: 'p1',
        productName: 'Camisa',
      })
      expect(chipLabel(item)).toBe('Camisa · Talle M')
    })
  })

  describe('all four target types accept any item shape consistently', () => {
    // Triangulation: the same item, with type swept, must produce the same
    // string. The util is intentionally type-agnostic — the type arg is reserved
    // for future type-specific formatting (Slice 3+). Today, output is
    // identical across types for the same input.
    const item = entry({
      targetId: 'x',
      name: 'N',
      productId: 'p',
      productName: 'P',
    })
    const types: PromotionTargetType[] = ['CATEGORIES', 'BRANDS', 'PRODUCTS', 'VARIANTS']

    for (const t of types) {
      it(`chipLabel(item, "${t}") -> "P · N"`, () => {
        expect(chipLabel(item, t)).toBe('P · N')
      })
    }
  })
})
