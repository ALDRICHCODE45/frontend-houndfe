import { computed, shallowRef } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { zoneValidationsApi } from '../api/deliveryZones.api'
import { deliveryZoneKeys, zoneValidationKeys } from '../constants/queryKeys'
import type {
  ResolveDecision,
  ResolveValidationBody,
  ResolveValidationResponse,
  ZoneValidation,
} from '../interfaces/delivery-zone.types'
import { mapResolveError, type ResolveError } from '../utils/zoneErrors'

export type ResolveOutcome =
  | { ok: true; response: ResolveValidationResponse }
  | { ok: false; error: ResolveError }

/**
 * Approve or reject a validation (handoff §3.4). Each submit gets a new
 * `resolutionRequestId`; only a retry after a network/5xx failure resends the
 * exact same body (same id), which the backend answers idempotently.
 */
export function useResolveValidation() {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const pending = shallowRef(false)
  const retryable = shallowRef<{ id: string; body: ResolveValidationBody } | null>(null)

  async function send(id: string, body: ResolveValidationBody): Promise<ResolveOutcome> {
    pending.value = true
    try {
      const response = await zoneValidationsApi.resolve(id, body)
      retryable.value = null
      void queryClient.invalidateQueries({ queryKey: zoneValidationKeys.all(tenantId.value) })
      void queryClient.invalidateQueries({ queryKey: deliveryZoneKeys.all(tenantId.value) })
      return { ok: true, response }
    } catch (err) {
      const error = mapResolveError(err)
      retryable.value = error.kind === 'network' ? { id, body } : null
      return { ok: false, error }
    } finally {
      pending.value = false
    }
  }

  function submit(validation: Pick<ZoneValidation, 'id' | 'version'>, decision: ResolveDecision) {
    const body: ResolveValidationBody = {
      ...decision,
      expectedVersion: validation.version,
      resolutionRequestId: crypto.randomUUID(),
    }
    return send(validation.id, body)
  }

  async function retry(): Promise<ResolveOutcome | null> {
    const attempt = retryable.value
    return attempt ? send(attempt.id, attempt.body) : null
  }

  /** Forget a failed attempt (another validation opened, or the user changed the decision). */
  function reset() {
    retryable.value = null
  }

  return { submit, retry, reset, pending, canRetry: computed(() => retryable.value !== null) }
}
