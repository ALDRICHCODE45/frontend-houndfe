<script setup lang="ts">
/**
 * DotBadge — Shared badge with a colored leading dot.
 *
 * Captures the department badge pattern from the RR.HH. Colaboradores list:
 * a neutral outlined pill badge with a small colored circle as the leading element.
 * The dot color is caller-supplied; the neutral shell is the default.
 *
 * Props:
 *   label      — text content of the badge
 *   dotClass   — Tailwind bg color class for the dot (e.g. 'bg-violet-500')
 *   badgeClass — override the badge root classes (defaults to neutral outlined style)
 *   truncate   — truncate the label (useful in fixed-width card layouts)
 *   compact    — use py-1 padding instead of py-1.5 (for denser card contexts)
 */

import { computed } from 'vue'

const NEUTRAL_BADGE_CLASS =
  'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'

const props = withDefaults(
  defineProps<{
    label: string
    dotClass: string
    badgeClass?: string
    truncate?: boolean
    compact?: boolean
  }>(),
  {
    badgeClass: NEUTRAL_BADGE_CLASS,
    truncate: false,
    compact: false,
  },
)

const uiBase = computed(() =>
  `gap-2 rounded-full px-3 ${props.compact ? 'py-1' : 'py-1.5'} shadow-none ring ring-inset ring-gray-200 dark:ring-gray-700`,
)
</script>

<template>
  <UBadge
    variant="outline"
    size="md"
    :class="props.badgeClass"
    :ui="{
      base: uiBase,
      label: 'text-xs font-medium',
    }"
  >
    <template #leading>
      <span class="size-2 rounded-full" :class="props.dotClass" />
    </template>
    <span v-if="props.truncate" class="max-w-[140px] truncate">{{ props.label }}</span>
    <template v-else>{{ props.label }}</template>
  </UBadge>
</template>
