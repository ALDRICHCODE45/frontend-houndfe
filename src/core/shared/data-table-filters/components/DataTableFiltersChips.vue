<script setup lang="ts">
import { computed } from 'vue'
import type { FilterState, FiltersSchema } from '../schema/types'

const props = defineProps<{
  schema: FiltersSchema
  state: FilterState
}>()

const emit = defineEmits<{
  clear: [filterId: string]
  clearAll: []
}>()

const chips = computed(() => props.schema.activeChips(props.state))
</script>

<template>
  <div v-if="chips.length > 0" class="flex flex-wrap items-center gap-2" data-testid="filters-chips">
    <UBadge
      v-for="chip in chips"
      :key="chip.filterId"
      variant="soft"
      color="neutral"
      class="flex items-center gap-2"
      :data-testid="`chip-${chip.filterId}`"
    >
      <span>{{ chip.label }}: {{ chip.displayValue }}</span>
      <UButton
        :data-testid="`chip-clear-${chip.filterId}`"
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        size="xs"
        @click="emit('clear', chip.filterId)"
      />
    </UBadge>

    <UButton
      data-testid="chips-clear-all"
      variant="link"
      color="neutral"
      size="xs"
      @click="emit('clearAll')"
    >
      Limpiar todo
    </UButton>
  </div>
</template>
