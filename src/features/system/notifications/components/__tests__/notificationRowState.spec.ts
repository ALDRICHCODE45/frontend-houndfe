// notificationRowState.spec.ts — RED-first tests for the pure row-state
// helpers. ZERO mocks; pure data in, pure data out.

import { describe, it, expect } from 'vitest'
import {
  computeActionRowState,
  computeModuleActionCount,
  toggleActionMembership,
} from '../notificationRowState'
import type { ModuleDescriptor } from '../../interfaces/notification-config.types'

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
    const ghost = { key: 'GHOST', label: 'Ghost' } as const
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
    const two: ModuleDescriptor = {
      moduleKey: 'pos',
      moduleLabel: 'Punto de venta',
      actions: [
        LOW_STOCK,
        { key: 'NEW_HIRE', label: 'Nuevo empleado' },
      ],
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