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
})
