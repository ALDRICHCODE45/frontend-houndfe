import { describe, expect, it } from 'vitest'
import { buildMembershipRowActions } from '../membership-actions.utils'

describe('buildMembershipRowActions', () => {
  it('returns no actions when update and delete are denied', () => {
    expect(buildMembershipRowActions({ canUpdate: false, canDelete: false })).toEqual([])
  })

  it('shows no ⋮ when the only item would duplicate the row click (update only)', () => {
    expect(buildMembershipRowActions({ canUpdate: true, canDelete: false })).toEqual([])
  })

  it('exposes only the destructive "Eliminar miembro…" when update is denied', () => {
    const result = buildMembershipRowActions({ canUpdate: false, canDelete: true })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ key: 'remove', label: 'Eliminar miembro…', destructive: true })
  })

  it('lists Editar rol first and Eliminar miembro… last when both are allowed', () => {
    const result = buildMembershipRowActions({ canUpdate: true, canDelete: true })
    expect(result.map((action) => action.label)).toEqual(['Editar rol', 'Eliminar miembro…'])
    expect(result[1]!.destructive).toBe(true)
  })
})
