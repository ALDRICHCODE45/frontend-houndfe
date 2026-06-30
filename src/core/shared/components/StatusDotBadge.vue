<script setup lang="ts">
/**
 * StatusDotBadge — Shared semantic status pill with a colored leading dot.
 *
 * Captures the status badge pattern from the RR.HH. Colaboradores list:
 * a rounded outlined pill with a small colored circle whose color matches a
 * semantic state (e.g. "● Activo" green, "● Baja" red, "● Licencia" amber).
 *
 * Unlike DotBadge (neutral shell + caller-supplied raw dot color), the color
 * here is driven by a semantic `tone`. The tone -> color mapping is a design
 * system concern and lives in this component; domain code only decides which
 * tone a given state maps to and passes a `label`.
 *
 * Props:
 *   label        — text content of the badge
 *   tone         — semantic status tone (drives dot + shell color)
 *   compact      — use py-1 padding instead of py-1.5 (denser contexts)
 *   ariaLabel    — full aria-label override (defaults to "{ariaPrefix} {label}")
 *   ariaPrefix   — prefix used when ariaLabel is not provided (default "Estado:")
 */

import { computed } from 'vue'
import { badgeToneToColor, type AppBadgeTone } from '@/core/shared/utils/badge.utils'

const props = withDefaults(
  defineProps<{
    label: string
    tone?: AppBadgeTone
    compact?: boolean
    ariaLabel?: string
    ariaPrefix?: string
  }>(),
  {
    tone: 'neutral',
    compact: false,
    ariaPrefix: 'Estado:',
  },
)

const resolvedAriaLabel = computed(() => props.ariaLabel ?? `${props.ariaPrefix} ${props.label}`)

// Resolve the semantic tone to a base color family, then map that family to the
// dot + shell tints. Keeping the dot map keyed by the resolved color (not the
// raw tone) means aliased tones (active->success, inactive->error, ...) reuse
// the same visual treatment automatically.
const color = computed(() => badgeToneToColor(props.tone))

const DOT_CLASS_BY_COLOR = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  secondary: 'bg-violet-500',
  neutral: 'bg-gray-400',
} as const

const SHELL_CLASS_BY_COLOR = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  error:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
  secondary:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300',
  neutral:
    'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
} as const

const dotClass = computed(() => DOT_CLASS_BY_COLOR[color.value])
const shellClass = computed(() => SHELL_CLASS_BY_COLOR[color.value])
const uiBase = computed(
  () => `gap-2 rounded-full px-3 ${props.compact ? 'py-1' : 'py-1.5'} shadow-none ring-0`,
)
</script>

<template>
  <UBadge
    variant="outline"
    size="md"
    :class="shellClass"
    :ui="{
      base: uiBase,
      label: 'text-xs font-semibold',
    }"
    :aria-label="resolvedAriaLabel"
  >
    <template #leading>
      <span class="size-2 rounded-full" :class="dotClass" />
    </template>
    {{ props.label }}
  </UBadge>
</template>
