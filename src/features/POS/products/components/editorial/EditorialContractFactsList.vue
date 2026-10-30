<script setup lang="ts">
import { computed } from 'vue'
import FactsRow from './EditorialContractFactsRow.vue'
import type { EditorialFactsEditingRow, EditorialFactsEditingState } from '../../utils/editorial-contract-facts-editing'
import type { EditorialDeclarationChoice } from '../../utils/editorial-contract-declaration-choices'
import { requestEditorialFactsRowRemoval } from '../../utils/editorial-contract-facts-removal'
import { snapshotJson } from '../../utils/editorial-contract-value'

/** Controlled collection only: caller owns raw rows, unique IDs and qualified
 * subjects/choices. Subject availability is not offered E or save authority.
 * Preserve unavailable/duplicate history; never initialize on render or remount.
 */
const props = defineProps<{ id: string; modelValue: EditorialFactsEditingState;
  subjects: readonly { variantId: string | null; label: string }[]; allowed: readonly EditorialDeclarationChoice[];
  careAllowed: boolean; nextId: () => string; disabled?: boolean; issue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialFactsEditingState] }>()
const described = computed(() => props.issue ? `${props.id}-issue` : undefined)
const displayed = computed(() => props.modelValue.map(row => ({ row,
  subject: props.subjects.find(subject => subject.variantId === row.variantId),
})))
const available = computed(() => props.subjects.map((subject, index) => ({ subject, value: String(index) }))
  .filter(({ subject }) => !props.modelValue.some(row => row.variantId === subject.variantId)))
function add(event: Event) {
  const select = event.target as HTMLSelectElement
  const entry = available.value.find(entry => entry.value === select.value)
  select.value = ''
  if (props.disabled || !entry) return
  emit('update:modelValue', [...props.modelValue, { id: props.nextId(), variantId: entry.subject.variantId,
    presentation: '', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }])
}
function update(id: string, value: EditorialFactsEditingRow) {
  const current = props.modelValue.find(row => row.id === id)
  if (props.disabled || !current || value.id !== id || value.variantId !== current.variantId) return
  // SAFETY: typed JSON row from the child; detach only the changed raw row.
  const detached = snapshotJson(value) as unknown as EditorialFactsEditingRow
  emit('update:modelValue', props.modelValue.map(row => row.id === id ? detached : row))
}
function remove(id: string, requestedId: string) {
  if (props.disabled || id !== requestedId || !props.modelValue.some(row => row.id === id)) return
  let result = requestEditorialFactsRowRemoval(props.modelValue, id)
  if (result.status === 'confirmation_required') {
    if (!window.confirm('¿Eliminar estos hechos? Se perderán los cambios locales.')) return
    result = requestEditorialFactsRowRemoval(props.modelValue, id, true)
  }
  emit('update:modelValue', result.state)
}
</script>

<template>
  <section class="facts-list" :aria-labelledby="`${id}-heading`" :aria-describedby="described">
    <h3 :id="`${id}-heading`" class="heading">Hechos del producto</h3>
    <p v-if="issue" :id="`${id}-issue`" class="notice" role="status">{{ issue }}</p>
    <div v-for="{ row, subject } in displayed" :key="row.id" class="entry" :data-facts-id="row.id">
      <p v-if="!subject" class="notice">No disponible en los sujetos actuales. Los hechos se conservan para su corrección explícita.</p>
      <FactsRow :id="`${id}-row-${row.id}`" :subject-label="subject?.label ?? (row.variantId === null ? 'Producto simple' : row.variantId)"
        :model-value="row" :allowed="allowed" :care-allowed="careAllowed" :next-id="nextId" :disabled="disabled"
        @update:model-value="update(row.id, $event)" @remove="remove(row.id, $event)" />
    </div>
    <div class="add">
      <label :for="`${id}-add`" class="label">Añadir hechos para</label>
      <select :id="`${id}-add`" class="control" value="" :disabled="disabled" :aria-describedby="described" @change="add">
        <option value="">Selecciona un sujeto</option>
        <option v-for="entry in available" :key="entry.value" :value="entry.value">{{ entry.subject.label }}</option>
      </select>
    </div>
  </section>
</template>

<style scoped>
.facts-list { min-width: 0; color: var(--hf-ink); }
.heading { margin: 0 0 16px; color: var(--hf-heading); font-size: 1rem; }
.entry { min-width: 0; margin-bottom: 20px; }
.label { display: block; margin-bottom: 6px; line-height: 1.5; }
.control { box-sizing: border-box; width: 100%; min-height: max(44px, var(--hf-control-height, 44px)); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.control:disabled { cursor: not-allowed; opacity: .65; }
.notice { margin: 0 0 12px; overflow-wrap: anywhere; line-height: 1.5; color: var(--hf-warning); }
</style>
