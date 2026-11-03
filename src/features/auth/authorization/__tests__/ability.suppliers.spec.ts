import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../ability'
import type { AppSubject } from '../../interfaces/auth.types'

afterEach(resetAbility)
describe('supplier permission registration', () => {
  it('admits explicit supplier grants without inferring read/update from create', () => {
    const subject: AppSubject = 'ProcurementSupplier'
    updateAbilityFromPermissionCodes(['create:ProcurementSupplier', 'read:Product', 'update:ProcurementSupplier:extra'])
    expect(ability.can('create', subject)).toBe(true)
    expect(ability.can('read', subject)).toBe(false)
    expect(ability.can('update', subject)).toBe(false)
    expect(ability.can('read', 'Product')).toBe(true)
  })
  it('admits read/update and revokes them when grants change', () => {
    updateAbilityFromPermissionCodes(['read:ProcurementSupplier', 'update:ProcurementSupplier'])
    expect(ability.can('read', 'ProcurementSupplier')).toBe(true)
    expect(ability.can('update', 'ProcurementSupplier')).toBe(true)
    updateAbilityFromPermissionCodes(['read:PaymentDetail'])
    expect(ability.can('read', 'ProcurementSupplier')).toBe(false)
    expect(ability.can('update', 'ProcurementSupplier')).toBe(false)
    expect(ability.can('read', 'PaymentDetail')).toBe(true)
  })
})
