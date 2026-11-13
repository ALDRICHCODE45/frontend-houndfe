import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { chatbotSettingsApi } from '@/features/system/chatbot-settings/api/chatbotSettings.api'
import { chatbotSettingsKeys } from '@/features/system/chatbot-settings/constants/queryKeys'
import { useChatbotSettingsAccess } from '@/features/system/chatbot-settings/composables/useChatbotSettingsAccess'

/** Shown when no text is available (the detail has none, a role without `read:ChatbotSettings`, or the read failed). */
export const DEFAULT_TEMPLATE_COST_TEXT = 'Enviar la plantilla tiene un costo para el negocio.'

/**
 * The cost warning of the «Enviar plantilla» confirmation (handoff 20 §3c). The order is:
 * 1. `detail.templateCostText` (`fromDetail`): it comes with the request detail for anyone who can read it,
 *    so an attendee without `read:ChatbotSettings` sees it, and then `GET /chatbot-settings` is not called;
 * 2. the `templateCostText` of `GET /chatbot-settings` (same tenant key as the settings screen, only with
 *    `read:ChatbotSettings`), for a detail that has none (`null`, or an older backend);
 * 3. the generic line.
 */
export function useTemplateCost(fromDetail?: MaybeRefOrGetter<string | null | undefined>) {
  const { tenantId, enabled: canReadSettings } = useChatbotSettingsAccess()
  const detailText = computed(() => toValue(fromDetail)?.trim() || null)

  const query = useQuery({
    queryKey: computed(() => chatbotSettingsKeys.detail(tenantId.value)),
    queryFn: ({ signal }) => chatbotSettingsApi.get({ signal }),
    enabled: computed(() => canReadSettings.value && detailText.value === null),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const fromSettings = computed(() => (canReadSettings.value ? query.data.value?.templateCostText?.trim() || null : null))
  const text = computed(() => detailText.value ?? fromSettings.value)
  return {
    costText: computed(() => text.value ?? DEFAULT_TEMPLATE_COST_TEXT),
    /** `true` when the text is the tenant's own (detail or settings), `false` for the generic line. */
    isFromSettings: computed(() => text.value !== null),
  }
}
