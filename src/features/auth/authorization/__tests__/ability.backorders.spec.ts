import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../ability'
import type { AppAction } from '../../interfaces/auth.types'

afterEach(resetAbility)

// ODD restock-backorder T1 (S2): `Backorder` has `read` and `update` (cancel) only; Manager gets
// both, Cashier only read. No staff creation in v1, so `create` is never granted by these codes.
describe('Backorder permission registration (ODD restock-backorder T1, S2)', () => {
  it.each(['read', 'update'] as const)('keeps %s:Backorder and grants only that rule', (action) => {
    updateAbilityFromPermissionCodes([`${action}:Backorder`, 'malformed:Backorder'])
    expect(ability.can(action, 'Backorder')).toBe(true)
    expect(ability.rules).toEqual([{ action, subject: 'Backorder' }])
  })

  it('keeps read and update as separate grants (Cashier: read only)', () => {
    updateAbilityFromPermissionCodes(['read:Backorder'])
    expect(ability.can('read', 'Backorder')).toBe(true)
    expect(ability.can('update', 'Backorder')).toBe(false)
    updateAbilityFromPermissionCodes(['update:Backorder'])
    expect(ability.can('update', 'Backorder')).toBe(true)
    expect(ability.can('read', 'Backorder')).toBe(false)
  })

  it('grants no other verb on Backorder, nor Backorder through sibling subjects', () => {
    updateAbilityFromPermissionCodes(['read:Backorder', 'update:Backorder', 'update:ChatbotRequest'])
    for (const action of ['create', 'delete', 'batch_delete', 'validate', 'manage'] as AppAction[]) {
      expect(ability.can(action, 'Backorder')).toBe(false)
    }
    updateAbilityFromPermissionCodes(['read:ChatbotRequest', 'update:Sale', 'read:CashClosing'])
    expect(ability.can('read', 'Backorder')).toBe(false)
    expect(ability.can('update', 'Backorder')).toBe(false)
  })
})
