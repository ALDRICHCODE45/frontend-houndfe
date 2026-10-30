<script setup lang="ts">
import { computed } from 'vue'
import { requestEditorialFamilyChange, type EditorialDocumentEditingState } from '../../utils/editorial-contract-document-editing'

/** Controlled family choice only. Caller owns raw document and qualified families.
 * Restore native selection on cancellation; never retain a second document buffer.
 */
const props = defineProps<{ id: string; modelValue: EditorialDocumentEditingState;
  families: readonly { code: string; label: string }[]; disabled?: boolean; issue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialDocumentEditingState] }>()
const choices = computed(() => props.families.map((family, index) => ({ ...family, value: String(index) })))
const selection = computed(() => props.modelValue.familyCode === null ? 'none'
  : choices.value.find(choice => choice.code === props.modelValue.familyCode)?.value ?? 'unavailable')
const described = computed(() => [props.issue ? `${props.id}-issue` : '', selection.value === 'unavailable' ? `${props.id}-unavailable` : ''].filter(Boolean).join(' ') || undefined)
function changed(event: Event) {
  const select = event.target as HTMLSelectElement, raw = select.value
  select.value = selection.value
  if (props.disabled) return
  const choice = choices.value.find(choice => choice.value === raw)
  if (raw !== 'none' && !choice) return
  const familyCode = raw === 'none' ? null : choice!.code
  let result = requestEditorialFamilyChange(props.modelValue, familyCode)
  if (result.status === 'confirmation_required') {
    if (!window.confirm('¿Cambiar de familia? Se eliminarán los atributos, evidencias y hechos del borrador local. La publicación actual no cambiará.')) return
    result = requestEditorialFamilyChange(props.modelValue, familyCode, true)
  }
  if (result.status === 'changed') emit('update:modelValue', result.state)
}
</script>

<template>
  <div class="family-field">
    <label :for="id" class="label">Familia editorial</label>
    <select :id="id" class="control" :value="selection" :disabled="disabled" :aria-describedby="described" :aria-invalid="!!issue" @change="changed">
      <option value="none">Sin familia</option>
      <option v-if="selection === 'unavailable'" value="unavailable" disabled>{{ modelValue.familyCode }} (No disponible)</option>
      <option v-for="choice in choices" :key="choice.code" :value="choice.value">{{ choice.label }}</option>
    </select>
    <p v-if="selection === 'unavailable'" :id="`${id}-unavailable`" class="notice">No disponible en las familias actuales. La selección existente se conserva.</p>
    <p v-if="issue" :id="`${id}-issue`" class="notice" role="status">{{ issue }}</p>
  </div>
</template>

<style scoped>
.family-field { min-width: 0; color: var(--hf-ink); }
.label { display: block; margin-bottom: 6px; line-height: 1.5; }
.control { box-sizing: border-box; width: 100%; min-height: max(44px, var(--hf-control-height, 44px)); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.control:disabled { cursor: not-allowed; opacity: .65; }
.notice { margin: 8px 0 0; overflow-wrap: anywhere; line-height: 1.5; color: var(--hf-warning); }
</style>
