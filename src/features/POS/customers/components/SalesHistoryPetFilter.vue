<script setup lang="ts">
import { computed } from 'vue'
import type { Pet } from '../pets/pet.types'

/** Customer pets §7: «Todas» plus every pet of the customer; archived pets stay selectable. */
const props = defineProps<{ pets: Pet[] }>()
const selected = defineModel<string | null>({ required: true })

const options = computed(() => [
  ...props.pets.filter((pet) => pet.status === 'ACTIVE'),
  ...props.pets.filter((pet) => pet.status === 'ARCHIVED'),
])

function chipClass(active: boolean) {
  return active
    ? 'border-[var(--ui-primary)] bg-[var(--ui-primary)]/10 text-highlighted'
    : 'border-default text-muted hover:bg-elevated'
}
</script>

<template>
  <div
    role="group"
    aria-label="Filtrar ventas por mascota"
    data-testid="history-pet-filter"
    class="flex min-w-0 flex-wrap gap-2"
  >
    <button
      type="button"
      data-testid="history-pet-chip"
      class="min-h-9 rounded-full border px-3 text-sm font-medium"
      :class="chipClass(selected === null)"
      :aria-pressed="selected === null"
      @click="selected = null"
    >
      Todas
    </button>
    <button
      v-for="pet in options"
      :key="pet.id"
      type="button"
      data-testid="history-pet-chip"
      class="min-h-9 max-w-full truncate rounded-full border px-3 text-sm font-medium"
      :class="chipClass(selected === pet.id)"
      :aria-pressed="selected === pet.id"
      @click="selected = pet.id"
    >
      {{ pet.name }}<span v-if="pet.status === 'ARCHIVED'" class="text-muted"> (archivada)</span>
    </button>
  </div>
</template>
