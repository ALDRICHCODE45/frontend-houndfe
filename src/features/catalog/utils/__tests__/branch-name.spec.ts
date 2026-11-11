import { describe, expect, it } from 'vitest'
import { shortBranchName } from '../branch-name'

describe('shortBranchName', () => {
  it('drops a leading «Sucursal» because the control already says it', () => {
    expect(shortBranchName('Sucursal Centro')).toBe('Centro')
    expect(shortBranchName('  sucursal   Norte ')).toBe('Norte')
  })

  it('keeps names that only contain the word elsewhere or are the word itself', () => {
    expect(shortBranchName('Centro Sucursal')).toBe('Centro Sucursal')
    expect(shortBranchName('Sucursal')).toBe('Sucursal')
    expect(shortBranchName('Sucursales Unidas')).toBe('Sucursales Unidas')
  })

  it('returns the trimmed name otherwise', () => {
    expect(shortBranchName(' Centro ')).toBe('Centro')
  })
})
