import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../ability'
import type { AppSubject } from '../../interfaces/auth.types'

afterEach(resetAbility)
describe('purchase order permission registration', () => {
  it('admits each explicit purchase order grant without inferring the others', () => {
    const subject: AppSubject = 'ProcurementPurchaseOrder'
    updateAbilityFromPermissionCodes(['create:ProcurementPurchaseOrder', 'read:ProcurementSupplier'])
    expect(ability.can('create', subject)).toBe(true)
    expect(ability.can('read', subject)).toBe(false)
    expect(ability.can('update', subject)).toBe(false)
    expect(ability.can('delete', subject)).toBe(false)
    expect(ability.can('read', 'ProcurementSupplier')).toBe(true)
  })
  it('admits read/update/delete and revokes them when grants change', () => {
    updateAbilityFromPermissionCodes(['read:ProcurementPurchaseOrder', 'update:ProcurementPurchaseOrder', 'delete:ProcurementPurchaseOrder'])
    expect(ability.can('read', 'ProcurementPurchaseOrder')).toBe(true)
    expect(ability.can('update', 'ProcurementPurchaseOrder')).toBe(true)
    expect(ability.can('delete', 'ProcurementPurchaseOrder')).toBe(true)
    updateAbilityFromPermissionCodes(['read:ProcurementSupplier'])
    expect(ability.can('read', 'ProcurementPurchaseOrder')).toBe(false)
    expect(ability.can('delete', 'ProcurementPurchaseOrder')).toBe(false)
  })
})
