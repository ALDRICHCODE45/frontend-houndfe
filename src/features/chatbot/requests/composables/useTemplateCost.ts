import { computed } from 'vue'
import { useChatbotSettingsQuery } from '@/features/system/chatbot-settings/composables/useChatbotSettingsQuery'

/** Shown when the branch text is not available (a role without `read:ChatbotSettings`, or the read failed). */
export const DEFAULT_TEMPLATE_COST_TEXT = 'Enviar la plantilla tiene un costo para el negocio.'

/**
 * The cost warning of the «Enviar plantilla» confirmation (handoff 20 §3c, handoff 16): the
 * `templateCostText` of the branch settings, shown as written. The detail does not carry it, and the
 * settings read needs `read:ChatbotSettings`, so other roles see the generic default.
 */
export function useTemplateCost() {
  const { settings } = useChatbotSettingsQuery()
  const fromSettings = computed(() => settings.value?.templateCostText?.trim() || null)
  return {
    costText: computed(() => fromSettings.value ?? DEFAULT_TEMPLATE_COST_TEXT),
    isFromSettings: computed(() => fromSettings.value !== null),
  }
}
