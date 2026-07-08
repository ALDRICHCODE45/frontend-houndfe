// useSidebar.notifications.spec.ts — STRICT-TDD test for the new
// "Notificaciones" sidebar entry under the Sistema group.
//
// Per the design we want a top-level Sistema group (alongside POS/RR.HH./
// Admin) with a single direct child: Notificaciones → /sistema/configuracion/notificaciones.
// No empty General / Seguridad / Integraciones tabs.
//
// Gating contract: visible only when userCan('read', 'NotificationConfig').

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// We use vi.hoisted so the auth-mock factory is available BEFORE the
// module under test is imported. We expose the `userCanReturn` flag so
// individual tests can flip it.
const { setUserCanReturn } = vi.hoisted(() => {
  return {
    setUserCanReturn: (value: boolean) => {
      state.userCanReturn = value
    },
  }
})

const state = { userCanReturn: true as boolean }

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { name: 'Test User' },
    userCan: vi.fn((action: string, subject: string) => {
      if (action === 'read' && subject === 'NotificationConfig') {
        return state.userCanReturn
      }
      return true
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    useColorMode: () => ({ value: 'light' }),
  }
})

import { useSidebar } from '../useSidebar'

describe('useSidebar — Notificaciones nav item', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setUserCanReturn(true)
  })

  it('exposes a Sistema group with a Notificaciones child', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const sistema = items.find((item) => item.label === 'Sistema')
    expect(sistema).toBeDefined()
    const notif = sistema!.children!.find((c) => c.label === 'Notificaciones')
    expect(notif).toBeDefined()
    expect(notif!.to).toBe('/sistema/configuracion/notificaciones')
  })

  it('uses an icon for the Notificaciones entry', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const sistema = items.find((item) => item.label === 'Sistema')
    const notif = sistema!.children!.find((c) => c.label === 'Notificaciones')
    expect(notif!.icon).toBeTruthy()
    expect(typeof notif!.icon).toBe('string')
  })

  it('hides the Sistema group when the user lacks read:NotificationConfig', () => {
    setUserCanReturn(false)
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const sistema = items.find((item) => item.label === 'Sistema')
    expect(sistema).toBeUndefined()
  })
})