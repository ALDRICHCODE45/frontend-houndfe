<script setup lang="ts">
import { computed } from 'vue'
import '@/core/shared/components/form/hf-form.css'
import { EDITORIAL_PUBLISH_CHECKLIST_ID } from './EditorialPublishChecklist.vue'

/** The save bar of Contenido once everything is saved (Save bar, design-system.md): the same anatomy as
 * HfSaveBar, with «Publicar» as the single primary. It is enabled only when the saved draft is ready;
 * otherwise it is disabled and points at the Issue checklist, never at a tooltip. An ambiguous publish
 * turns the primary into «Reintentar publicación» (the same attempt).
 */
const props = defineProps<{
  /** null while readiness is being read. */
  ready: boolean | null
  canPublish: boolean
  publishing: boolean
  /** Readiness could not be read. */
  failed: boolean
  error: string | null
  retryable: boolean
  /** The checklist is on the page. */
  explained: boolean
}>()
const emit = defineEmits<{ publish: []; retry: []; recheck: [] }>()

const state = computed(() => (props.publishing ? 'saving' : props.error ? 'error' : props.ready ? 'ready' : 'pending'))
const text = computed(() => {
  if (props.publishing) return 'Publicando…'
  if (props.error) return props.error
  if (props.failed) return 'No pudimos revisar qué falta para publicar.'
  if (props.ready === null) return 'Revisando qué falta para publicar…'
  return props.ready ? 'Listo para publicar' : 'Completa lo pendiente para publicar'
})
</script>

<template>
  <div class="hf-save-bar">
    <p class="hf-save-bar__status" :data-state="state" aria-live="polite">
      <UIcon v-if="state === 'ready'" name="i-lucide-check" class="hf-save-bar__check" aria-hidden="true" />
      <UIcon v-else-if="state === 'error'" name="i-lucide-circle-alert" class="hf-save-bar__icon" aria-hidden="true" />
      {{ text }}
    </p>
    <div class="hf-save-bar__actions">
      <UButton v-if="failed && !publishing" color="neutral" variant="ghost" class="hf-save-bar__discard" label="Reintentar" data-testid="recheck" @click="emit('recheck')" />
      <UButton v-if="retryable" class="hf-primary-control" label="Reintentar publicación" data-testid="retry-publish" @click="emit('retry')" />
      <UButton
        v-else
        class="hf-primary-control"
        data-testid="publish"
        label="Publicar"
        :disabled="!canPublish || publishing"
        :aria-busy="publishing || undefined"
        :aria-describedby="!canPublish && explained ? EDITORIAL_PUBLISH_CHECKLIST_ID : undefined"
        @click="emit('publish')"
      />
    </div>
  </div>
</template>
