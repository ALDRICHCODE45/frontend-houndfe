import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { useInventoryAccess, useInventoryContext } from '../useInventoryAccess'

const auth = reactive({
  granted: new Set<string>(), user: { id: 'user-1' } as { id: string } | null, currentTenantId: 'branch-1',
  authPhase: 'authenticated', permissionsLoaded: true,
  userCan(action: AppAction, subject: AppSubject) { return this.granted.has(`${action}:${subject}`) },
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

beforeEach(() => {
  auth.granted = new Set()
  auth.user = { id: 'user-1' }
  auth.currentTenantId = 'branch-1'
  auth.authPhase = 'authenticated'
  auth.permissionsLoaded = true
})

describe('useInventoryAccess', () => {
  it('denies everything to a user with no inventory grants (cashier)', () => {
    auth.granted = new Set(['create:Sale', 'read:Product'])
    const { canRead, canAdjust } = useInventoryAccess()
    expect(canRead.value).toBe(false)
    expect(canAdjust.value).toBe(false)
  })

  it('lets read:InventoryJournal see the stock but not adjust it', () => {
    auth.granted = new Set(['read:InventoryJournal'])
    const { canRead, canAdjust } = useInventoryAccess()
    expect(canRead.value).toBe(true)
    expect(canAdjust.value).toBe(false)
  })

  it('does not let create:InventoryAdjustment adjust without the read grant', () => {
    auth.granted = new Set(['create:InventoryAdjustment'])
    const { canRead, canAdjust } = useInventoryAccess()
    expect(canRead.value).toBe(false)
    expect(canAdjust.value).toBe(false)
  })

  it('adjusts only with both grants and follows grant changes', () => {
    auth.granted = new Set(['read:InventoryJournal', 'create:InventoryAdjustment'])
    const { canRead, canAdjust } = useInventoryAccess()
    expect(canRead.value && canAdjust.value).toBe(true)
    auth.granted = new Set(['create:InventoryAdjustment'])
    expect(canAdjust.value).toBe(false)
  })

  it('stays closed until the session and its permissions are loaded', () => {
    auth.granted = new Set(['read:InventoryJournal', 'create:InventoryAdjustment'])
    auth.permissionsLoaded = false
    const { canRead, canAdjust } = useInventoryAccess()
    expect(canRead.value).toBe(false)
    expect(canAdjust.value).toBe(false)
    auth.permissionsLoaded = true
    auth.authPhase = 'selecting-tenant'
    expect(canRead.value).toBe(false)
  })

  it('exposes the identity scope used to fence reads and commands', () => {
    auth.granted = new Set(['read:InventoryJournal'])
    const context = useInventoryContext()
    expect(context.value).toEqual({
      userId: 'user-1', tenantId: 'branch-1', ready: true, canRead: true, canAdjust: false,
    })
    auth.user = null
    expect(context.value.userId).toBe('')
  })
})
