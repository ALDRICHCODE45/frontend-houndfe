// «Reembolsos pendientes» sits under POS right after Ventas, gated by read:SaleRefund (T19).

import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'
import { buildCanAccess, filterAccessibleGroups } from '../navigation.access'
import { PENDING_REFUNDS_PATH } from '../navigation.registry'

const pos = () => navigationGroups.find((group) => group.id === 'pos')!

describe('navigation registry — Reembolsos pendientes', () => {
  it('is the POS entry right after Ventas, with read:SaleRefund', () => {
    const children = pos().children
    const index = children.findIndex((child) => child.id === 'pos-sales')
    expect(children[index + 1]).toEqual({
      id: 'pos-refunds',
      label: 'Reembolsos pendientes',
      icon: 'i-lucide-rotate-ccw',
      to: '/pos/reembolsos',
      permission: ['read', 'SaleRefund'],
    })
    expect(PENDING_REFUNDS_PATH).toBe('/pos/reembolsos')
  })

  it('shows only with read:SaleRefund and has no quick action', () => {
    const canReadRefunds = buildCanAccess({
      isSuperAdmin: false,
      userCan: (action, subject) => action === 'read' && subject === 'SaleRefund',
    })
    const visible = filterAccessibleGroups(navigationGroups, canReadRefunds)
    expect(visible.flatMap((group) => group.children.map((child) => child.id))).toEqual(['pos-refunds'])

    const none = filterAccessibleGroups(navigationGroups, buildCanAccess({ isSuperAdmin: false, userCan: () => false }))
    expect(none.flatMap((group) => group.children)).toEqual([])
    expect(quickActions.some((action) => action.to === '/pos/reembolsos')).toBe(false)
  })
})
