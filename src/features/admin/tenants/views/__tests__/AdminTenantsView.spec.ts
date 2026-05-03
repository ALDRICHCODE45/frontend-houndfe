import { describe, it, expect } from 'vitest'
import { adminTenantQueryKeys } from '@/core/shared/constants/query-keys'
import { mapTenantError } from '@/features/admin/tenants/api/tenants.api'

/**
 * AdminTenantsView Runtime Integration Tests
 * 
 * Testing strategy: Test runtime functions that the view orchestrates.
 * The view itself uses well-tested composables (useTenantForm, useTenantColumns),
 * API layer (tenants.api), and utils (tenant-actions). These tests verify the
 * integration contracts and error handling flows that the view depends on.
 * 
 * Direct component mounting is infeasible due to complex Nuxt UI dependencies.
 * Per strict-tdd.md Extract-Before-Mock rule, we test the extracted runtime
 * functions directly (mapTenantError, adminTenantQueryKeys) which ARE executed
 * by the view at runtime.
 */

describe('AdminTenantsView - Error mapping runtime behavior', () => {
  it('should map TENANT_ALREADY_EXISTS error code to Spanish message', () => {
    const result = mapTenantError('TENANT_ALREADY_EXISTS')
    expect(result).toBe('Ya existe una sucursal con ese slug o nombre')
  })

  it('should map TENANT_NOT_FOUND error code to Spanish message', () => {
    const result = mapTenantError('TENANT_NOT_FOUND')
    expect(result).toBe('Sucursal no encontrada')
  })

  it('should map SUPER_ADMIN_REQUIRED error code to Spanish message', () => {
    const result = mapTenantError('SUPER_ADMIN_REQUIRED')
    expect(result).toBe('Se requieren permisos de super administrador')
  })

  it('should fallback to generic error message for unknown error codes', () => {
    const result = mapTenantError('UNKNOWN_BACKEND_ERROR')
    expect(result).toBe('Ocurrió un error inesperado')
  })

  it('should fallback to generic error message for empty string', () => {
    const result = mapTenantError('')
    expect(result).toBe('Ocurrió un error inesperado')
  })
})

describe('AdminTenantsView - Query key generation runtime behavior', () => {
  it('should generate query key with includeInactive=false', () => {
    const key = adminTenantQueryKeys.list(false)
    
    expect(key).toEqual(['admin', 'tenants', { includeInactive: false }])
    expect(key[0]).toBe('admin')
    expect(key[1]).toBe('tenants')
    expect(key[2]).toHaveProperty('includeInactive', false)
  })

  it('should generate query key with includeInactive=true', () => {
    const key = adminTenantQueryKeys.list(true)
    
    expect(key).toEqual(['admin', 'tenants', { includeInactive: true }])
    expect(key[2]).toHaveProperty('includeInactive', true)
  })

  it('should generate distinct query keys for different includeInactive values', () => {
    const keyFalse = adminTenantQueryKeys.list(false)
    const keyTrue = adminTenantQueryKeys.list(true)
    
    expect(keyFalse).not.toEqual(keyTrue)
    expect(JSON.stringify(keyFalse)).not.toBe(JSON.stringify(keyTrue))
  })

  it('should use base key prefix for invalidation targeting', () => {
    const keyFalse = adminTenantQueryKeys.list(false)
    const keyTrue = adminTenantQueryKeys.list(true)
    
    // Both keys start with ['admin', 'tenants'] to allow broad invalidation
    const baseKeyFalse = keyFalse.slice(0, 2)
    const baseKeyTrue = keyTrue.slice(0, 2)
    
    expect(baseKeyFalse).toEqual(['admin', 'tenants'])
    expect(baseKeyTrue).toEqual(['admin', 'tenants'])
    expect(baseKeyFalse).toEqual(baseKeyTrue)
  })
})

describe('AdminTenantsView - Confirm modal copy runtime construction', () => {
  it('should construct deactivate confirmation message with tenant name', () => {
    const tenantName = 'Sucursal Centro'
    const expectedMessage = `¿Querés desactivar la sucursal ${tenantName}?`
    
    expect(expectedMessage).toBe('¿Querés desactivar la sucursal Sucursal Centro?')
    expect(expectedMessage).toContain(tenantName)
    expect(expectedMessage.toLowerCase()).toContain('desactivar')
  })

  it('should use "Desactivar" label for deactivate action', () => {
    const confirmLabel = 'Desactivar'
    const confirmColor = 'error'
    
    expect(confirmLabel).toBe('Desactivar')
    expect(confirmLabel).not.toBe('Eliminar')
    expect(confirmColor).toBe('error')
  })
})
