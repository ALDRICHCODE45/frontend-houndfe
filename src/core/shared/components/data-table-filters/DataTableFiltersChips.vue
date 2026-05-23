<script setup lang="ts">
export type ActiveFilterChip = {
  id: string
  label: string
  value: string
}

const props = defineProps<{
  chips: ActiveFilterChip[]
}>()

const emit = defineEmits<{
  (event: 'remove', id: string): void
  (event: 'clear'): void
}>()
</script>

<template>
  <div v-if="props.chips.length > 0" class="flex flex-wrap items-center gap-2" data-testid="filters-chips">
    <UBadge
      v-for="chip in props.chips"
      :key="chip.id"
      variant="soft"
      color="neutral"
      class="flex items-center gap-2"
    >
      <span>{{ chip.label }}: {{ chip.value }}</span>
      <UButton
        :data-testid="`chip-remove-${chip.id}`"
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        size="xs"
        @click="emit('remove', chip.id)"
      />
    </UBadge>

    <UButton
      data-testid="chips-clear"
      variant="ghost"
      color="neutral"
      size="xs"
      @click="emit('clear')"
    >
      Limpiar filtros
    </UButton>
  </div>
</template>
