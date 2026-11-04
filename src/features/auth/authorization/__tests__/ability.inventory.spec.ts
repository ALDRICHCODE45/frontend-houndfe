import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../ability'
import type { AppSubject } from '../../interfaces/auth.types'

afterEach(resetAbility)

describe('inventory journal permission registration', () => {
  it('admits read:InventoryJournal without granting adjustments', () => {
    const subject: AppSubject = 'InventoryJournal'
    updateAbilityFromPermissionCodes(['read:InventoryJournal'])
    expect(ability.can('read', subject)).toBe(true)
    expect(ability.can('create', subject)).toBe(false)
    expect(ability.can('update', subject)).toBe(false)
    expect(ability.can('create', 'InventoryAdjustment')).toBe(false)
  })

  it('admits create:InventoryAdjustment without implying read access to the journal', () => {
    const subject: AppSubject = 'InventoryAdjustment'
    updateAbilityFromPermissionCodes(['create:InventoryAdjustment'])
    expect(ability.can('create', subject)).toBe(true)
    expect(ability.can('read', subject)).toBe(false)
    expect(ability.can('read', 'InventoryJournal')).toBe(false)
  })

  it('does not inherit the inventory grants from sales, products or procurement permissions', () => {
    updateAbilityFromPermissionCodes([
      'read:Product', 'update:Product', 'create:Sale', 'read:Sale', 'read:ProcurementPurchaseOrder',
      'create:ProcurementPurchaseOrder',
    ])
    expect(ability.can('read', 'InventoryJournal')).toBe(false)
    expect(ability.can('create', 'InventoryAdjustment')).toBe(false)
  })

  it('does not hand the inventory grants to a user with no permissions (cashier)', () => {
    updateAbilityFromPermissionCodes([])
    expect(ability.can('read', 'InventoryJournal')).toBe(false)
    expect(ability.can('create', 'InventoryAdjustment')).toBe(false)
  })

  it('keeps the well-formed grants when malformed siblings arrive in the same list', () => {
    updateAbilityFromPermissionCodes([
      'read:InventoryJournal', 'malformed:InventoryJournal', 'create:InventoryAdjustment:extra',
      'create:InventoryAdjustment', 'read:Unknown',
    ])
    expect(ability.can('read', 'InventoryJournal')).toBe(true)
    expect(ability.can('create', 'InventoryAdjustment')).toBe(true)
    expect(ability.can('delete', 'InventoryAdjustment')).toBe(false)
  })

  it('revokes both grants when the permission list changes', () => {
    updateAbilityFromPermissionCodes(['read:InventoryJournal', 'create:InventoryAdjustment'])
    updateAbilityFromPermissionCodes(['read:Product'])
    expect(ability.can('read', 'InventoryJournal')).toBe(false)
    expect(ability.can('create', 'InventoryAdjustment')).toBe(false)
  })

  it('lists the two subjects in the AppSubject union next to the existing ones', () => {
    const subjects: AppSubject[] = ['InventoryJournal', 'InventoryAdjustment', 'Product']
    expect(subjects).toHaveLength(3)
  })
})
