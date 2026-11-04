<script setup lang="ts">
/**
 * StatusBadge — Shared status label: a dot, a tinted soft background and a
 * semibold label (list artboard 02). Colors come from `--hf-*` tokens through
 * houndfe-ui.css, so both themes and the AA contrast pins live in one place.
 *
 * `urgent` draws more attention without turning loud: a deeper tint, a border
 * and an icon in place of the dot. Urgency is also said in words for assistive
 * tech ("Estado: Vencida, urgente"), never by color alone.
 *
 * Props:
 *   label        — text content of the badge
 *   tone         — neutral | info | success | warning | danger (legacy tone aliases are mapped)
 *   urgent       — stronger tint + border + icon
 *   icon         — icon used when urgent (default triangle-alert)
 *   ariaLabel    — full aria-label override
 *   ariaPrefix   — prefix used when ariaLabel is not provided (default "Estado:")
 */
import { computed } from 'vue'
import { statusBadgeTone, type AppBadgeTone } from '@/core/shared/utils/badge.utils'

const props = withDefaults(
  defineProps<{
    label: string
    tone?: AppBadgeTone | 'danger'
    urgent?: boolean
    icon?: string
    ariaLabel?: string
    ariaPrefix?: string
  }>(),
  {
    tone: 'neutral',
    urgent: false,
    icon: 'i-lucide-triangle-alert',
    ariaPrefix: 'Estado:',
  },
)

const resolvedTone = computed(() => statusBadgeTone(props.tone))
const resolvedAriaLabel = computed(
  () => props.ariaLabel ?? `${props.ariaPrefix} ${props.label}${props.urgent ? ', urgente' : ''}`,
)
</script>

<template>
  <span
    class="hf-status-badge"
    role="img"
    :data-tone="resolvedTone"
    :data-urgent="urgent ? 'true' : undefined"
    :aria-label="resolvedAriaLabel"
  >
    <UIcon v-if="urgent" :name="icon" :data-icon="icon" class="hf-status-badge__icon" aria-hidden="true" />
    <span v-else class="hf-status-badge__dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>
