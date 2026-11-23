<script setup lang="ts">
/** «Ya no está»: archive a pet with an optional reason (≤ 280, handoff 27 §3.4). Restorable. */
import { ref, watch } from 'vue'
import type { Pet } from '../pets/pet.types'

const props = withDefaults(defineProps<{ open: boolean; pet: Pet | null; loading?: boolean }>(), {
  loading: false,
})
const emit = defineEmits<{ 'update:open': [value: boolean]; confirm: [reason: string] }>()

const reason = ref('')
watch(
  () => props.open,
  (open) => {
    if (open) reason.value = ''
  },
)
</script>

<template>
  <UModal
    :open="open"
    :title="pet ? `Archivar a ${pet.name}` : 'Archivar mascota'"
    :dismissible="!loading"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay clients-form-portal' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-(--hf-muted)">
          Úsalo cuando la mascota ya no está. Sus ventas se conservan y puedes restaurarla después.
        </p>
        <UFormField label="Motivo (opcional)" name="reason">
          <UTextarea
            v-model="reason"
            data-testid="pet-archive-reason"
            class="w-full"
            :rows="2"
            maxlength="280"
            placeholder="Ej: Ya no está"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="loading"
          class="min-h-11 justify-center sm:min-h-0"
          @click="emit('update:open', false)"
        />
        <UButton
          label="Archivar"
          data-testid="pet-archive-confirm"
          color="primary"
          :loading="loading"
          class="hf-primary-control min-h-11 justify-center sm:min-h-0"
          @click="emit('confirm', reason)"
        />
      </div>
    </template>
  </UModal>
</template>
