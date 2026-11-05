<script setup lang="ts">
import { computed } from 'vue'
import HfFieldGrid from '@/core/shared/components/form/HfFieldGrid.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import type { EditorialDocumentEditingState } from '../../utils/editorial-contract-document-editing'

/** The document's own text: commercial title, description and the linked media, as the fields of the
 * «Título y descripción» card. Controlled: the caller owns the raw document, the IDs and the save. The
 * limits are the ones the draft is checked against (200 and 20,000 characters), counted as «N de 200».
 * Media references stay read-only and are never fetched.
 */
const props = defineProps<{ id: string; modelValue: EditorialDocumentEditingState; disabled?: boolean; readonly?: boolean;
  titleIssue?: string; descriptionIssue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialDocumentEditingState] }>()
const TITLE_MAX = 200
const DESCRIPTION_MAX = 20000
const units = (value: string | null) => [...(value ?? '')].length
const counter = (value: string | null, max: number) => `${units(value).toLocaleString('es-MX')} de ${max.toLocaleString('es-MX')}`
const titleCounter = computed(() => counter(props.modelValue.commercialTitle, TITLE_MAX))
const descriptionCounter = computed(() => counter(props.modelValue.description, DESCRIPTION_MAX))
const titleOver = computed(() => units(props.modelValue.commercialTitle) > TITLE_MAX)
const descriptionOver = computed(() => units(props.modelValue.description) > DESCRIPTION_MAX)
function textChanged(key: 'commercialTitle' | 'description', event: Event) {
  if (props.disabled || props.readonly) return
  emit('update:modelValue', { ...props.modelValue, [key]: (event.target as HTMLInputElement | HTMLTextAreaElement).value })
}
</script>

<template>
  <HfFieldGrid class="document-fields">
    <div span="full">
      <HfFormField v-if="readonly" label="Título comercial" :label-id="`${id}-title-label`">
        <p class="plain" data-field="title" :data-muted="!modelValue.commercialTitle || undefined">{{ modelValue.commercialTitle || 'Sin título' }}</p>
      </HfFormField>
      <HfFormField v-else label="Título comercial" :for="`${id}-title`" :hint="titleCounter" :error="titleIssue">
        <input :id="`${id}-title`" class="control" type="text" :value="modelValue.commercialTitle" :disabled="disabled" placeholder="Cómo lo verá tu cliente"
          :aria-invalid="titleIssue || titleOver ? 'true' : undefined" :aria-describedby="titleIssue ? `${id}-title-message` : undefined" @input="textChanged('commercialTitle', $event)">
      </HfFormField>
    </div>
    <div span="full">
      <HfFormField v-if="readonly" label="Descripción" :label-id="`${id}-description-label`">
        <p class="plain" data-field="description" :data-muted="!modelValue.description || undefined">{{ modelValue.description || 'Sin descripción' }}</p>
      </HfFormField>
      <HfFormField v-else label="Descripción" :for="`${id}-description`" :hint="descriptionCounter" :error="descriptionIssue">
        <textarea :id="`${id}-description`" class="control" rows="3" :value="modelValue.description" :disabled="disabled"
          placeholder="Cuéntale a tu cliente para qué sirve y qué lo hace distinto"
          :aria-invalid="descriptionIssue || descriptionOver ? 'true' : undefined" :aria-describedby="descriptionIssue ? `${id}-description-message` : undefined"
          @input="textChanged('description', $event)" />
      </HfFormField>
    </div>
    <div v-if="modelValue.mediaRefs.length" span="full">
      <p :id="`${id}-media-heading`" class="label">Imágenes vinculadas ({{ modelValue.mediaRefs.length }}) <span class="muted">· Solo lectura</span></p>
      <ul class="media" :aria-labelledby="`${id}-media-heading`">
        <li v-for="(reference, index) in modelValue.mediaRefs" :key="index" data-media-reference>{{ reference }}</li>
      </ul>
    </div>
  </HfFieldGrid>
</template>

<style scoped>
.document-fields { color: var(--hf-ink); }
.label { margin: 0 0 6px; color: var(--hf-ink); font-size: 13px; font-weight: 500; }
.muted { color: var(--hf-muted); font-weight: 400; }
.plain { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; }
.plain[data-muted] { color: var(--hf-muted); }
.control { box-sizing: border-box; display: block; width: 100%; height: 44px; padding: 0 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control);
  background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; transition: border-color .12s; }
textarea.control { height: auto; min-height: 88px; padding: 9px 12px; line-height: 1.5; resize: vertical; }
.control::placeholder { color: var(--hf-muted); opacity: 1; }
.control:hover:not(:disabled) { border-color: var(--hf-field-border); }
.control[aria-invalid='true'] { border-color: var(--hf-danger); }
.control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.control:disabled { cursor: not-allowed; background: var(--hf-surface-muted); }
.media { display: grid; gap: 4px; margin: 0; padding-inline-start: 20px; overflow-wrap: anywhere; font-size: 14px; }
@media (min-width: 768px) { input.control { height: 40px; } }
</style>
