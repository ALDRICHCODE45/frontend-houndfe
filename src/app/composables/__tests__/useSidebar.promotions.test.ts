import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Mock external dependencies before importing composable ────────────────────

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { name: 'Test User' },
    userCan: vi.fn().mockReturnValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@vueuse/core', () => ({
  useColorMode: () => ({ value: 'light' }),
}))

// ── Import REAL useSidebar after mocking dependencies ─────────────────────────

import { useSidebar } from '../useSidebar'

// ── Tests against REAL sidebar composable ────────────────────────────────────

describe('useSidebar — Promociones nav item (real composable)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('getNavigationItems returns items including the POS group', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })

  it('POS section exists with children', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')
    expect(posSection).toBeDefined()
    expect(posSection!.children).toBeDefined()
    expect(posSection!.children!.length).toBeGreaterThan(0)
  })

  it('Promociones nav item exists in POS section', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')
    const promociones = posSection!.children!.find((c) => c.label === 'Promociones')
    expect(promociones).toBeDefined()
  })

  it('Promociones nav item has correct path /pos/promociones', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')
    const promociones = posSection!.children!.find((c) => c.label === 'Promociones')
    expect(promociones!.to).toBe('/pos/promociones')
  })

  it('Promociones nav item uses i-lucide-tag icon', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')
    const promociones = posSection!.children!.find((c) => c.label === 'Promociones')
    expect(promociones!.icon).toBe('i-lucide-tag')
  })

  it('Promociones path is distinct from products path', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')
    const promociones = posSection!.children!.find((c) => c.label === 'Promociones')
    const productos = posSection!.children!.find((c) => c.label === 'Productos')
    expect(promociones!.to).not.toBe(productos!.to)
  })

  it('Promociones path is distinct from customers path', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')
    const promociones = posSection!.children!.find((c) => c.label === 'Promociones')
    const clientes = posSection!.children!.find((c) => c.label === 'Clientes')
    expect(promociones!.to).not.toBe(clientes!.to)
  })
})
