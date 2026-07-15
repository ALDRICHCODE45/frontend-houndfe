// bxgy-promotion-followups REQ-6 — STRICT TDD unit tests for the pure
// `buildBxgyHint` helper.
//
// Why pure (Extract-Before-Mock): the singular/plural ternary is stateless
// and deterministic. Pulling it into a pure function keeps the accordion
// template declarative AND makes this branch testable without a Vue mount.
// Mount-based coverage is reserved for the v-if/v-bind wiring in
// `PromocionesDisponiblesAccordion.test.ts`.
import { describe, it, expect } from 'vitest'
import { buildBxgyHint, getRewardBadgeLabel } from '../promotion.utils'

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

describe('getRewardBadgeLabel (bxgy-reward-badge-label REQ-10)', () => {
  it('returns GRATIS for a 100% BXGY reward', () => {
    expect(getRewardBadgeLabel('buy_x_get_y', 100)).toBe('GRATIS')
  })

  it('returns the partial discount percent for a BXGY reward', () => {
    expect(getRewardBadgeLabel('buy_x_get_y', 50)).toBe('-50%')
  })

  it('returns null for a non-BXGY reward kind', () => {
    expect(getRewardBadgeLabel(null, 100)).toBeNull()
    expect(getRewardBadgeLabel(undefined, 50)).toBeNull()
  })

  it('returns null for a BXGY reward with a missing percent', () => {
    expect(getRewardBadgeLabel('buy_x_get_y', null)).toBeNull()
    expect(getRewardBadgeLabel('buy_x_get_y', undefined)).toBeNull()
  })

  it('returns null for a zero or negative BXGY percent', () => {
    expect(getRewardBadgeLabel('buy_x_get_y', 0)).toBeNull()
    expect(getRewardBadgeLabel('buy_x_get_y', -1)).toBeNull()
  })

  // ── advanced-promotion-type WU-B — 'advanced' branch ────────────────────────
  //
  // Per spec WU-B REQ-2: 'advanced' rewards follow the same percent matrix as
  // BXGY: 100 -> 'GRATIS', 0<pct<100 -> '-N%', null/<=0 -> no badge.
  // The helper is the single source of truth for the label rule, so both
  // SaleItemRow (draft) and SaleDetailItemsList (confirmed) MUST render the
  // same string for the same input — that parity is what gets tested here.

  it('returns GRATIS for an ADVANCED reward at 100%', () => {
    expect(getRewardBadgeLabel('advanced', 100)).toBe('GRATIS')
  })

  it('returns "-50%" for an ADVANCED reward at 50%', () => {
    expect(getRewardBadgeLabel('advanced', 50)).toBe('-50%')
  })

  it('returns "-25%" for an ADVANCED reward at 25%', () => {
    expect(getRewardBadgeLabel('advanced', 25)).toBe('-25%')
  })

  it('returns null for an ADVANCED reward with a missing percent', () => {
    expect(getRewardBadgeLabel('advanced', null)).toBeNull()
    expect(getRewardBadgeLabel('advanced', undefined)).toBeNull()
  })

  it('returns null for an ADVANCED reward with zero or negative percent', () => {
    expect(getRewardBadgeLabel('advanced', 0)).toBeNull()
    expect(getRewardBadgeLabel('advanced', -1)).toBeNull()
  })

  // ── advanced-promotion-type WU-B — mandatory generic fallback ───────────────
  //
  // Any non-null rewardKind that is NOT 'buy_x_get_y' nor 'advanced' must
  // surface a stable "Recompensa" badge via this pure helper. This keeps the
  // surrounding line renderable for future reward families the backend may
  // add — the frontend MUST NEVER throw or fail to render on an unknown kind.

  it('returns "Recompensa" for an unknown non-null rewardKind', () => {
    expect(getRewardBadgeLabel('mystery_code', 50)).toBe('Recompensa')
  })

  it('returns "Recompensa" for another unknown non-null rewardKind', () => {
    expect(getRewardBadgeLabel('tiered_bundle', 100)).toBe('Recompensa')
  })

  it('returns "Recompensa" for an unknown rewardKind even when percent is null', () => {
    // The fallback label MUST render without a known percent; the caller has
    // nothing else to display, so we still render "Recompensa" as a stable hint.
    expect(getRewardBadgeLabel('mystery_code', null)).toBe('Recompensa')
  })

  it('still returns null when rewardKind is null/undefined (no badge, no fallback)', () => {
    // null/undefined are NOT "unknown non-null" — they're the absence of a
    // reward and MUST NOT render any badge (not even "Recompensa").
    expect(getRewardBadgeLabel(null, 100)).toBeNull()
    expect(getRewardBadgeLabel(undefined, 50)).toBeNull()
  })

  it('does not throw on an empty-string rewardKind — returns the generic fallback', () => {
    // Defensive: even pathological strings must not throw. The helper is pure
    // and the SaleItemBadges component must NEVER fail to render.
    expect(() => getRewardBadgeLabel('', 50)).not.toThrow()
    expect(getRewardBadgeLabel('', 50)).toBe('Recompensa')
  })
})
