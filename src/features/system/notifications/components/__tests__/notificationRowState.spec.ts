// notificationRowState.spec.ts — RED-first tests for the pure row-state
// helpers. ZERO mocks; pure data in, pure data out.

import { describe, it, expect } from 'vitest'
import {
  computeActionRowState,
  computeModuleActionCount,
  toggleActionMembership,
} from '../notificationRowState'
import { ACTION_REGISTRY, findActionDescriptor } from '../../registry/action-registry'
import type { ActionDescriptor, ModuleDescriptor } from '../../interfaces/notification-config.types'

const LOW_STOCK = { key: 'LOW_STOCK', label: 'Bajo inventario' } as const

describe('computeActionRowState', () => {
  it('checked=false, disabled=true when master is OFF and action is not in the set', () => {
    expect(computeActionRowState(LOW_STOCK, false, [])).toEqual({
      checked: false,
      disabled: true,
    })
  })

  it('checked=true, disabled=true when master is OFF but action is in the set (cannot toggle)', () => {
    expect(computeActionRowState(LOW_STOCK, false, ['LOW_STOCK'])).toEqual({
      checked: true,
      disabled: true,
    })
  })

  it('checked=false, disabled=false when master is ON and action is not in the set', () => {
    expect(computeActionRowState(LOW_STOCK, true, [])).toEqual({
      checked: false,
      disabled: false,
    })
  })

  it('checked=true, disabled=false when master is ON and action is in the set', () => {
    expect(computeActionRowState(LOW_STOCK, true, ['LOW_STOCK'])).toEqual({
      checked: true,
      disabled: false,
    })
  })

  it('unknown action keys never match (checked=false)', () => {
    // Defensive: registry-driven, but should be safe against stale prop sets.
    // Cast through unknown to ActionDescriptor — the helper is typed
    // strictly but the runtime semantics are pure inclusion checks.
    const ghost = { key: 'GHOST', label: 'Ghost' } as unknown as ActionDescriptor
    expect(computeActionRowState(ghost, true, ['LOW_STOCK']).checked).toBe(false)
  })
})

describe('computeModuleActionCount', () => {
  const module: ModuleDescriptor = {
    moduleKey: 'pos',
    moduleLabel: 'Punto de venta',
    actions: [LOW_STOCK],
  }

  it('reports "0/1" when no action is enabled', () => {
    expect(computeModuleActionCount(module, [])).toEqual({
      enabled: 0,
      total: 1,
      label: '0/1',
    })
  })

  it('reports "1/1" when the single action is enabled', () => {
    expect(computeModuleActionCount(module, ['LOW_STOCK'])).toEqual({
      enabled: 1,
      total: 1,
      label: '1/1',
    })
  })

  it('reports "1/2" for a 2-action module with one enabled', () => {
    const newHire = { key: 'NEW_HIRE', label: 'Nuevo empleado' } as unknown as ActionDescriptor
    const two: ModuleDescriptor = {
      moduleKey: 'pos',
      moduleLabel: 'Punto de venta',
      actions: [LOW_STOCK, newHire],
    }
    expect(computeModuleActionCount(two, ['LOW_STOCK'])).toEqual({
      enabled: 1,
      total: 2,
      label: '1/2',
    })
  })

  it('ignores action keys that are not part of this module', () => {
    expect(computeModuleActionCount(module, ['LOW_STOCK', 'GHOST']).label).toBe('1/1')
  })
})

describe('toggleActionMembership', () => {
  it('adds the key when it is not in the set', () => {
    expect(toggleActionMembership('LOW_STOCK', [])).toEqual(['LOW_STOCK'])
  })

  it('removes the key when it is in the set', () => {
    expect(toggleActionMembership('LOW_STOCK', ['LOW_STOCK'])).toEqual([])
  })

  it('returns a NEW array (does not mutate the input)', () => {
    const original = ['LOW_STOCK']
    const next = toggleActionMembership('LOW_STOCK', original)
    expect(next).not.toBe(original)
    expect(original).toEqual(['LOW_STOCK'])
  })

  it('preserves the order of the other keys when removing', () => {
    expect(toggleActionMembership('LOW_STOCK', ['A', 'LOW_STOCK', 'B'])).toEqual(['A', 'B'])
  })

  it('appends the new key at the end when adding', () => {
    expect(toggleActionMembership('LOW_STOCK', ['A', 'B'])).toEqual(['A', 'B', 'LOW_STOCK'])
  })
})

describe('Promociones row state / counts (PCA-4)', () => {
  const promotions = ACTION_REGISTRY.find((m) => m.moduleKey === 'promotions')!

  it('reports 0/2 with nothing enabled (tenant default: both OFF)', () => {
    expect(computeModuleActionCount(promotions, [])).toEqual({
      enabled: 0,
      total: 2,
      label: '0/2',
    })
  })

  it('reports 1/2 with exactly one promotion enabled', () => {
    expect(computeModuleActionCount(promotions, ['PROMOTION_EXPIRING']).label).toBe('1/2')
    expect(computeModuleActionCount(promotions, ['PROMOTION_NEAR_CAPACITY']).label).toBe('1/2')
  })

  it('reports 2/2 with both promotion actions enabled', () => {
    expect(
      computeModuleActionCount(promotions, ['PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY']).label,
    ).toBe('2/2')
  })

  it('counts only this module (unrelated enabled keys do not leak in)', () => {
    expect(computeModuleActionCount(promotions, ['LOW_STOCK', 'DELIVERY_NEXT_STOP']).label).toBe(
      '0/2',
    )
  })

  it('renders both promotion rows unchecked by default and togglable', () => {
    expect(computeActionRowState(findActionDescriptor('PROMOTION_EXPIRING')!, true, [])).toEqual({
      checked: false,
      disabled: false,
    })
    expect(
      computeActionRowState(findActionDescriptor('PROMOTION_NEAR_CAPACITY')!, true, []),
    ).toEqual({ checked: false, disabled: false })
  })

  it('greys both promotion rows when the master toggle is OFF', () => {
    expect(computeActionRowState(findActionDescriptor('PROMOTION_EXPIRING')!, false, [])).toEqual({
      checked: false,
      disabled: true,
    })
  })

  it('independent toggling: enabling one promotion preserves unrelated enabled actions', () => {
    expect(
      toggleActionMembership('PROMOTION_EXPIRING', ['LOW_STOCK', 'DELIVERY_NEXT_STOP']),
    ).toEqual(['LOW_STOCK', 'DELIVERY_NEXT_STOP', 'PROMOTION_EXPIRING'])
  })

  it('independent toggling: the two promotion keys do not imply each other', () => {
    const one = toggleActionMembership('PROMOTION_EXPIRING', [])
    expect(one).toEqual(['PROMOTION_EXPIRING'])
    expect(one).not.toContain('PROMOTION_NEAR_CAPACITY')

    const two = toggleActionMembership('PROMOTION_NEAR_CAPACITY', one)
    expect(two).toEqual(['PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY'])
  })

  it('disabling one promotion preserves the other promotion key', () => {
    expect(
      toggleActionMembership('PROMOTION_EXPIRING', [
        'PROMOTION_EXPIRING',
        'PROMOTION_NEAR_CAPACITY',
      ]),
    ).toEqual(['PROMOTION_NEAR_CAPACITY'])
  })
})
