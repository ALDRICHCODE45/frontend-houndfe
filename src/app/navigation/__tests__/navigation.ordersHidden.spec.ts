import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'

// Orders is paused: the /pos/orders route stays registered, but no navigation
// surface (sidebar, command palette, quick actions) links to it.
describe('orders navigation (paused)', () => {
  it('has no sidebar entry pointing at /pos/orders', () => {
    const targets = navigationGroups.flatMap((group) => group.children.map((child) => child.to))

    expect(targets.some((to) => to.startsWith('/pos/orders'))).toBe(false)
  })

  it('has no quick action pointing at /pos/orders', () => {
    expect(quickActions.some((action) => action.to.startsWith('/pos/orders'))).toBe(false)
  })

  it('keeps the neighbouring POS entries in order', () => {
    const pos = navigationGroups.find((group) => group.id === 'pos')

    expect(pos?.children.slice(0, 3).map((child) => child.id)).toEqual([
      'pos-sales',
      'pos-products',
      'pos-customers',
    ])
  })
})
