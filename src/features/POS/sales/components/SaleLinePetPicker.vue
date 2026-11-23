<script setup lang="ts">
import { computed } from 'vue'
import type { Pet } from '@/features/POS/customers/pets/pet.types'

// Handoff 27 §5.2: compact picker of the customer's ACTIVE pets plus «Sin mascota».
const props = defineProps<{
  pets: Pet[]
  /** The line's current pet id; null when the line has no pet. */
  petId: string | null
  disabled?: boolean
  portalClass?: string
}>()

const emit = defineEmits<{ select: [petId: string | null] }>()

// The select cannot hold null or an empty string as a value.
const NO_PET = '__sin-mascota__'

const items = computed(() => [
  { label: 'Sin mascota', value: NO_PET },
  ...props.pets.map((pet) => ({ label: pet.name, value: pet.id })),
])

const selected = computed(() => props.petId ?? NO_PET)

function handleSelect(value: unknown) {
  const next = typeof value === 'string' && value !== NO_PET ? value : null
  if (next !== props.petId) emit('select', next)
}
</script>

<template>
  <USelect
    :model-value="selected"
    :items="items"
    :disabled="disabled"
    size="xs"
    icon="i-lucide-paw-print"
    placeholder="Mascota"
    aria-label="Mascota de la línea"
    data-testid="sale-line-pet-select"
    class="w-40 max-w-full"
    :ui="portalClass ? { content: portalClass } : undefined"
    @update:model-value="handleSelect"
  />
</template>
