/**
 * useCashAccess — closing gates (T4, S5). Granular abilities, never roles:
 *   - canClose        = create:CashClosing
 *   - canReadClosings = read:CashClosing (list, detail, PDF)
 *   - canListRecipients = create:CashHandover (GET /cash-handovers/recipients)
 */
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const auth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  isSuperAdmin: false,
  permissionCodes: [] as string[],
  permissionsLoaded: true,
  userCan(action: string, subject: string) {
    return auth.permissionCodes.includes(`${action}:${subject}`)
  },
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { useCashAccess } from '../useCashAccess'

function gates(codes: string[]) {
  auth.permissionCodes = codes
  const access = useCashAccess()
  return {
    canClose: access.canClose.value,
    canReadClosings: access.canReadClosings.value,
    canListRecipients: access.canListRecipients.value,
  }
}

describe('useCashAccess closing gates', () => {
  it('denies everything without grants', () => {
    expect(gates([])).toEqual({ canClose: false, canReadClosings: false, canListRecipients: false })
  })

  it('create:CashClosing only closes', () => {
    expect(gates(['create:CashClosing'])).toEqual({
      canClose: true,
      canReadClosings: false,
      canListRecipients: false,
    })
  })

  it('read:CashClosing only reads cortes', () => {
    expect(gates(['read:CashClosing'])).toEqual({
      canClose: false,
      canReadClosings: true,
      canListRecipients: false,
    })
  })

  it('create:CashHandover lists recipients; audit does not imply closing', () => {
    expect(gates(['create:CashHandover', 'read:CashSessionAudit'])).toEqual({
      canClose: false,
      canReadClosings: false,
      canListRecipients: true,
    })
  })
})
