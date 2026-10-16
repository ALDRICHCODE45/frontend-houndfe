// useSidebar.tenantSwitcher.spec.ts — the branch switcher menu, its keyboard
// shortcuts and the account menu.
//
// Product decisions (feat/shell-chrome-polish):
//   - The menu used to advertise `CTRL 1/2/3`, but no shortcut was ever
//     registered. Ctrl/Cmd+digit is reserved by browsers for tab switching and
//     cannot reach the page, so the real shortcut is the chained `S` then the
//     list number, and the menu shows exactly that.
//   - The account menu is Mexican Spanish and lists only working actions; the
//     inert "Profile" and "Settings" entries are gone.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { TenantSummary } from '@/features/auth/interfaces/auth.types'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.stubGlobal(
  'useToast',
  vi.fn(() => ({ add: vi.fn() })),
)

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return { ...actual, useColorMode: () => ({ value: 'light' }) }
})

const tenants: TenantSummary[] = [
  { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' },
  { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
  { id: 'tenant-3', name: 'Sucursal Sur', slug: 'sur' },
]

function mockStore(overrides: Record<string, unknown> = {}) {
  const store = {
    memberships: tenants,
    currentTenant: tenants[0],
    isSuperAdmin: false,
    switchTenant: vi.fn().mockResolvedValue(undefined),
    userCan: vi.fn(() => true),
    user: { name: 'Test User' },
    logout: vi.fn(),
    ...overrides,
  }
  vi.mocked(useAuthStore).mockReturnValue(store as unknown as ReturnType<typeof useAuthStore>)
  return store
}

async function sidebar() {
  const { useSidebar } = await import('../useSidebar')
  return useSidebar()
}

/** The selectable rows, without the menu's heading label. */
function tenantRows(groups: DropdownMenuItem[][]): DropdownMenuItem[] {
  return groups.flat().filter((item) => item.type !== 'label')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSidebar — branch switcher menu', () => {
  it('heads the menu with a label and lists each branch with its slug', async () => {
    mockStore()
    const { teamsItems } = await sidebar()

    expect(teamsItems.value.flat()[0]).toMatchObject({ type: 'label', label: 'Cambiar sucursal' })
    expect(tenantRows(teamsItems.value).map((item) => [item.label, item.description])).toEqual([
      ['Sucursal Centro', 'centro'],
      ['Sucursal Norte', 'norte'],
      ['Sucursal Sur', 'sur'],
    ])
  })

  it('marks only the current branch as checked and keeps every initial', async () => {
    mockStore({ currentTenant: tenants[1] })
    const rows = tenantRows((await sidebar()).teamsItems.value)

    expect(rows.map((item) => [item.type, item.checked])).toEqual([
      ['checkbox', false],
      ['checkbox', true],
      ['checkbox', false],
    ])
    // The current row keeps its initial: selection is shown by the check, it
    // no longer replaces the avatar with a check icon.
    expect(rows.map((item) => item.icon)).toEqual([undefined, undefined, undefined])
    expect(rows.map((item) => (item.avatar as { text?: string }).text)).toEqual(['S', 'S', 'S'])
  })

  it('advertises the chained S + number shortcut, never Ctrl/Cmd', async () => {
    mockStore()
    const rows = tenantRows((await sidebar()).teamsItems.value)

    expect(rows.map((item) => item.kbds)).toEqual([
      ['s', '1'],
      ['s', '2'],
      ['s', '3'],
    ])
    expect(JSON.stringify(rows)).not.toMatch(/meta|ctrl/i)
  })

  it('offers no shortcut past the ninth branch, where no single digit is left', async () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `tenant-${index + 1}`,
      name: `Sucursal ${index + 1}`,
      slug: `s${index + 1}`,
    }))
    mockStore({ memberships: many, currentTenant: many[0] })
    const { teamsItems, tenantShortcuts } = await sidebar()

    expect(tenantRows(teamsItems.value)[8]!.kbds).toEqual(['s', '9'])
    expect(tenantRows(teamsItems.value)[9]!.kbds).toBeUndefined()
    expect(Object.keys(tenantShortcuts.value)).toEqual(
      Array.from({ length: 9 }, (_, index) => `s-${index + 1}`),
    )
  })

  it('lists the global scope first for a super-admin, without a shortcut', async () => {
    mockStore({ isSuperAdmin: true, currentTenant: null })
    const { teamsItems, tenantShortcuts } = await sidebar()
    const [global, first] = tenantRows(teamsItems.value)

    expect(global).toMatchObject({ label: '(Global)', type: 'checkbox', checked: true })
    expect(global!.kbds).toBeUndefined()
    expect(first).toMatchObject({ label: 'Sucursal Centro', checked: false, kbds: ['s', '1'] })
    expect(Object.keys(tenantShortcuts.value)).toEqual(['s-1', 's-2', 's-3'])
  })
})

describe('useSidebar — branch shortcuts', () => {
  it('switches to the branch at that list position', async () => {
    const store = mockStore()
    const { tenantShortcuts } = await sidebar()

    tenantShortcuts.value['s-2']!()
    tenantShortcuts.value['s-3']!()

    expect(store.switchTenant.mock.calls).toEqual([['tenant-2'], ['tenant-3']])
  })

  it('runs the same switch as selecting that row in the menu', async () => {
    const store = mockStore()
    const { teamsItems } = await sidebar()

    tenantRows(teamsItems.value)[1]!.onSelect!(new Event('select'))

    expect(store.switchTenant).toHaveBeenCalledExactlyOnceWith('tenant-2')
  })

  it('offers no shortcut when there is no switcher to switch with', async () => {
    mockStore({ memberships: [tenants[0]] })
    const { showTenantSwitcher, tenantShortcuts } = await sidebar()

    expect(showTenantSwitcher.value).toBe(false)
    expect(tenantShortcuts.value).toEqual({})
  })
})

describe('useSidebar — account menu', () => {
  it('is in Mexican Spanish and lists only working actions', async () => {
    mockStore()
    const { userItems } = await sidebar()
    const top = userItems.value.flat()

    expect(top.map((item) => item.label)).toEqual(['Apariencia', 'Cerrar sesión'])
    const appearance = (top[0]!.children ?? []).flat() as DropdownMenuItem[]
    expect(appearance.map((item) => item.label)).toEqual(['Claro', 'Oscuro'])
    expect(JSON.stringify(userItems.value)).not.toMatch(
      /Profile|Settings|Appearance|Light|Dark|Log out/,
    )
  })

  it('still logs out from the account menu', async () => {
    const store = mockStore()
    const { userItems } = await sidebar()
    const logout = userItems.value.flat().find((item) => item.label === 'Cerrar sesión')!

    await logout.onSelect!(new Event('select'))

    expect(store.logout).toHaveBeenCalledOnce()
  })
})
