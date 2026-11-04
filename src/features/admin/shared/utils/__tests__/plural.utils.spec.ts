import { describe, expect, it } from 'vitest'
import { countOf } from '../plural.utils'

describe('countOf', () => {
  it('uses the singular for exactly one', () => {
    expect(countOf(1, 'usuario', 'usuarios')).toBe('1 usuario')
    expect(countOf(1, 'permiso', 'permisos')).toBe('1 permiso')
  })

  it('uses the plural for zero and for many', () => {
    expect(countOf(0, 'usuario', 'usuarios')).toBe('0 usuarios')
    expect(countOf(8, 'permiso', 'permisos')).toBe('8 permisos')
  })

  it('groups thousands', () => {
    expect(countOf(1250, 'permiso', 'permisos')).toBe('1,250 permisos')
  })
})
