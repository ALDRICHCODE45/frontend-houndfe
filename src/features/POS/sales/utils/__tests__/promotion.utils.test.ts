// bxgy-promotion-followups REQ-6 — STRICT TDD unit tests for the pure
// `buildBxgyHint` helper.
//
// Why pure (Extract-Before-Mock): the singular/plural ternary is stateless
// and deterministic. Pulling it into a pure function keeps the accordion
// template declarative AND makes this branch testable without a Vue mount.
// Mount-based coverage is reserved for the v-if/v-bind wiring in
// `PromocionesDisponiblesAccordion.test.ts`.
import { describe, it, expect } from 'vitest'
import { buildBxgyHint } from '../promotion.utils'

describe('buildBxgyHint (bxgy-promotion-followups REQ-6)', () => {
  it('returns singular "unidad" when unitsNeeded === 1', () => {
    expect(buildBxgyHint(1)).toBe('2x1 · requiere 1 unidad más')
  })

  it('returns plural "unidades" when unitsNeeded === 2', () => {
    expect(buildBxgyHint(2)).toBe('2x1 · requiere 2 unidades más')
  })

  it('returns plural "unidades" when unitsNeeded >= 3', () => {
    expect(buildBxgyHint(3)).toBe('2x1 · requiere 3 unidades más')
    expect(buildBxgyHint(5)).toBe('2x1 · requiere 5 unidades más')
  })

  it('always starts with the static "2x1 ·" prefix per spec REQ-6', () => {
    expect(buildBxgyHint(1)).toMatch(/^2x1 · /)
    expect(buildBxgyHint(2)).toMatch(/^2x1 · /)
  })

  it('ends with "más" per spec REQ-6', () => {
    expect(buildBxgyHint(1).endsWith('más')).toBe(true)
    expect(buildBxgyHint(2).endsWith('más')).toBe(true)
  })
})
