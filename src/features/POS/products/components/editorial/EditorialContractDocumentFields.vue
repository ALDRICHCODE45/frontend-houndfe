<script setup lang="ts">
import { computed } from 'vue'
import EditorialContractFamilyField from './EditorialContractFamilyField.vue'
import EditorialContractAssignmentList from './EditorialContractAssignmentList.vue'
import EditorialContractFactsList from './EditorialContractFactsList.vue'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialDocumentEditingState } from '../../utils/editorial-contract-document-editing'
import { projectEditorialDeclarationChoices } from '../../utils/editorial-contract-declaration-choices'

/** Controlled composition only: the caller owns raw edits, IDs and qualified
 * metadata/current subjects (not offered E). Encoding and save authority remain
 * outside this surface; family/row discard rules belong to the unchanged children.
 */
const props = defineProps<{ id: string; modelValue: EditorialDocumentEditingState;
  vocabulary: EditorialContractVocabulary; subjects: readonly { variantId: string | null; label: string }[];
  nextId: () => string; disabled?: boolean; issue?: string;
  assignmentFeedback?: ReadonlyMap<string, { issue?: string; conservedOptions?: readonly string[] }> }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialDocumentEditingState] }>()
const family = computed(() => props.vocabulary.families.find(entry => entry.code === props.modelValue.familyCode) ?? null)
const allowed = computed(() => projectEditorialDeclarationChoices({ family: family.value, definitions: props.vocabulary.definitions }))
const described = computed(() => props.issue ? `${props.id}-issue` : undefined)
function update(value: EditorialDocumentEditingState) { if (!props.disabled) emit('update:modelValue', value) }
function textChanged(key: 'commercialTitle' | 'description', event: Event) {
  update({ ...props.modelValue, [key]: (event.target as HTMLInputElement | HTMLTextAreaElement).value })
}
function assignmentsChanged(values: EditorialDocumentEditingState['values']) { update({ ...props.modelValue, values }) }
function factsChanged(facts: EditorialDocumentEditingState['facts']) { update({ ...props.modelValue, facts }) }
</script>

<template>
  <section class="document-fields" :aria-labelledby="`${id}-heading`" :aria-describedby="described">
    <h3 :id="`${id}-heading`" class="heading">Documento editorial</h3>
    <p v-if="issue" :id="`${id}-issue`" class="notice" role="status">{{ issue }}</p>
    <div>
      <label :for="`${id}-title`" class="label">Título comercial</label>
      <input :id="`${id}-title`" class="control" type="text" :value="modelValue.commercialTitle" :disabled="disabled"
        :aria-describedby="described" @input="textChanged('commercialTitle', $event)">
    </div>
    <div>
      <label :for="`${id}-description`" class="label">Descripción</label>
      <textarea :id="`${id}-description`" class="control" rows="4" :value="modelValue.description" :disabled="disabled"
        :aria-describedby="described" @input="textChanged('description', $event)" />
    </div>
    <section :aria-labelledby="`${id}-media-heading`">
      <h4 :id="`${id}-media-heading`" class="heading">Referencias de medios ({{ modelValue.mediaRefs.length }})</h4>
      <p class="help">Solo lectura. Las referencias existentes se conservan.</p>
      <ul v-if="modelValue.mediaRefs.length" class="media">
        <li v-for="(reference, index) in modelValue.mediaRefs" :key="index" data-media-reference>{{ reference }}</li>
      </ul>
    </section>
    <EditorialContractFamilyField :id="`${id}-family`" :model-value="modelValue" :families="vocabulary.families"
      :disabled="disabled" @update:model-value="update" />
    <EditorialContractAssignmentList :id="`${id}-assignments`" :model-value="modelValue.values" :family="family"
      :definitions="vocabulary.definitions" :subjects="subjects" :next-id="nextId" :disabled="disabled" :feedback="assignmentFeedback"
      @update:model-value="assignmentsChanged" />
    <EditorialContractFactsList :id="`${id}-facts`" :model-value="modelValue.facts" :subjects="subjects" :allowed="allowed"
      :care-allowed="family?.code === 'care'" :next-id="nextId" :disabled="disabled" @update:model-value="factsChanged" />
  </section>
</template>

<style scoped>
.document-fields { display: grid; gap: 20px; min-width: 0; color: var(--hf-ink); }
.heading { margin: 0; color: var(--hf-heading); font-size: 1rem; }
.label { display: block; margin-bottom: 6px; line-height: 1.5; }
.control { box-sizing: border-box; width: 100%; min-height: max(44px, var(--hf-control-height, 44px)); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.control:disabled { cursor: not-allowed; opacity: .65; }
textarea.control { resize: vertical; }
.notice { margin: 0; overflow-wrap: anywhere; line-height: 1.5; color: var(--hf-warning); }
.help { margin: 8px 0; line-height: 1.5; }
.media { margin: 0; padding-inline-start: 24px; overflow-wrap: anywhere; }
</style>
