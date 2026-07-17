import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function makeAuthStore(overrides: Record<string, unknown> = {}) {
  return {
    isSuperAdmin: false,
    userCan: vi.fn(() => true),
    ...overrides,
  }
}

/** Deny access to a specific subject, allow everything else. */
function makeUserCanExcept(blocked: AppSubject) {
  return vi.fn((_action: AppAction, subject: AppSubject) => subject !== blocked)
}

describe('useDashboard — palette derives from navigation registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('surfaces RR.HH. and Sistema pages when the user has the perms', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore() as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pageItems = dashboard.searchGroups.value.find((g) => g.id === 'pages')?.items ?? []
    const labels = pageItems.map((i) => i.label)

    expect(labels).toContain('RR.HH. / Colaboradores')
    expect(labels).toContain('RR.HH. / Vencimientos')
    expect(labels).toContain('RR.HH. / Aprobaciones')
    expect(labels).toContain('Sistema / Notificaciones')
  })

  it('surfaces the "Nuevo Colaborador" action when the user can create Employees', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore() as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const actionItems = dashboard.searchGroups.value.find((g) => g.id === 'actions')?.items ?? []
    expect(actionItems.some((i) => i.id === 'new-employee' && i.label === 'Nuevo Colaborador')).toBe(
      true,
    )
  })

  it('hides RR.HH./Colaboradores when the user lacks read:Employee', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ userCan: makeUserCanExcept('Employee') }) as unknown as ReturnType<
        typeof useAuthStore
      >,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pageItems = dashboard.searchGroups.value.find((g) => g.id === 'pages')?.items ?? []
    const labels = pageItems.map((i) => i.label)

    expect(labels).not.toContain('RR.HH. / Colaboradores')
    // Sistema is unaffected by the Employee block.
    expect(labels).toContain('Sistema / Notificaciones')

    const actionItems = dashboard.searchGroups.value.find((g) => g.id === 'actions')?.items ?? []
    expect(actionItems.some((i) => i.id === 'new-employee')).toBe(false)
  })

  it('hides Sistema/Notificaciones when the user lacks read:NotificationConfig', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ userCan: makeUserCanExcept('NotificationConfig') }) as unknown as ReturnType<
        typeof useAuthStore
      >,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pageItems = dashboard.searchGroups.value.find((g) => g.id === 'pages')?.items ?? []
    const labels = pageItems.map((i) => i.label)

    expect(labels).not.toContain('Sistema / Notificaciones')
    expect(labels).toContain('RR.HH. / Colaboradores')
  })

  it('keeps the existing "POS / Ventas" and "Admin / Usuarios" palette format', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore() as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pageItems = dashboard.searchGroups.value.find((g) => g.id === 'pages')?.items ?? []
    const labels = pageItems.map((i) => i.label)

    expect(labels[0]).toBe('Home')
    expect(labels).toContain('POS / Ventas')
    expect(labels).toContain('Admin / Usuarios')
  })
})
