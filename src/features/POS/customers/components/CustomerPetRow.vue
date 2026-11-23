<script setup lang="ts">
/** One pet in the «Mascotas» list: name, species · breed, size, `ageLabel` as is, allergies highlighted. */
import { computed } from 'vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { petSizeLabel, petSpeciesLabel } from '../pets/petForm'
import type { Pet } from '../pets/pet.types'

const props = defineProps<{ pet: Pet; actions: RowAction[] }>()
const emit = defineEmits<{ action: [key: string, pet: Pet] }>()

const kind = computed(() =>
  [petSpeciesLabel(props.pet), props.pet.breed].filter(Boolean).join(' · '),
)
const details = computed(() => [petSizeLabel(props.pet.size), props.pet.ageLabel].filter(Boolean))
</script>

<template>
  <li
    :data-testid="`pet-row-${pet.id}`"
    class="flex min-h-14 items-start justify-between gap-3 py-2 pl-4 pr-1"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <span class="truncate text-sm font-semibold text-(--hf-ink)">{{ pet.name }}</span>
      <span class="text-sm text-(--hf-muted)">
        {{ kind }}<template v-for="item in details" :key="item"> · {{ item }}</template>
      </span>
      <UBadge
        v-if="pet.allergies"
        data-testid="pet-allergies"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="self-start whitespace-normal"
        :label="`Alergias: ${pet.allergies}`"
      />
      <span v-if="pet.notes" class="text-sm text-(--hf-muted)">{{ pet.notes }}</span>
      <span v-if="pet.status === 'ARCHIVED'" class="text-xs text-(--hf-muted)">
        Archivada{{ pet.archivedReason ? `: ${pet.archivedReason}` : '' }}
      </span>
    </div>
    <RowActionsMenu
      :actions="actions"
      :row-label="pet.name"
      portal-class="clients-form-portal"
      @select="emit('action', $event, pet)"
    />
  </li>
</template>
