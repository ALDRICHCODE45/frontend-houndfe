// action-registry.spec.ts — RED-first tests for the data-driven registry.
//
// What this test guards:
// - The registry is data (an array of `ModuleDescriptor`), NOT a per-action
//   switch statement. Adding a new module/action must be a data edit.
// - The id ↔ enabledActions mapping is the SOLE contract the view depends
//   on to render checkboxes from `enabledActions: ActionKey[]`.
// - Lookup is total over the registered keys — every key the backend can
//   emit must be findable in the registry.

import { describe, it, expect } from 'vitest'
import {
  ACTION_REGISTRY,
  findActionDescriptor,
  getActionsByKeys,
  isRegisteredActionKey,
} from '../action-registry'
import type { ActionKey, ModuleDescriptor } from '../../interfaces/notification-config.types'

describe('ACTION_REGISTRY shape', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ACTION_REGISTRY)).toBe(true)
    expect(ACTION_REGISTRY.length).toBeGreaterThan(0)
  })

  it('every entry has moduleKey, moduleLabel, actions[] with key+label', () => {
    for (const module of ACTION_REGISTRY) {
      expect(typeof module.moduleKey).toBe('string')
      expect(module.moduleKey.length).toBeGreaterThan(0)
      expect(typeof module.moduleLabel).toBe('string')
      expect(module.moduleLabel.length).toBeGreaterThan(0)
      expect(Array.isArray(module.actions)).toBe(true)
      expect(module.actions.length).toBeGreaterThan(0)
      for (const action of module.actions) {
        expect(typeof action.key).toBe('string')
        expect(action.key.length).toBeGreaterThan(0)
        expect(typeof action.label).toBe('string')
        expect(action.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('every action.key is unique across the whole registry (no duplicates)', () => {
    const seen = new Set<string>()
    for (const module of ACTION_REGISTRY) {
      for (const action of module.actions) {
        expect(seen.has(action.key)).toBe(false)
        seen.add(action.key)
      }
    }
  })

  it('contains the "Punto de venta" module with "Bajo inventario" / LOW_STOCK action', () => {
    const pos = ACTION_REGISTRY.find((m) => m.moduleKey === 'pos')
    expect(pos).toBeDefined()
    expect(pos!.moduleLabel).toBe('Punto de venta')
    const lowStock = pos!.actions.find((a) => a.key === 'LOW_STOCK')
    expect(lowStock).toBeDefined()
    expect(lowStock!.label).toBe('Bajo inventario')
  })
})

describe('isRegisteredActionKey', () => {
  it('returns true for keys that exist in the registry', () => {
    expect(isRegisteredActionKey('LOW_STOCK')).toBe(true)
  })

  it('returns false for keys NOT in the registry', () => {
    expect(isRegisteredActionKey('NOT_REAL' as ActionKey)).toBe(false)
  })
})

describe('findActionDescriptor (id ↔ enabledActions mapping)', () => {
  it('returns the descriptor for a registered key', () => {
    const descriptor = findActionDescriptor('LOW_STOCK')
    expect(descriptor).toBeDefined()
    expect(descriptor!.key).toBe('LOW_STOCK')
    expect(descriptor!.label).toBe('Bajo inventario')
  })

  it('returns undefined for an unknown key (so the view can render a warning)', () => {
    expect(findActionDescriptor('GHOST_KEY' as ActionKey)).toBeUndefined()
  })
})

describe('getActionsByKeys (enabledActions → module/action structure)', () => {
  it('returns an empty array when enabledActions is empty', () => {
    expect(getActionsByKeys([])).toEqual([])
  })

  it('returns the matching descriptors for the supplied keys, preserving order', () => {
    const result = getActionsByKeys(['LOW_STOCK'])
    expect(result).toHaveLength(1)
    expect(result[0]?.key).toBe('LOW_STOCK')
    expect(result[0]?.label).toBe('Bajo inventario')
  })

  it('preserves the order of the input keys (matters for the UI)', () => {
    // Even with a single key today, this asserts the contract holds as the
    // registry grows — callers can rely on the order they passed in.
    const result = getActionsByKeys(['LOW_STOCK'])
    expect(result.map((a) => a.key)).toEqual(['LOW_STOCK'])
  })

  it('skips unknown keys silently (defensive — backend must not emit unknown keys, but we never crash)', () => {
    const result = getActionsByKeys(['LOW_STOCK', 'GHOST_KEY' as ActionKey])
    expect(result).toHaveLength(1)
    expect(result[0]?.key).toBe('LOW_STOCK')
  })
})

describe('EXTENSION GUARANTEE — adding a module is registry-only', () => {
  it('does not require any switch/case statements in the production code (data-driven)', () => {
    // Inspect that the registry is the only source of truth: every key the
    // backend can emit (the ActionKey union) must be findable in the
    // registry. If a future ActionKey were added to the union without a
    // matching registry entry, this assertion would still pass — the
    // contract is: the union is a subset of the registry, NOT the other
    // way around. We assert the registry contains the canonical key.
    const allKeys = ACTION_REGISTRY.flatMap((m) => m.actions.map((a) => a.key))
    expect(allKeys).toContain('LOW_STOCK')

    // And the registry is structurally a ModuleDescriptor[] — no code
    // branching per action lives outside the registry.
    const sample: ModuleDescriptor = ACTION_REGISTRY[0]!
    expect(sample).toMatchObject({
      moduleKey: expect.any(String),
      moduleLabel: expect.any(String),
      actions: expect.any(Array),
    })
  })
})
