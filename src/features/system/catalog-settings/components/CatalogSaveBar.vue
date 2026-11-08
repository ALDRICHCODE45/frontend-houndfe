<script setup lang="ts">
/**
 * CatalogSaveBar — sticky save bar at the bottom of the settings column
 * (artboard 01): state on the left («Sin cambios para guardar», «Cambios sin
 * guardar» in `--hf-warning`, «Guardando…», «Guardado») with the accepted
 * «Actualizado …» time, «Descartar» while dirty and the one primary «Guardar».
 * Below 640px it becomes the design-system sticky mobile bar with the buttons
 * in equal columns (styles in catalog-settings-visual.css).
 */
import { computed } from 'vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'

const props = withDefaults(
  defineProps<{
    dirty: boolean
    canSave: boolean
    saving?: boolean
    /** A save just succeeded and nothing changed since. */
    saved?: boolean
    /** Why a dirty draft cannot be saved yet («revisa la cantidad»). */
    hint?: string | null
    updatedAt: string
  }>(),
  { saving: false, saved: false, hint: null },
)

const emit = defineEmits<{ (event: 'save'): void; (event: 'discard'): void }>()

const state = computed(() => {
  if (props.saving) return 'saving'
  if (props.dirty) return 'dirty'
  if (props.saved) return 'saved'
  return 'clean'
})

const statusText = computed(
  () =>
    ({
      saving: 'Guardando…',
      dirty: props.hint ? `Cambios sin guardar · ${props.hint}` : 'Cambios sin guardar',
      saved: 'Guardado',
      clean: 'Sin cambios para guardar',
    })[state.value],
)
</script>

<template>
  <div class="cs-savebar" role="region" aria-label="Guardar cambios" data-testid="settings-footer">
    <div class="cs-save-state">
      <span
        class="cs-save-status"
        :data-state="state"
        role="status"
        data-testid="save-status"
      >
        <UIcon v-if="state === 'saved'" name="i-lucide-check" class="size-4" aria-hidden="true" />
        {{ statusText }}
      </span>
      <span class="cs-save-updated" data-testid="updated-at">
        Actualizado {{ formatShortDateTime(props.updatedAt) }}
      </span>
    </div>
    <div class="cs-save-buttons">
      <UButton
        v-if="props.dirty && !props.saving"
        color="neutral"
        variant="outline"
        icon="i-lucide-undo-2"
        data-testid="discard-button"
        @click="emit('discard')"
      >
        Descartar
      </UButton>
      <UButton
        color="primary"
        class="cs-save-primary justify-center"
        data-testid="footer-save-button"
        :disabled="!props.canSave"
        :loading="props.saving"
        @click="emit('save')"
      >
        Guardar
      </UButton>
    </div>
  </div>
</template>
