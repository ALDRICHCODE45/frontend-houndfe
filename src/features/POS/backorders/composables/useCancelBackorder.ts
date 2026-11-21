import { ref, readonly, toValue, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { backorderQueryKeys } from '@/core/shared/constants/query-keys'
import { backordersApi } from '../api/backorders.api'
import type { BackorderStaff, CancelBackorderBody } from '../interfaces/backorder.types'
import { RETRY_REQUIRED_CODE, readBackorderError, type BackorderErrorInfo } from '../utils/backorderErrors'
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
 *
 * A 503 `BACKORDER_RETRY_REQUIRED` (S12, handoff 26 §7) changed nothing on the server: the very same
 * request (same version and reason) is sent once more. If that fails too, it is reported as a failure
 * (no loop); a 409 on the retry is handled like any 409.
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
      let backorder: BackorderStaff
      try {
        backorder = await backordersApi.cancel(toValue(id), body)
      } catch (err) {
        if (readBackorderError(err).code !== RETRY_REQUIRED_CODE) throw err
        backorder = await backordersApi.cancel(toValue(id), body)
      }
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
