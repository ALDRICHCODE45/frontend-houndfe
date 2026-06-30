/**
 * Unit tests for employeeBadgeConfig.utils.
 *
 * Coverage:
 *  - getDepartmentDotClass: all 9 keyword keys + fallback + null/undefined
 *  - employeeStatusConfig: tone + label for every EmployeeStatus
 *  - employeeStatusToBadgeTone: pure tone lookup (re-export contract)
 *
 * Locked behavior: the keyword order, the tone->label mapping and the
 * fallback class are all part of the visual contract — any change here is
 * a deliberate visual decision, not a refactor.
 */

import { describe, expect, it } from 'vitest'
import {
  employeeStatusConfig,
  employeeStatusToBadgeTone,
  getDepartmentDotClass,
} from '../employeeBadgeConfig.utils'

describe('getDepartmentDotClass — department keyword → dot color', () => {
  it('maps "Producto" to bg-violet-500', () => {
    expect(getDepartmentDotClass('Producto')).toBe('bg-violet-500')
  })

  it('maps "Diseño" (with diacritic) to bg-pink-500', () => {
    expect(getDepartmentDotClass('Diseño')).toBe('bg-pink-500')
  })

  it('maps "Finanzas" to bg-blue-500', () => {
    expect(getDepartmentDotClass('Finanzas')).toBe('bg-blue-500')
  })

  it('maps "Recursos Humanos" to bg-cyan-500 (recursos is specific, must win before fallback)', () => {
    expect(getDepartmentDotClass('Recursos Humanos')).toBe('bg-cyan-500')
  })

  it('maps "Operaciones" to bg-amber-500', () => {
    expect(getDepartmentDotClass('Operaciones')).toBe('bg-amber-500')
  })

  it('maps "Legal" to bg-slate-500', () => {
    expect(getDepartmentDotClass('Legal')).toBe('bg-slate-500')
  })

  it('maps "Almacén" (almac prefix) to bg-orange-500', () => {
    expect(getDepartmentDotClass('Almacén')).toBe('bg-orange-500')
  })

  it('maps "Ingeniería" (ingen) to bg-indigo-500', () => {
    expect(getDepartmentDotClass('Ingeniería')).toBe('bg-indigo-500')
  })

  it('maps "Tecnología" (tecnolog) to bg-indigo-500', () => {
    expect(getDepartmentDotClass('Tecnología')).toBe('bg-indigo-500')
  })

  it('maps "Tienda" to bg-emerald-500', () => {
    expect(getDepartmentDotClass('Tienda')).toBe('bg-emerald-500')
  })

  it('returns the emerald fallback for unknown departments', () => {
    expect(getDepartmentDotClass('Departamento Desconocido')).toBe('bg-emerald-500')
  })

  it('returns the emerald fallback for empty string', () => {
    expect(getDepartmentDotClass('')).toBe('bg-emerald-500')
  })

  it('returns the emerald fallback for null', () => {
    expect(getDepartmentDotClass(null)).toBe('bg-emerald-500')
  })

  it('returns the emerald fallback for undefined', () => {
    expect(getDepartmentDotClass(undefined)).toBe('bg-emerald-500')
  })

  it('matching is case-insensitive (lowercases input)', () => {
    expect(getDepartmentDotClass('PRODUCTO')).toBe('bg-violet-500')
    expect(getDepartmentDotClass('diseño')).toBe('bg-pink-500')
  })

  it('earlier keyword wins when two keywords co-occur (order precedence is locked)', () => {
    // "producto" is declared before "tecnolog", so a string containing both
    // must resolve to violet, not indigo. Pins the declaration order against
    // accidental reordering.
    expect(getDepartmentDotClass('Tecnología de Producto')).toBe('bg-violet-500')
  })
})

describe('employeeStatusConfig — single source of truth for status badge', () => {
  it('ACTIVE maps to success tone + "Activo" label', () => {
    expect(employeeStatusConfig.ACTIVE).toEqual({ tone: 'success', label: 'Activo' })
  })

  it('ON_LEAVE maps to warning tone + "Licencia" label', () => {
    expect(employeeStatusConfig.ON_LEAVE).toEqual({ tone: 'warning', label: 'Licencia' })
  })

  it('TERMINATED maps to error tone + "Baja" label', () => {
    expect(employeeStatusConfig.TERMINATED).toEqual({ tone: 'error', label: 'Baja' })
  })
})

describe('employeeStatusToBadgeTone — pure tone lookup (re-export contract)', () => {
  it('maps ACTIVE to success', () => {
    expect(employeeStatusToBadgeTone('ACTIVE')).toBe('success')
  })

  it('maps ON_LEAVE to warning', () => {
    expect(employeeStatusToBadgeTone('ON_LEAVE')).toBe('warning')
  })

  it('maps TERMINATED to error', () => {
    expect(employeeStatusToBadgeTone('TERMINATED')).toBe('error')
  })
})
