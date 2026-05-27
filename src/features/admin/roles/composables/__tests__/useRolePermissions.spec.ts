import { describe, expect, it } from 'vitest'
import { useRolePermissions } from '../useRolePermissions'
import type { GroupedPermissions } from '../../interfaces/role.types'

function makeGrouped(): GroupedPermissions {
  return {
    all: [{ id: 'all-manage', action: 'manage', description: 'Full system access' }],
    Order: [
      { id: 'order-read', action: 'read', description: 'View orders' },
      { id: 'order-create', action: 'create', description: 'Create orders' },
    ],
    Brand: [
      { id: 'brand-create', action: 'create', description: 'Create new brands' },
      { id: 'brand-read', action: 'read', description: 'View brands' },
      { id: 'brand-update', action: 'update', description: 'Update brands' },
      { id: 'brand-delete', action: 'delete', description: 'Delete brands' },
      { id: 'brand-manage', action: 'manage', description: 'Full brand management' },
    ],
    TenantMembership: [
      { id: 'tm-create', action: 'create', description: 'Add tenant members' },
      { id: 'tm-read', action: 'read', description: 'View tenant members' },
    ],
    User: [
      { id: 'user-create', action: 'create', description: 'Create users' },
      { id: 'user-delete', action: 'delete', description: 'Delete users' },
    ],
  }
}

describe('useRolePermissions — subject filtering', () => {
  it('filters out HIDDEN_SUBJECTS (all, Order) from filteredSubjects', () => {
    const grouped = makeGrouped()
    const { filteredSubjects } = useRolePermissions(() => grouped)

    const subjectKeys = filteredSubjects.value.map(([subject]) => subject)
    expect(subjectKeys).not.toContain('all')
    expect(subjectKeys).not.toContain('Order')
    expect(subjectKeys).toContain('Brand')
    expect(subjectKeys).toContain('TenantMembership')
    expect(subjectKeys).toContain('User')
  })

  it('excludes hidden subjects from totalPermissions count', () => {
    const grouped = makeGrouped()
    const { totalPermissions } = useRolePermissions(() => grouped)

    // 5 Brand + 2 TenantMembership + 2 User = 9 (excludes 1 all + 2 Order = 3 hidden)
    expect(totalPermissions.value).toBe(9)
  })

  it('does not allow selectAll to pick up hidden subjects', () => {
    const grouped = makeGrouped()
    const { selectAll, selectedPermissionIds } = useRolePermissions(() => grouped)

    selectAll()

    const ids = Array.from(selectedPermissionIds.value)
    expect(ids).not.toContain('all-manage')
    expect(ids).not.toContain('order-read')
    expect(ids).not.toContain('order-create')
    expect(ids).toContain('brand-create')
    expect(ids).toContain('tm-create')
    expect(ids).toContain('user-create')
  })
})

describe('useRolePermissions — humanized search', () => {
  it('matches by human label (Spanish)', () => {
    const grouped = makeGrouped()
    const { search, filteredSubjects } = useRolePermissions(() => grouped)

    // Search for "miembros" should match TenantMembership permissions
    search.value = 'miembros'
    const subjectKeys = filteredSubjects.value.map(([subject]) => subject)
    expect(subjectKeys).toContain('TenantMembership')
  })

  it('matches by human description (Spanish)', () => {
    const grouped = makeGrouped()
    const { search, filteredSubjects } = useRolePermissions(() => grouped)

    // Search for "sucursal" should match TenantMembership (descriptions
    // mention "sucursal" extensively)
    search.value = 'sucursal'
    const subjectKeys = filteredSubjects.value.map(([subject]) => subject)
    expect(subjectKeys).toContain('TenantMembership')
  })

  it('keeps matching by technical code for backward compatibility / support', () => {
    const grouped = makeGrouped()
    const { search, filteredSubjects } = useRolePermissions(() => grouped)

    // Searching for the raw technical code should still work
    search.value = 'brand:create'
    const entries = filteredSubjects.value
    expect(entries.length).toBeGreaterThan(0)
    const brandEntry = entries.find(([subject]) => subject === 'Brand')
    expect(brandEntry).toBeDefined()
    expect(brandEntry?.[1].some((p) => p.action === 'create')).toBe(true)
  })

  it('does not surface hidden subjects through search', () => {
    const grouped = makeGrouped()
    const { search, filteredSubjects } = useRolePermissions(() => grouped)

    // Even if user searches for "all" or "order", hidden subjects must not appear
    search.value = 'all'
    expect(filteredSubjects.value.map(([s]) => s)).not.toContain('all')

    search.value = 'order'
    expect(filteredSubjects.value.map(([s]) => s)).not.toContain('Order')
  })
})
