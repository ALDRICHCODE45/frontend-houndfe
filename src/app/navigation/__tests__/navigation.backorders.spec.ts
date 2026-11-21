// restock-backorder T1 (S1, S2): «Pedidos por reposición» sits under POS right after Cotizaciones,
// gated by read:Backorder; the shell decorates it with the RESERVED count by its path.

import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'
import { buildCanAccess, filterAccessibleGroups } from '../navigation.access'
import { BACKORDERS_PATH } from '@/features/POS/backorders/constants'

const pos = () => navigationGroups.find((group) => group.id === 'pos')!

describe('navigation registry — Pedidos por reposición', () => {
  it('is the POS entry right after Cotizaciones, with read:Backorder', () => {
    const children = pos().children
    const index = children.findIndex((child) => child.id === 'pos-quotations')
    expect(children[index + 1]).toEqual({
      id: 'pos-backorders',
      label: 'Pedidos por reposición',
      icon: 'i-lucide-package-check',
      to: '/pos/pedidos-reposicion',
      permission: ['read', 'Backorder'],
    })
    expect(BACKORDERS_PATH).toBe('/pos/pedidos-reposicion')
  })

  it('shows only with read:Backorder and has no quick action', () => {
    const canReadBackorders = buildCanAccess({
      isSuperAdmin: false,
      userCan: (action, subject) => action === 'read' && subject === 'Backorder',
    })
    const visible = filterAccessibleGroups(navigationGroups, canReadBackorders)
    expect(visible.flatMap((group) => group.children.map((child) => child.id))).toEqual(['pos-backorders'])
    expect(quickActions.some((action) => action.to === BACKORDERS_PATH)).toBe(false)
  })
})
