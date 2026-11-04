<script setup lang="ts">
/**
 * EmptyState — One component for the four reasons a list or panel has nothing
 * to show, so none of them reads as broken or as lost data: a title, at most
 * one line and at most one button. No illustrations.
 *
 * Props:
 *   kind          — empty (nothing yet) | no-match (filters match nothing) |
 *                   error (did not load, role="alert") | forbidden (no access); default empty
 *   title         — what happened, naming the noun
 *   description   — one short line; omit when the title says it all
 *   icon          — overrides the kind icon (inbox, search-x, triangle-alert, lock)
 *   actionLabel   — renders the single button; omit for no button
 *   actionIcon    — icon of the button (error defaults to the retry glyph)
 *   actionVariant — outline (default) | solid; solid only for the page's create action
 *   actionTestId  — data-testid of the button (default "empty-state-action")
 *   actionLoading — the action is running: the button shows a spinner and is disabled
 *
 * Events:
 *   action        — the button was clicked
 */
import { computed } from 'vue'

type EmptyStateKind = 'empty' | 'no-match' | 'error' | 'forbidden'

const KIND_ICONS: Record<EmptyStateKind, string> = {
  empty: 'i-lucide-inbox',
  'no-match': 'i-lucide-search-x',
  error: 'i-lucide-triangle-alert',
  forbidden: 'i-lucide-lock',
}

const props = withDefaults(
  defineProps<{
    kind?: EmptyStateKind
    title: string
    description?: string
    icon?: string
    actionLabel?: string
    actionIcon?: string
    actionVariant?: 'solid' | 'outline'
    actionTestId?: string
    actionLoading?: boolean
  }>(),
  {
    kind: 'empty',
    description: undefined,
    icon: undefined,
    actionLabel: undefined,
    actionIcon: undefined,
    actionVariant: 'outline',
    actionTestId: 'empty-state-action',
    actionLoading: false,
  },
)

const emit = defineEmits<{ action: [] }>()

const resolvedIcon = computed(() => props.icon ?? KIND_ICONS[props.kind])
const resolvedActionIcon = computed(
  () => props.actionIcon ?? (props.kind === 'error' ? 'i-lucide-rotate-cw' : undefined),
)
const isSolid = computed(() => props.actionVariant === 'solid')
</script>

<template>
  <div
    class="hf-empty-state"
    :data-kind="kind"
    :role="kind === 'error' ? 'alert' : 'status'"
  >
    <UIcon
      :name="resolvedIcon"
      :data-icon="resolvedIcon"
      class="hf-empty-state__icon"
      aria-hidden="true"
    />
    <p class="hf-empty-state__title">{{ title }}</p>
    <p v-if="description" class="hf-empty-state__description">{{ description }}</p>
    <UButton
      v-if="actionLabel"
      :label="actionLabel"
      :icon="resolvedActionIcon"
      :color="isSolid ? 'primary' : 'neutral'"
      :variant="isSolid ? 'solid' : 'outline'"
      :data-testid="actionTestId"
      :loading="actionLoading"
      :disabled="actionLoading"
      @click="emit('action')"
    />
  </div>
</template>
