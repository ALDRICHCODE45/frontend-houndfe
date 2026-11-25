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

// Sales history redesign T1: toggle chips, 44px below md; a long name ends in «…» in the chip and
// is read whole in the title (and on the product lines of the opened sale).
const chipClass =
  'inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium md:min-h-9 border-[var(--hf-muted)] bg-[var(--hf-surface)] text-[var(--hf-ink)] hover:bg-[var(--hf-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)] aria-pressed:border-[var(--hf-active)] aria-pressed:bg-[var(--hf-active-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--hf-active)]'
</script>

<template>
  <div
    role="group"
    aria-label="Filtrar ventas por mascota"
    data-testid="history-pet-filter"
    class="flex min-w-0 flex-wrap items-center gap-2"
  >
    <span class="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--hf-muted)]">
      <UIcon name="i-lucide-paw-print" class="size-3.5" aria-hidden="true" />
      Mascota
    </span>
    <button
      type="button"
      data-testid="history-pet-chip"
      :class="chipClass"
      :aria-pressed="selected === null"
      @click="selected = null"
    >
      <UIcon v-if="selected === null" name="i-lucide-check" class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="truncate">Todas</span>
    </button>
    <button
      v-for="pet in options"
      :key="pet.id"
      type="button"
      data-testid="history-pet-chip"
      :class="chipClass"
      :title="pet.name"
      :aria-pressed="selected === pet.id"
      @click="selected = pet.id"
    >
      <UIcon v-if="selected === pet.id" name="i-lucide-check" class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="truncate">{{ pet.name }}</span>
      <small v-if="pet.status === 'ARCHIVED'" class="shrink-0 text-xs font-normal"> (archivada)</small>
    </button>
  </div>
</template>
