import { describe, it, expect, vi } from 'vitest'
import { buildTenantRowActions } from '../tenant-actions.utils'
import type { TenantTableRow } from '../../interfaces/tenant.types'

/**
 * Behavioral tests for tenant row action builder
 * Extracts and tests the pure logic from AdminTenantsView.getRowItems
 */

describe('buildTenantRowActions - behavioral tests', () => {
  const mockTenant: TenantTableRow = {
    id: 'tenant-123',
    name: 'Sucursal Centro',
    slug: 'sucursal-centro',
    address: 'Av. Principal 123',
    phone: '555-1234',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  }

  it('returns empty array when user has no permissions', () => {
    const result = buildTenantRowActions(mockTenant, {
      canUpdate: false,
      canDelete: false,
      onEdit: vi.fn(),
      onDeactivate: vi.fn(),
    })

    expect(result).toEqual([])
  })

  it('returns only Edit action when user can update but not delete', () => {
    const onEdit = vi.fn()
    const result = buildTenantRowActions(mockTenant, {
      canUpdate: true,
      canDelete: false,
      onEdit,
      onDeactivate: vi.fn(),
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(1)
    expect(result[0]![0]!.label).toBe('Editar')
    expect(result[0]![0]!.color).toBeUndefined()
  })

  it('calls onEdit callback when Edit action is triggered', () => {
    const onEdit = vi.fn()
    const result = buildTenantRowActions(mockTenant, {
      canUpdate: true,
      canDelete: false,
      onEdit,
      onDeactivate: vi.fn(),
    })

    result[0]![0]!.onSelect()
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onEdit).toHaveBeenCalledWith(mockTenant)
  })

  it('returns only Desactivar action when user can delete but not update', () => {
    const onDeactivate = vi.fn()
    const result = buildTenantRowActions(mockTenant, {
      canUpdate: false,
      canDelete: true,
      onEdit: vi.fn(),
      onDeactivate,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(1)
    expect(result[0]![0]!.label).toBe('Desactivar')
    expect(result[0]![0]!.color).toBe('error')
  })

  it('calls onDeactivate callback when Desactivar action is triggered', () => {
    const onDeactivate = vi.fn()
    const result = buildTenantRowActions(mockTenant, {
      canUpdate: false,
      canDelete: true,
      onEdit: vi.fn(),
      onDeactivate,
    })

    result[0]![0]!.onSelect()
    expect(onDeactivate).toHaveBeenCalledOnce()
    expect(onDeactivate).toHaveBeenCalledWith(mockTenant)
  })

  it('returns two action sections when user can both update and delete', () => {
    const result = buildTenantRowActions(mockTenant, {
      canUpdate: true,
      canDelete: true,
      onEdit: vi.fn(),
      onDeactivate: vi.fn(),
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveLength(1) // main actions section
    expect(result[1]).toHaveLength(1) // destructive actions section
    expect(result[0]![0]!.label).toBe('Editar')
    expect(result[1]![0]!.label).toBe('Desactivar')
  })

  it('uses "Desactivar" label (not "Eliminar") for destructive action', () => {
    const result = buildTenantRowActions(mockTenant, {
      canUpdate: false,
      canDelete: true,
      onEdit: vi.fn(),
      onDeactivate: vi.fn(),
    })

    const destructiveAction = result[0]![0]!
    expect(destructiveAction.label).toBe('Desactivar')
    expect(destructiveAction.label).not.toBe('Eliminar')
  })

  it('works correctly with inactive tenant (no special logic)', () => {
    const inactiveTenant: TenantTableRow = {
      ...mockTenant,
      isActive: false,
    }

    const result = buildTenantRowActions(inactiveTenant, {
      canUpdate: true,
      canDelete: true,
      onEdit: vi.fn(),
      onDeactivate: vi.fn(),
    })

    // Action builder does not change behavior based on isActive
    expect(result).toHaveLength(2)
    expect(result[1]![0]!.label).toBe('Desactivar')
  })
})
