import { describe, expect, it } from 'vitest'
import {
  HIDDEN_SUBJECTS,
  getSubjectLabel,
  getPermissionLabel,
  getPermissionDescription,
  isSubjectHidden,
} from '../permissions'

describe('permissions i18n', () => {
  describe('HIDDEN_SUBJECTS', () => {
    it('includes "all" (super-admin wildcard, not meant for role composition)', () => {
      expect(HIDDEN_SUBJECTS).toContain('all')
    })

    it('includes "Order" (deprecated per backend RBAC audit)', () => {
      expect(HIDDEN_SUBJECTS).toContain('Order')
    })

    it('does not hide Tenant (valid permission to assign with care)', () => {
      expect(HIDDEN_SUBJECTS).not.toContain('Tenant')
    })

    it('does not hide TenantMembership', () => {
      expect(HIDDEN_SUBJECTS).not.toContain('TenantMembership')
    })
  })

  describe('isSubjectHidden', () => {
    it('returns true for hidden subjects (case-sensitive match to backend)', () => {
      expect(isSubjectHidden('all')).toBe(true)
      expect(isSubjectHidden('Order')).toBe(true)
    })

    it('returns false for visible subjects', () => {
      expect(isSubjectHidden('Tenant')).toBe(false)
      expect(isSubjectHidden('TenantMembership')).toBe(false)
      expect(isSubjectHidden('User')).toBe(false)
      expect(isSubjectHidden('Sale')).toBe(false)
    })
  })

  describe('getSubjectLabel', () => {
    it('returns the human label for a known subject', () => {
      expect(getSubjectLabel('TenantMembership')).toBe('Miembros de la sucursal')
      expect(getSubjectLabel('User')).toBe('Usuarios')
      expect(getSubjectLabel('Tenant')).toBe('Sucursales')
      expect(getSubjectLabel('Brand')).toBe('Marcas')
      expect(getSubjectLabel('Category')).toBe('Categorías')
      expect(getSubjectLabel('Product')).toBe('Productos')
      expect(getSubjectLabel('Sale')).toBe('Ventas')
      expect(getSubjectLabel('SaleComment')).toBe('Comentarios de ventas')
      expect(getSubjectLabel('Customer')).toBe('Clientes')
      expect(getSubjectLabel('Promotion')).toBe('Promociones')
      expect(getSubjectLabel('File')).toBe('Archivos')
      expect(getSubjectLabel('GlobalPriceList')).toBe('Listas de precios globales')
      expect(getSubjectLabel('Role')).toBe('Roles')
    })

    it('falls back to the raw subject string for unknown subjects', () => {
      expect(getSubjectLabel('UnknownThing')).toBe('UnknownThing')
    })
  })

  describe('getPermissionLabel', () => {
    it('returns the human label for known (subject, action) pairs', () => {
      expect(getPermissionLabel('TenantMembership', 'create')).toBe('Agregar miembros a la sucursal')
      expect(getPermissionLabel('TenantMembership', 'read')).toBe('Ver miembros de la sucursal')
      expect(getPermissionLabel('TenantMembership', 'update')).toBe('Cambiar rol de miembros')
      expect(getPermissionLabel('TenantMembership', 'delete')).toBe('Quitar miembros de la sucursal')

      expect(getPermissionLabel('User', 'create')).toBe('Crear usuarios nuevos')
      expect(getPermissionLabel('User', 'read')).toBe('Ver listado de usuarios')
      expect(getPermissionLabel('User', 'update')).toBe('Editar usuarios')
      expect(getPermissionLabel('User', 'delete')).toBe('Desactivar usuarios')
    })

    it('falls back to a sensible default for unknown (subject, action) pairs', () => {
      const result = getPermissionLabel('UnknownSubject', 'create')
      // Just verify it returns SOMETHING readable — not undefined or empty
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('handles the "manage" action distinctly from CRUD', () => {
      // manage:Subject is a wildcard that implies create+read+update+delete
      // It should have a label that conveys "full control"
      const result = getPermissionLabel('Brand', 'manage')
      expect(result.toLowerCase()).toMatch(/gestión|completo|total|todo/)
    })
  })

  describe('getPermissionDescription', () => {
    it('returns a 1-liner description for known (subject, action) pairs', () => {
      const desc = getPermissionDescription('TenantMembership', 'create')
      expect(desc).toBeTruthy()
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThan(20)
    })

    it('returns empty string for unknown pairs (caller can hide)', () => {
      expect(getPermissionDescription('UnknownSubject', 'whatever')).toBe('')
    })
  })
})
