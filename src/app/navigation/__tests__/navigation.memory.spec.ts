// navigation.memory.spec.ts — STRICT-TDD contract for the per-scope landing
// memory storage layer (ODD root-last-route).
//
// Behaviour under test: a versioned, encoded (user, tenant) key; absent scope
// skips memory entirely; blank records are reported as unusable; one scope's
// record never deletes another scope's; and every storage failure mode
// (throwing localStorage getter, getItem, setItem, removeItem) degrades to "no
// memory" without throwing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LANDING_MEMORY_PREFIX,
  buildLandingMemoryKey,
  clearRememberedLanding,
  readRememberedLanding,
  writeRememberedLanding,
} from '../navigation.memory'

const scopeA = { userId: 'user-1', tenantId: 'tenant-1' }
const scopeB = { userId: 'user-1', tenantId: 'tenant-2' }

function keyOf(scope: { userId: string; tenantId: string }): string {
  const key = buildLandingMemoryKey(scope)
  if (key === null) throw new Error('expected a scoped key')
  return key
}

describe('buildLandingMemoryKey', () => {
  it('builds a versioned key that encodes both user and tenant', () => {
    expect(buildLandingMemoryKey({ userId: 'user 1/a', tenantId: 'tenant:2' })).toBe(
      `${LANDING_MEMORY_PREFIX}:user%201%2Fa:tenant%3A2`,
    )
  })

  it('isolates keys per user and per tenant', () => {
    const keys = new Set([
      keyOf({ userId: 'user-1', tenantId: 'tenant-1' }),
      keyOf({ userId: 'user-2', tenantId: 'tenant-1' }),
      keyOf({ userId: 'user-1', tenantId: 'tenant-2' }),
    ])
    expect(keys.size).toBe(3)
  })

  it.each([
    { label: 'missing user', scope: { userId: null, tenantId: 'tenant-1' } },
    { label: 'missing tenant', scope: { userId: 'user-1', tenantId: undefined } },
    { label: 'blank values', scope: { userId: '   ', tenantId: '' } },
  ])('returns null for $label so memory is skipped', ({ scope }) => {
    expect(buildLandingMemoryKey(scope)).toBeNull()
  })
})

describe('remembered landing storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('reports no record for an unseen scope', () => {
    expect(readRememberedLanding(scopeA)).toEqual({ hasRecord: false, path: null })
  })

  it('round-trips a written canonical path', () => {
    expect(writeRememberedLanding(scopeA, '/pos/ventas')).toBe(true)
    expect(readRememberedLanding(scopeA)).toEqual({ hasRecord: true, path: '/pos/ventas' })
  })

  it('reports a blank record as present but unusable', () => {
    localStorage.setItem(keyOf(scopeA), '   ')
    expect(readRememberedLanding(scopeA)).toEqual({ hasRecord: true, path: null })
  })

  it('rejects a non-absolute path instead of persisting it', () => {
    expect(writeRememberedLanding(scopeA, 'pos/ventas')).toBe(false)
    expect(writeRememberedLanding(scopeA, 'https://evil.example.com/')).toBe(false)
    expect(readRememberedLanding(scopeA).hasRecord).toBe(false)
  })

  it('skips both read and write when the scope is absent', () => {
    const setItem = vi.spyOn(globalThis.localStorage, 'setItem')
    expect(readRememberedLanding({ userId: null, tenantId: null })).toEqual({
      hasRecord: false,
      path: null,
    })
    expect(writeRememberedLanding({ userId: 'user-1', tenantId: '' }, '/pos/ventas')).toBe(false)
    expect(() => clearRememberedLanding({ userId: null, tenantId: null })).not.toThrow()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('never deletes another tenant record when clearing one scope', () => {
    writeRememberedLanding(scopeA, '/pos/ventas')
    writeRememberedLanding(scopeB, '/pos/products')

    clearRememberedLanding(scopeA)

    expect(readRememberedLanding(scopeA).hasRecord).toBe(false)
    expect(readRememberedLanding(scopeB)).toEqual({ hasRecord: true, path: '/pos/products' })
  })

  it('degrades to no memory when getItem throws', () => {
    writeRememberedLanding(scopeA, '/pos/ventas')
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    expect(readRememberedLanding(scopeA)).toEqual({ hasRecord: false, path: null })
  })

  it('reports failure instead of throwing when setItem throws', () => {
    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(writeRememberedLanding(scopeA, '/pos/ventas')).toBe(false)
  })

  it('swallows removeItem failures', () => {
    writeRememberedLanding(scopeA, '/pos/ventas')
    vi.spyOn(globalThis.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    expect(() => clearRememberedLanding(scopeA)).not.toThrow()
  })

  it('degrades to no memory when the localStorage getter itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled by policy')
      },
    })

    try {
      expect(readRememberedLanding(scopeA)).toEqual({ hasRecord: false, path: null })
      expect(writeRememberedLanding(scopeA, '/pos/ventas')).toBe(false)
      expect(() => clearRememberedLanding(scopeA)).not.toThrow()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else delete (globalThis as { localStorage?: Storage }).localStorage
    }
  })
})
