import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../ability'
import type { AppAction, AppSubject } from '../../interfaces/auth.types'

afterEach(resetAbility)

describe('shipping settings permission registration (ODD shipping-settings T1)', () => {
  it('admits validate:DeliveryZone without granting the zone CRUD', () => {
    const action: AppAction = 'validate'
    const subject: AppSubject = 'DeliveryZone'
    updateAbilityFromPermissionCodes(['validate:DeliveryZone'])
    expect(ability.can(action, subject)).toBe(true)
    expect(ability.can('read', subject)).toBe(false)
    expect(ability.can('update', subject)).toBe(false)
    expect(ability.rules).toEqual([{ action: 'validate', subject: 'DeliveryZone' }])
  })

  it('admits the four CRUD codes on DeliveryZone and ShippingSettings', () => {
    const subjects: AppSubject[] = ['DeliveryZone', 'ShippingSettings']
    const actions: AppAction[] = ['create', 'read', 'update', 'delete']
    subjects.forEach((subject) => {
      actions.forEach((action) => {
        resetAbility()
        updateAbilityFromPermissionCodes([`${action}:${subject}`])
        expect(ability.can(action, subject)).toBe(true)
      })
    })
  })

  it('lets manage:DeliveryZone imply validate, but not validate on other subjects', () => {
    updateAbilityFromPermissionCodes(['manage:DeliveryZone'])
    expect(ability.can('validate', 'DeliveryZone')).toBe(true)
    expect(ability.can('read', 'DeliveryZone')).toBe(true)
    expect(ability.can('validate', 'ShippingSettings')).toBe(false)
    expect(ability.can('read', 'DeliveryRoute')).toBe(false)
  })

  it('does not inherit the shipping grants from delivery routes or products', () => {
    updateAbilityFromPermissionCodes(['read:DeliveryRoute', 'manage:DeliveryRoute', 'update:Product'])
    expect(ability.can('read', 'DeliveryZone')).toBe(false)
    expect(ability.can('validate', 'DeliveryZone')).toBe(false)
    expect(ability.can('read', 'ShippingSettings')).toBe(false)
  })

  it('keeps existing codes unchanged and well-formed grants beside malformed siblings', () => {
    updateAbilityFromPermissionCodes([
      'read:Product', 'validate:DeliveryZone', 'validate:DeliveryZone:extra', 'approve:DeliveryZone',
      'read:ShippingSettings', 'read:Unknown',
    ])
    expect(ability.can('read', 'Product')).toBe(true)
    expect(ability.can('validate', 'DeliveryZone')).toBe(true)
    expect(ability.can('read', 'ShippingSettings')).toBe(true)
    expect(ability.rules).toHaveLength(3)
  })

  it('revokes the grants when the permission list changes', () => {
    updateAbilityFromPermissionCodes(['validate:DeliveryZone', 'read:ShippingSettings'])
    updateAbilityFromPermissionCodes(['read:Product'])
    expect(ability.can('validate', 'DeliveryZone')).toBe(false)
    expect(ability.can('read', 'ShippingSettings')).toBe(false)
  })
})
