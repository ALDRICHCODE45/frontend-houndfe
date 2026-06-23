<script setup lang="ts">
/**
 * EntityAvatar — Shared avatar with initials, deterministic color hash, and optional status dot.
 *
 * Extracts the initials + palette-hashing pattern from EmployeesListView and
 * EmployeeCard into a single shared source of truth. The color is derived from
 * the `seed` string (typically an entity ID) so the same entity always gets the
 * same color without storing anything.
 *
 * Props:
 *   name     — full name; first two words provide the 2-letter initials
 *   seed     — any stable string (e.g. entity ID) used to pick the palette color
 *   showDot  — render a status dot overlay in the bottom-right corner (default: false)
 *   dotClass — Tailwind bg color class for the dot (default: 'bg-emerald-500')
 *   size     — 'sm' (28px) | 'md' (32px, default) | 'lg' (48px)
 */

import { computed } from 'vue'

// Palette matches the original 7-color palette used in EmployeesListView + EmployeeCard.
const AVATAR_PALETTES = [
  'bg-amber-500 text-white',
  'bg-pink-500 text-white',
  'bg-violet-500 text-white',
  'bg-red-500 text-white',
  'bg-cyan-500 text-white',
  'bg-emerald-500 text-white',
  'bg-blue-500 text-white',
] as const

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

// Deterministic color from seed string — same algorithm as the original helpers.
const avatarClass = computed<string>(() => {
  const hash = props.seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length] ?? AVATAR_PALETTES[0]!
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
      class="flex items-center justify-center rounded-full font-semibold shadow-sm"
      :class="[sizeClass, avatarClass]"
      :aria-label="name"
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
