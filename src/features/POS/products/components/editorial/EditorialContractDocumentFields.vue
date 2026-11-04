<script setup lang="ts">
import { computed } from 'vue'
import type { EditorialDocumentEditingState } from '../../utils/editorial-contract-document-editing'

/** The document's own text: commercial title, description and the linked media. Controlled: the
 * caller owns the raw document, the IDs and the save. The limits are the ones the draft is
 * checked against (200 and 20,000 characters); the counter only appears near them. Media
 * references stay read-only and are never fetched.
 */
const props = defineProps<{ id: string; modelValue: EditorialDocumentEditingState; disabled?: boolean; readonly?: boolean;
  titleIssue?: string; descriptionIssue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialDocumentEditingState] }>()
const TITLE_MAX = 200
const DESCRIPTION_MAX = 20000
const units = (value: string | null) => [...(value ?? '')].length
const counter = (value: string | null, max: number) => {
  const length = units(value)
  return length >= max * 0.9 ? { text: `${length.toLocaleString('es-MX')} / ${max.toLocaleString('es-MX')}`, over: length >= max } : null
}
const titleCounter = computed(() => counter(props.modelValue.commercialTitle, TITLE_MAX))
const descriptionCounter = computed(() => counter(props.modelValue.description, DESCRIPTION_MAX))
function textChanged(key: 'commercialTitle' | 'description', event: Event) {
  if (props.disabled || props.readonly) return
  emit('update:modelValue', { ...props.modelValue, [key]: (event.target as HTMLInputElement | HTMLTextAreaElement).value })
}
</script>

<template>
  <section class="document-fields" :aria-labelledby="`${id}-heading`">
    <h3 :id="`${id}-heading`" class="sr-only">Título y descripción</h3>
    <div v-if="readonly" class="field">
      <p class="label">Título comercial</p>
      <p class="plain" data-field="title">{{ modelValue.commercialTitle || 'Sin título' }}</p>
    </div>
    <div v-else class="field">
      <label :for="`${id}-title`" class="label">Título comercial</label>
      <input :id="`${id}-title`" class="control" type="text" :value="modelValue.commercialTitle" :disabled="disabled"
        :aria-invalid="titleIssue ? 'true' : undefined" :aria-describedby="titleIssue ? `${id}-title-issue` : undefined" @input="textChanged('commercialTitle', $event)">
      <p v-if="titleIssue" :id="`${id}-title-issue`" class="issue" role="alert">{{ titleIssue }}</p>
      <p v-if="titleCounter" class="counter hf-figure" :data-over="titleCounter.over" aria-live="polite">{{ titleCounter.text }}</p>
    </div>
    <div v-if="readonly" class="field">
      <p class="label">Descripción</p>
      <p class="plain" data-field="description">{{ modelValue.description || 'Sin descripción' }}</p>
    </div>
    <div v-else class="field">
      <label :for="`${id}-description`" class="label">Descripción</label>
      <textarea :id="`${id}-description`" class="control" rows="4" :value="modelValue.description" :disabled="disabled"
        :aria-invalid="descriptionIssue ? 'true' : undefined" :aria-describedby="descriptionIssue ? `${id}-description-issue` : undefined" @input="textChanged('description', $event)" />
      <p v-if="descriptionIssue" :id="`${id}-description-issue`" class="issue" role="alert">{{ descriptionIssue }}</p>
      <p v-if="descriptionCounter" class="counter hf-figure" :data-over="descriptionCounter.over" aria-live="polite">{{ descriptionCounter.text }}</p>
    </div>
    <div v-if="modelValue.mediaRefs.length" class="field">
      <p :id="`${id}-media-heading`" class="label">Imágenes vinculadas ({{ modelValue.mediaRefs.length }}) <span class="muted">· Solo lectura</span></p>
      <ul class="media" :aria-labelledby="`${id}-media-heading`">
        <li v-for="(reference, index) in modelValue.mediaRefs" :key="index" data-media-reference>{{ reference }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.document-fields { display: grid; gap: 16px; min-width: 0; color: var(--hf-ink); }
.field { min-width: 0; }
.label { display: block; margin: 0 0 6px; color: var(--hf-ink); font-size: 14px; font-weight: 500; line-height: 1.5; }
.muted { color: var(--hf-muted); font-weight: 400; }
.plain { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.control { box-sizing: border-box; width: 100%; min-height: var(--hf-control-height); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.control[aria-invalid='true'] { border-color: var(--hf-danger); box-shadow: 0 0 0 1px var(--hf-danger); }
.control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.control:disabled { cursor: not-allowed; opacity: .65; }
textarea.control { resize: vertical; min-height: 7rem; }
.issue { margin: 6px 0 0; color: var(--hf-danger); font-size: 13px; line-height: 1.4; }
.counter { margin: 6px 0 0; color: var(--hf-warning); font-size: 12px; font-weight: 600; text-align: right; }
.counter[data-over='true'] { color: var(--hf-danger); }
.media { display: grid; gap: 4px; margin: 0; padding-inline-start: 20px; overflow-wrap: anywhere; font-size: 14px; }
</style>
