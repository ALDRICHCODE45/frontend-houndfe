import { describe, it, expect, beforeEach } from 'vitest'
import { ability, updateAbilityFromPermissionCodes, resetAbility } from '../ability'
import type { AppSubject } from '../../interfaces/auth.types'

describe('ability with Sale subject', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('should parse read:Sale permission correctly', () => {
    updateAbilityFromPermissionCodes(['read:Sale'])

    expect(ability.can('read', 'Sale')).toBe(true)
    expect(ability.can('create', 'Sale')).toBe(false)
  })

  it('should parse create:Sale permission correctly', () => {
    updateAbilityFromPermissionCodes(['create:Sale'])

    expect(ability.can('create', 'Sale')).toBe(true)
    expect(ability.can('read', 'Sale')).toBe(false)
  })

  it('should parse multiple Sale permissions', () => {
    updateAbilityFromPermissionCodes(['read:Sale', 'update:Sale', 'delete:Sale'])

    expect(ability.can('read', 'Sale')).toBe(true)
    expect(ability.can('update', 'Sale')).toBe(true)
    expect(ability.can('delete', 'Sale')).toBe(true)
    expect(ability.can('create', 'Sale')).toBe(false)
  })

  it('should handle Sale alongside other subjects', () => {
    updateAbilityFromPermissionCodes(['read:Sale', 'read:Product', 'create:Customer'])

    expect(ability.can('read', 'Sale')).toBe(true)
    expect(ability.can('read', 'Product')).toBe(true)
    expect(ability.can('create', 'Customer')).toBe(true)
  })

  it('should reject invalid Sale permission format', () => {
    updateAbilityFromPermissionCodes(['read:Sale:extra', 'invalid'])

    expect(ability.can('read', 'Sale')).toBe(false)
  })

  it('should validate Sale is in AppSubject type union', () => {
    const subject: AppSubject = 'Sale'
    expect(subject).toBe('Sale')
  })

  it('should parse read:TenantMembership permission correctly', () => {
    updateAbilityFromPermissionCodes(['read:TenantMembership'])

    expect(ability.can('read', 'TenantMembership')).toBe(true)
    expect(ability.can('create', 'TenantMembership')).toBe(false)
  })

  it('should validate TenantMembership is in AppSubject type union', () => {
    const subject: AppSubject = 'TenantMembership'
    expect(subject).toBe('TenantMembership')
  })
})

describe('ability with NotificationConfig subject (notification-config WU-1)', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('should parse read:NotificationConfig and grant read permission', () => {
    updateAbilityFromPermissionCodes(['read:NotificationConfig'])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
    expect(ability.can('update', 'NotificationConfig')).toBe(false)
  })

  it('should parse update:NotificationConfig and grant update permission', () => {
    updateAbilityFromPermissionCodes(['update:NotificationConfig'])

    expect(ability.can('update', 'NotificationConfig')).toBe(true)
    expect(ability.can('read', 'NotificationConfig')).toBe(false)
  })

  it('should parse read+update+create codes together on NotificationConfig', () => {
    updateAbilityFromPermissionCodes([
      'read:NotificationConfig',
      'update:NotificationConfig',
    ])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
    expect(ability.can('update', 'NotificationConfig')).toBe(true)
    expect(ability.can('delete', 'NotificationConfig')).toBe(false)
  })

  it('should not silently drop NotificationConfig — guard against parsePermissionCode returning null', () => {
    // If NotificationConfig is missing from APP_SUBJECTS, parsePermissionCode
    // returns null and the ability is never updated, so .can() stays false.
    updateAbilityFromPermissionCodes(['read:NotificationConfig'])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
  })

  it('should keep NotificationConfig alongside other subjects without bleed', () => {
    updateAbilityFromPermissionCodes([
      'read:NotificationConfig',
      'read:Product',
      'update:Customer',
    ])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
    expect(ability.can('read', 'Product')).toBe(true)
    expect(ability.can('update', 'Customer')).toBe(true)
    expect(ability.can('update', 'NotificationConfig')).toBe(false)
  })

  it('should validate NotificationConfig is in AppSubject type union', () => {
    const subject: AppSubject = 'NotificationConfig'
    expect(subject).toBe('NotificationConfig')
  })
})
