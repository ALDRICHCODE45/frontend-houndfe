<script setup lang="ts">
/**
 * SubtypeTag — the request type as a small icon + label (design 01-tabla-agrupada `.tag`).
 * An unknown subtype (a later backend unit) reads «Solicitud», never the raw code.
 */
import { computed } from 'vue'
import type { ChatbotRequestSubtype } from '../interfaces/chatbot-request.types'
import { SUBTYPE_ICONS, SUBTYPE_LABELS } from '../utils/requestLabels'

const props = defineProps<{ subtype: ChatbotRequestSubtype }>()

const label = computed(() => SUBTYPE_LABELS[props.subtype] ?? 'Solicitud')
const icon = computed(() => SUBTYPE_ICONS[props.subtype] ?? 'i-lucide-inbox')
</script>

<template>
  <span class="chatbot-subtype-tag" :data-subtype="subtype">
    <UIcon :name="icon" class="chatbot-subtype-tag__icon" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.chatbot-subtype-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--hf-muted);
}

.chatbot-subtype-tag__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
