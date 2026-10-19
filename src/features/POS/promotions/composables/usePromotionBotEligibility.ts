import { computed, shallowRef, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { promotionApi } from '../api/promotion.api'
import type { PromotionFormState } from '../interfaces/promotion.types'
import { evaluateBotEligibility } from '../utils/botEligibility.utils'

/** Owns capabilities and the explicit, user-visible auto-off side effect. */
export function usePromotionBotEligibility(state: PromotionFormState) {
  const tenantId = useSafeTenantId()
  const query = useQuery({
    queryKey: computed(() => promotionQueryKeys.botEligibilityCapabilities(tenantId.value)),
    queryFn: () => promotionApi.getBotEligibilityCapabilities(),
    enabled: computed(() => !!tenantId.value),
    staleTime: 60_000,
  })
  const evaluation = computed(() => {
    // An errored refetch may retain cached data: do not evaluate that snapshot.
    if (query.isError.value) {
      return { supported: false, reason: 'No se pudo consultar la disponibilidad para WhatsApp.' }
    }
    if (query.isPending.value || query.isFetching.value || !query.data.value) {
      return { supported: false, reason: 'Consultando disponibilidad para WhatsApp…' }
    }
    return evaluateBotEligibility(state, query.data.value.rules)
  })
  const notice = shallowRef('')
  watch(
    [evaluation, () => state.botEligible],
    ([result]) => {
      if (
        query.isSuccess.value &&
        !query.isFetching.value &&
        !result.supported &&
        state.botEligible
      ) {
        state.botEligible = false
        notice.value = `Se desactivó WhatsApp. ${result.reason}`
      } else if (state.botEligible) {
        notice.value = ''
      }
    },
    { immediate: true },
  )
  return { evaluation, notice }
}
