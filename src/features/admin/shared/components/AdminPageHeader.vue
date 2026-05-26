<script setup lang="ts">
import { computed, useSlots } from 'vue'

interface Props {
  title: string
  description?: string
  loading?: boolean
  fallbackText?: string
}

const props = defineProps<Props>()
const slots = useSlots()

const hasSubtitleSlot = computed(() => Boolean(slots.subtitle))
const displayText = computed(() => props.description ?? props.fallbackText ?? '')
const shouldShowParagraph = computed(
  () => !props.loading && !hasSubtitleSlot.value && displayText.value.length > 0,
)
</script>

<template>
  <div>
    <h2 class="text-2xl font-semibold">{{ title }}</h2>

    <div v-if="loading" data-testid="admin-page-header-loading" class="mt-1">
      <USkeleton class="h-4 w-48" />
    </div>

    <div v-else-if="hasSubtitleSlot" class="text-sm text-muted">
      <slot name="subtitle" />
    </div>

    <p v-else-if="shouldShowParagraph" class="text-sm text-muted">
      {{ displayText }}
    </p>
  </div>
</template>
