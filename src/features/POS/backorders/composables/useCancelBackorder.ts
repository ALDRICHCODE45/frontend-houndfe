import { ref, readonly, toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { backorderQueryKeys } from '@/core/shared/constants/query-keys'
import { backordersApi } from '../api/backorders.api'
import type { BackorderStaff, CancelBackorderBody } from '../interfaces/backorder.types'
import { readBackorderError, type BackorderErrorInfo } from '../utils/backorderErrors'
import { useBackorderAccess } from './useBackorderAccess'

export type CancelBackorderOutcome =
  | { status: 'ignored' }
  | { status: 'cancelled'; backorder: BackorderStaff }
  | { status: 'failed'; error: BackorderErrorInfo }

/**
 * `POST /backorders/:id/cancel` (S5). Needs `update:Backorder`; a second submit while one is in
 * flight is ignored. Success, the two 409s and a 404 refresh the whole tenant prefix (list, tabs' counts,
 * nav badge, detail) so the screen shows the order as the server has it; the caller words the
 * outcome. Never throws.
 */
export function useCancelBackorder(id: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  const { tenantId, canUpdate } = useBackorderAccess()
  const isPending = ref(false)

  const refresh = () => client.invalidateQueries({ queryKey: backorderQueryKeys.all(tenantId.value) })

  async function cancel(body: CancelBackorderBody): Promise<CancelBackorderOutcome> {
    if (!canUpdate.value || isPending.value) return { status: 'ignored' }
    isPending.value = true
    try {
      const backorder = await backordersApi.cancel(toValue(id), body)
      await refresh()
      return { status: 'cancelled', backorder }
    } catch (err) {
      const error = readBackorderError(err)
      if (error.refetch || error.notFound) await refresh()
      return { status: 'failed', error }
    } finally {
      isPending.value = false
    }
  }

  return { cancel, isPending: readonly(isPending) }
}
