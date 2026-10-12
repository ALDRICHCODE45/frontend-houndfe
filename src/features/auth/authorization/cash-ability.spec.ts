import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from './ability'

const rows = [
  ['read', 'CashRegister'],
  ['create', 'CashRegister'],
  ['update', 'CashRegister'],
  ['read', 'CashSession'],
  ['create', 'CashSession'],
  ['read', 'CashSessionAudit'],
  ['create', 'CashCount'],
  ['create', 'CashIn'],
  ['create', 'CashOut'],
  ['create', 'CashVerification'],
  ['create', 'CashHandover'],
  ['read', 'CashHandover'],
  ['update', 'CashHandover'],
] as const

afterEach(resetAbility)

describe('cash permission registry', () => {
  it.each(rows)('preserves the granular %s:%s grant', (action, subject) => {
    updateAbilityFromPermissionCodes([`${action}:${subject}`, 'malformed:CashSession'])
    expect(ability.can(action, subject)).toBe(true)
    expect(ability.can('delete', subject)).toBe(false)
  })

  it('keeps existing sale grants and does not turn audit into custody permission', () => {
    updateAbilityFromPermissionCodes(['update:Sale', 'read:CashSessionAudit'])
    expect(ability.can('update', 'Sale')).toBe(true)
    expect(ability.can('read', 'CashHandover')).toBe(false)
  })
})
