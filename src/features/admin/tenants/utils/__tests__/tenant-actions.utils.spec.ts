import { describe, it, expect } from 'vitest'
import { buildTenantRowActions } from '../tenant-actions.utils'

const keys = (options: Parameters<typeof buildTenantRowActions>[0]) =>
  buildTenantRowActions(options).map((action) => action.key)

describe('buildTenantRowActions', () => {
  it('returns no actions (so no ⋮) when the user has no permissions', () => {
    expect(buildTenantRowActions({ canUpdate: false, canDelete: false })).toEqual([])
  })

  it('returns only Editar when the user can update but not delete', () => {
    const result = buildTenantRowActions({ canUpdate: true, canDelete: false })
    expect(result).toEqual([{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }])
  })

  it('returns only the destructive Desactivar… when the user can only delete', () => {
    const result = buildTenantRowActions({ canUpdate: false, canDelete: true })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ key: 'deactivate', label: 'Desactivar…', destructive: true })
  })

  it('names the destructive action "Desactivar…", never "Eliminar"', () => {
    const labels = buildTenantRowActions({ canUpdate: true, canDelete: true }).map((a) => a.label)
    expect(labels).toContain('Desactivar…')
    expect(labels).not.toContain('Eliminar')
  })

  it('includes Gestionar miembros only when the user can manage members', () => {
    expect(keys({ canUpdate: true, canDelete: false, canManageMembers: true })).toContain('members')
    expect(keys({ canUpdate: true, canDelete: false, canManageMembers: false })).not.toContain('members')
    expect(keys({ canUpdate: false, canDelete: false, canManageMembers: true })).toEqual(['members'])
  })

  it('keeps the order Editar, Gestionar miembros, Desactivar… (destructive last)', () => {
    expect(keys({ canUpdate: true, canDelete: true, canManageMembers: true })).toEqual([
      'edit',
      'members',
      'deactivate',
    ])
  })

  it('works the same for any tenant: actions do not depend on the row', () => {
    expect(keys({ canUpdate: true, canDelete: true })).toEqual(['edit', 'deactivate'])
  })
})
