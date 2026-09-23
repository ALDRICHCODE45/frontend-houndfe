import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const DASHBOARD_PATH = '/dashboard'

function makeAuthStore(overrides: Record<string, unknown> = {}) {
  return {
    isSuperAdmin: false,
    userCan: vi.fn(() => true),
    ...overrides,
  }
}

/** Allow everything except a specific subject. */
function makeUserCanExcept(blocked: AppSubject) {
  return vi.fn((_action: AppAction, subject: AppSubject) => subject !== blocked)
}

/** Allow only a single (action, subject) tuple; deny everything else. */
function makeUserCanOnly(allowed: [AppAction, AppSubject]) {
  return vi.fn(
    (action: AppAction, subject: AppSubject) => allowed[0] === action && allowed[1] === subject,
  )
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
    expect(labels).toContain('RR.HH. / Validaciones pendientes')
    expect(labels).toContain('Sistema / Notificaciones')
  })

  it('surfaces the "Nuevo Colaborador" action when the user can create Employees', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore() as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const actionItems = dashboard.searchGroups.value.find((g) => g.id === 'actions')?.items ?? []
    expect(
      actionItems.some((i) => i.id === 'new-employee' && i.label === 'Nuevo Colaborador'),
    ).toBe(true)
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

  it('keeps the existing POS and Admin palette labels', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore() as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()
    const labels = (
      dashboard.searchGroups.value.find((group) => group.id === 'pages')?.items ?? []
    ).map((item) => item.label)

    expect(labels).toContain('POS / Ventas')
    expect(labels).toContain('Admin / Usuarios')
  })
})

describe('useDashboard — Dashboard page visibility (ODD dashboard-analytics D1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('surfaces Dashboard as the first pages-group entry when read:Analytics is granted', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ userCan: makeUserCanOnly(['read', 'Analytics']) }) as unknown as ReturnType<
        typeof useAuthStore
      >,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pageItems = dashboard.searchGroups.value.find((g) => g.id === 'pages')?.items ?? []
    expect(pageItems[0]).toMatchObject({ id: 'dashboard', label: 'Dashboard', to: DASHBOARD_PATH })
    expect(pageItems[0]?.to).toBe(DASHBOARD_PATH)
  })

  it.each([
    { label: 'unrelated grants (read:Sale only)', userCan: makeUserCanOnly(['read', 'Sale']) },
    { label: 'denied (no permissions)', userCan: vi.fn(() => false) },
  ])('hides the Dashboard entry when $label', async ({ userCan }) => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ userCan }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pageItems = dashboard.searchGroups.value.find((g) => g.id === 'pages')?.items ?? []
    expect(pageItems.some((i) => i.to === DASHBOARD_PATH)).toBe(false)
  })
})
