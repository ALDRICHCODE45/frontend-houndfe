import { describe, it, expect, vi } from 'vitest'
import {
  buildCanAccess,
  filterAccessibleActions,
  filterAccessibleGroups,
  toPaletteItems,
} from '../navigation.access'
import type { AccessAuthStore, CanAccess } from '../navigation.access'
import type { NavAction, NavGroup } from '../navigation.types'

const groups: NavGroup[] = [
  {
    id: 'pos',
    label: 'POS',
    icon: 'i-lucide-shopping-cart',
    defaultOpen: true,
    children: [
      { id: 'pos-sales', label: 'Ventas', icon: 'i-lucide-shopping-cart', to: '/pos/ventas', permission: ['read', 'Sale'] },
      { id: 'pos-products', label: 'Productos', icon: 'i-lucide-package', to: '/pos/products', permission: ['read', 'Product'] },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'i-lucide-shield-check',
    children: [
      { id: 'admin-tenants', label: 'Sucursales', icon: 'i-lucide-building-2', to: '/admin/tenants', requiresSuperAdmin: true },
    ],
  },
]

const actions: NavAction[] = [
  { id: 'new-product', label: 'Nuevo Producto', icon: 'i-lucide-plus', to: '/pos/products/new', permission: ['create', 'Product'] },
  { id: 'new-employee', label: 'Nuevo Colaborador', icon: 'i-lucide-user-plus', to: '/admin/colaboradores', permission: ['create', 'Employee'] },
]

const allowAll: CanAccess = () => true
const denyAll: CanAccess = () => false

describe('filterAccessibleGroups', () => {
  it('keeps all groups and children when everything is accessible', () => {
    const result = filterAccessibleGroups(groups, allowAll)
    expect(result).toHaveLength(2)
    expect(result[0]!.children).toHaveLength(2)
  })

  it('drops groups whose children are all inaccessible', () => {
    const result = filterAccessibleGroups(groups, denyAll)
    expect(result).toHaveLength(0)
  })

  it('drops only inaccessible children and empty groups', () => {
    // Allow reads but deny super-admin: POS survives, Admin (super-admin only) is dropped.
    const canAccess: CanAccess = (permission, requiresSuperAdmin) => {
      if (requiresSuperAdmin) return false
      return Boolean(permission)
    }
    const result = filterAccessibleGroups(groups, canAccess)
    expect(result.map((g) => g.id)).toEqual(['pos'])
    expect(result[0]!.children.map((c) => c.id)).toEqual(['pos-sales', 'pos-products'])
  })

  it('strips permission/requiresSuperAdmin metadata from returned children', () => {
    const result = filterAccessibleGroups(groups, allowAll)
    const child = result[0]!.children[0]!
    expect('permission' in child).toBe(false)
    expect('requiresSuperAdmin' in child).toBe(false)
    expect(child).toMatchObject({ id: 'pos-sales', label: 'Ventas', to: '/pos/ventas' })
  })

  it('does not mutate the source groups', () => {
    filterAccessibleGroups(groups, denyAll)
    expect(groups[0]!.children).toHaveLength(2)
    expect(groups[0]!.children[0]!.permission).toEqual(['read', 'Sale'])
  })
})

describe('filterAccessibleActions', () => {
  it('keeps accessible actions and strips metadata', () => {
    const result = filterAccessibleActions(actions, allowAll)
    expect(result).toHaveLength(2)
    expect('permission' in result[0]!).toBe(false)
  })

  it('drops inaccessible actions', () => {
    const canAccess: CanAccess = (permission) => permission?.[1] === 'Product'
    const result = filterAccessibleActions(actions, canAccess)
    expect(result.map((a) => a.id)).toEqual(['new-product'])
  })
})

describe('toPaletteItems', () => {
  it('flattens groups into "Group / Child" palette items', () => {
    const result = toPaletteItems(filterAccessibleGroups(groups, allowAll))
    expect(result.map((i) => i.label)).toEqual([
      'POS / Ventas',
      'POS / Productos',
      'Admin / Sucursales',
    ])
  })

  it('preserves child id, icon and to on each palette item', () => {
    const [first] = toPaletteItems(filterAccessibleGroups(groups, allowAll))
    expect(first).toMatchObject({
      id: 'pos-sales',
      label: 'POS / Ventas',
      icon: 'i-lucide-shopping-cart',
      to: '/pos/ventas',
    })
  })
})

describe('buildCanAccess', () => {
  it('denies super-admin-only entries when the store is not a super admin', () => {
    const store: AccessAuthStore = { isSuperAdmin: false, userCan: () => true }
    const canAccess = buildCanAccess(store)
    expect(canAccess(undefined, true)).toBe(false)
  })

  it('allows super-admin-only entries when the store is a super admin', () => {
    const store: AccessAuthStore = { isSuperAdmin: true, userCan: () => true }
    const canAccess = buildCanAccess(store)
    expect(canAccess(undefined, true)).toBe(true)
  })

  it('allows entries without a permission requirement, regardless of userCan', () => {
    const store: AccessAuthStore = { isSuperAdmin: false, userCan: () => false }
    const canAccess = buildCanAccess(store)
    expect(canAccess(undefined, false)).toBe(true)
    expect(canAccess()).toBe(true)
  })

  it('forwards the permission tuple to userCan as (action, subject)', () => {
    const userCan = vi.fn(() => true)
    const store: AccessAuthStore = { isSuperAdmin: false, userCan }
    const canAccess = buildCanAccess(store)

    expect(canAccess(['read', 'Sale'])).toBe(true)
    expect(userCan).toHaveBeenCalledWith('read', 'Sale')
  })

  it('returns the userCan verdict for permissioned entries', () => {
    const store: AccessAuthStore = { isSuperAdmin: false, userCan: () => false }
    const canAccess = buildCanAccess(store)
    expect(canAccess(['read', 'Sale'])).toBe(false)
  })

  it('reads live store state on every call (reactivity-safe, not snapshotted)', () => {
    // A mutable fake standing in for the reactive Pinia store.
    const store = { isSuperAdmin: false, userCan: vi.fn(() => false) }
    const canAccess = buildCanAccess(store)

    // Super-admin gate must reflect a later isSuperAdmin change.
    expect(canAccess(undefined, true)).toBe(false)
    store.isSuperAdmin = true
    expect(canAccess(undefined, true)).toBe(true)

    // Permission check must reflect a later userCan verdict change.
    expect(canAccess(['read', 'Sale'])).toBe(false)
    store.userCan.mockReturnValue(true)
    expect(canAccess(['read', 'Sale'])).toBe(true)
  })
})
