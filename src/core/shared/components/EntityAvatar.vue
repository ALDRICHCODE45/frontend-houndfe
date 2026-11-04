<script setup lang="ts">
/**
 * EntityAvatar — Shared initials avatar for people, with an optional status dot.
 *
 * Neutral by design (Record avatars rule): `--hf-surface-muted` with
 * `--hf-heading` initials, never a per-person palette color.
 *
 * Props:
 *   name     — full name; first two words provide the 2-letter initials
 *   seed     — kept for compatibility; no longer affects the color
 *   showDot  — render a status dot overlay in the bottom-right corner (default: false)
 *   dotClass — Tailwind bg color class for the dot (default: 'bg-emerald-500')
 *   size     — 'sm' (28px) | 'md' (32px, default) | 'lg' (48px)
 */

import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    seed: string
    showDot?: boolean
    dotClass?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    showDot: false,
    dotClass: 'bg-emerald-500',
    size: 'md',
  },
)

// First two words, first character each, uppercased. Falls back to 'C'.
const initials = computed<string>(() => {
  const parts = props.name.trim().split(' ').filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'C'
  )
})

const sizeClass = computed<string>(() => {
  switch (props.size) {
    case 'sm':
      return 'size-7 text-[10px]'
    case 'lg':
      return 'size-12 text-base'
    default:
      return 'size-8 text-xs'
  }
})

// Dot size mirrors the original: cards use size-3 (lg avatar), table uses size-2.5 (sm/md).
const dotSizeClass = computed<string>(() => (props.size === 'lg' ? 'size-3' : 'size-2.5'))
</script>

<template>
  <div class="relative shrink-0">
    <div
      class="hf-entity-avatar flex items-center justify-center rounded-full font-semibold"
      :class="sizeClass"
      :aria-label="name"
      data-testid="entity-avatar"
    >
      {{ initials }}
    </div>
    <span
      v-if="showDot"
      class="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-default"
      :class="[dotClass, dotSizeClass]"
      aria-label="Activo"
    />
  </div>
</template>

<style scoped>
.hf-entity-avatar {
  background: var(--hf-surface-muted);
  color: var(--hf-heading);
  box-shadow: inset 0 0 0 1px var(--hf-border);
}
</style>
