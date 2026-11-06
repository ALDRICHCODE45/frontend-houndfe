// «Envíos» and «Validaciones de zona» sit at the end of the Sistema group
// (ODD shipping-settings T1, S2 «Envíos + Validaciones aparte»).

import { describe, expect, it } from 'vitest'
import {
  navigationGroups,
  quickActions,
  SHIPPING_SETTINGS_PATH,
  ZONE_VALIDATIONS_PATH,
} from '../navigation.registry'
import { buildCanAccess, filterAccessibleGroups } from '../navigation.access'

const sistema = () => navigationGroups.find((group) => group.id === 'sistema')!

function visibleIds(granted: [string, string][]) {
  const canAccess = buildCanAccess({
    isSuperAdmin: false,
    userCan: (action, subject) => granted.some(([a, s]) => a === action && s === subject),
  })
  return filterAccessibleGroups(navigationGroups, canAccess).flatMap((group) =>
    group.children.map((child) => child.id),
  )
}

describe('navigation registry — Envíos and Validaciones de zona', () => {
  it('appends both entries to Sistema with their permissions', () => {
    expect(sistema().children.slice(-2)).toEqual([
      {
        id: 'sistema-shipping',
        label: 'Envíos',
        icon: 'i-lucide-truck',
        to: '/sistema/envios',
        permission: ['read', 'ShippingSettings'],
      },
      {
        id: 'sistema-zone-validations',
        label: 'Validaciones de zona',
        icon: 'i-lucide-map-pin-check',
        to: '/sistema/envios/validaciones',
        permission: ['validate', 'DeliveryZone'],
      },
    ])
    expect(SHIPPING_SETTINGS_PATH).toBe('/sistema/envios')
    expect(ZONE_VALIDATIONS_PATH).toBe('/sistema/envios/validaciones')
  })

  it('shows each entry only with its own permission', () => {
    expect(visibleIds([['read', 'ShippingSettings']])).toEqual(['sistema-shipping'])
    expect(visibleIds([['validate', 'DeliveryZone']])).toEqual(['sistema-zone-validations'])
    expect(visibleIds([['read', 'DeliveryZone'], ['read', 'DeliveryRoute']])).not.toContain(
      'sistema-zone-validations',
    )
    expect(visibleIds([])).toEqual([])
  })

  it('adds no quick action', () => {
    expect(quickActions.some((action) => action.to.startsWith('/sistema/envios'))).toBe(false)
  })
})
