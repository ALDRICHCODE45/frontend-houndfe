<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { badgeToneToColor, type AppBadgeTone } from '@/core/shared/utils/badge.utils'

const props = withDefaults(
  defineProps<{
    label?: string
    value?: string | number
    tone?: AppBadgeTone
    icon?: string
    variant?: 'soft' | 'solid' | 'outline' | 'subtle'
  }>(),
  {
    tone: 'neutral',
    variant: 'subtle',
  },
)

const slots = useSlots()

const color = computed(() => badgeToneToColor(props.tone))
const hasDefaultSlot = computed(() => Boolean(slots.default))
const resolvedLabel = computed(() => props.label ?? (props.value != null ? String(props.value) : undefined))
</script>

<template>
  <UBadge
    :color="color"
    :variant="variant"
    :icon="icon"
    size="md"
    :label="!hasDefaultSlot ? resolvedLabel : undefined"
    :ui="{
      base: 'px-2.5 py-1',
      label: 'text-xs font-semibold leading-5',
    }"
  >
    <slot v-if="hasDefaultSlot" />
  </UBadge>
</template>
