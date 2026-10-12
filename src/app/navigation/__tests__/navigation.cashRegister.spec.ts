// navigation.cashRegister.spec.ts — the POS "Caja" sidebar entry
// (cash-register-ui T2, S1 subset).
//
// The registry must carry a POS child gated by ['read', 'CashRegister'], and the
// shared access filter must hide it when the permission is absent. It has no
// `requiresSuperAdmin` flag: a tenant cashier may hold the grant.

import { describe, expect, it } from 'vitest'
import { navigationGroups } from '../navigation.registry'
import { resolveLandingDestinationForAuth } from '../navigation.landing'
import { filterAccessibleGroups, type CanAccess } from '../navigation.access'
import type { NavGroup } from '../navigation.types'

const CAJA_ENTRY = {
  id: 'pos-cash-register',
  label: 'Caja',
  to: '/pos/caja',
  permission: ['read', 'CashRegister'],
}

function findPosGroup(groups: NavGroup[]) {
  return groups.find((group) => group.id === 'pos')
}

function canAccessCashRegister(): CanAccess {
  return (permission) =>
    Boolean(permission && permission[0] === 'read' && permission[1] === 'CashRegister')
}

describe('navigation registry — POS "Caja" entry (cash-register-ui T2)', () => {
  it('provides a reception landing for the minimal receiver, not operational Caja', () => {
    const codes = new Set(['read:CashHandover', 'update:CashHandover'])
    const userCan = (action: string, subject: string) => codes.has(`${action}:${subject}`)
    const filtered = filterAccessibleGroups(navigationGroups, (permission) =>
      Boolean(permission && userCan(...permission)),
    )
    expect(findPosGroup(filtered)?.children.map((child) => child.to)).toEqual([
      '/pos/caja/recepciones',
    ])
    expect(resolveLandingDestinationForAuth({ isSuperAdmin: false, userCan })).toBe(
      '/pos/caja/recepciones',
    )
    expect(userCan('read', 'CashRegister')).toBe(false)
    expect(userCan('read', 'CashSessionAudit')).toBe(false)
    expect([...codes]).toEqual(['read:CashHandover', 'update:CashHandover'])
  })

  it('registers the entry inside the POS group', () => {
    const pos = findPosGroup(navigationGroups)
    expect(pos).toBeDefined()
    const entry = pos!.children.find((child) => child.id === CAJA_ENTRY.id)
    expect(entry).toBeDefined()
    expect(entry!.label).toBe(CAJA_ENTRY.label)
    expect(entry!.to).toBe(CAJA_ENTRY.to)
  })

  it('gates the entry with read:CashRegister and no super-admin requirement', () => {
    const pos = findPosGroup(navigationGroups)
    const entry = pos!.children.find((child) => child.id === CAJA_ENTRY.id)
    expect(entry!.permission).toEqual(['read', 'CashRegister'])
    expect(entry!.requiresSuperAdmin).toBeUndefined()
  })

  it('keeps the entry when read:CashRegister is granted', () => {
    const filtered = filterAccessibleGroups(navigationGroups, canAccessCashRegister())
    const pos = findPosGroup(filtered)
    expect(pos!.children.some((child) => child.id === CAJA_ENTRY.id)).toBe(true)
  })

  it('drops the entry when read:CashRegister is absent', () => {
    const filtered = filterAccessibleGroups(navigationGroups, () => false)
    const pos = findPosGroup(filtered)
    expect(!pos || !pos.children.some((child) => child.id === CAJA_ENTRY.id)).toBe(true)
  })

  it('keeps the POS group alive for a cashier holding only cash permissions', () => {
    const filtered = filterAccessibleGroups(navigationGroups, canAccessCashRegister())
    const pos = findPosGroup(filtered)
    expect(pos!.children.map((child) => child.id)).toEqual([CAJA_ENTRY.id])
  })
})
