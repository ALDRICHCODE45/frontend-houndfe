import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../ability'
import type { AppSubject } from '../../interfaces/auth.types'

afterEach(resetAbility)
describe('purchase order transition permission registration', () => {
  it('admits confirmation and cancellation as separate grants without implying edits', () => {
    const confirmation: AppSubject = 'ProcurementOrderConfirmation'
    const cancellation: AppSubject = 'ProcurementOrderCancellation'
    updateAbilityFromPermissionCodes(['create:ProcurementOrderConfirmation', 'read:ProcurementPurchaseOrder'])
    expect(ability.can('create', confirmation)).toBe(true)
    expect(ability.can('create', cancellation)).toBe(false)
    expect(ability.can('update', 'ProcurementPurchaseOrder')).toBe(false)
    updateAbilityFromPermissionCodes(['create:ProcurementOrderCancellation'])
    expect(ability.can('create', cancellation)).toBe(true)
    expect(ability.can('create', confirmation)).toBe(false)
    expect(ability.can('read', 'ProcurementPurchaseOrder')).toBe(false)
  })
})
