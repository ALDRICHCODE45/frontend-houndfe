<script setup lang="ts">
/**
 * «Eliminar datos de la mascota»: the real erasure (handoff 27 §3.5), only for an explicit «olvida
 * mis datos». Says it cannot be undone and offers archive as the normal alternative.
 */
import type { Pet } from '../pets/pet.types'

withDefaults(
  defineProps<{ open: boolean; pet: Pet | null; loading?: boolean; canArchive?: boolean }>(),
  { loading: false, canArchive: false },
)
const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  'archive-instead': []
}>()
</script>

<template>
  <UModal
    :open="open"
    title="Eliminar datos de la mascota"
    :dismissible="!loading"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay clients-form-portal' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-3 text-sm" data-testid="pet-erase-dialog">
        <p class="text-(--hf-ink)">
          Se borrarán todos los datos de <strong>{{ pet?.name }}</strong> y su nombre desaparecerá
          de las ventas. <strong>Esta acción no se puede deshacer.</strong>
        </p>
        <p class="text-(--hf-muted)">
          Si la mascota ya no está, archívala: conserva su historial y se puede restaurar.
        </p>
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
          v-if="canArchive"
          label="Archivar en su lugar"
          data-testid="pet-erase-archive-instead"
          color="neutral"
          variant="outline"
          :disabled="loading"
          class="min-h-11 justify-center sm:min-h-0"
          @click="emit('archive-instead')"
        />
        <UButton
          label="Eliminar datos"
          data-testid="pet-erase-confirm"
          color="error"
          :loading="loading"
          class="min-h-11 justify-center sm:min-h-0"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
