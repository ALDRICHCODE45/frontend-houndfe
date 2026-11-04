<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EditorialSelect from './EditorialSelect.vue'
import { requestEditorialFamilyChange, type EditorialDocumentEditingState } from '../../utils/editorial-contract-document-editing'

/** Controlled family choice only. Caller owns raw document and qualified families.
 * A change that would clear data waits for the confirm modal; until then (and on cancel) the list
 * keeps showing the current family, and no second document buffer is retained.
 */
const props = defineProps<{ id: string; modelValue: EditorialDocumentEditingState;
  families: readonly { code: string; label: string }[]; disabled?: boolean; issue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialDocumentEditingState] }>()
const choices = computed(() => props.families.map((family, index) => ({ ...family, value: String(index) })))
const selection = computed(() => props.modelValue.familyCode === null ? 'none'
  : choices.value.find(choice => choice.code === props.modelValue.familyCode)?.value ?? 'unavailable')
const items = computed(() => [{ label: 'Sin familia', value: 'none' },
  ...(selection.value === 'unavailable' ? [{ label: `${props.modelValue.familyCode} (No disponible)`, value: 'unavailable', disabled: true }] : []),
  ...choices.value.map(choice => ({ label: choice.label, value: choice.value }))])
const described = computed(() => [props.issue ? `${props.id}-issue` : '', selection.value === 'unavailable' ? `${props.id}-unavailable` : ''].filter(Boolean).join(' ') || undefined)
// The family waiting for the modal's answer: null (no family) is a real target, so "none pending" is undefined.
const pending = shallowRef<{ familyCode: string | null } | undefined>(undefined)
const asking = computed({ get: () => pending.value !== undefined, set: open => { if (!open) pending.value = undefined } })
function changed(raw: string | undefined) {
  if (props.disabled || raw === undefined) return
  const choice = choices.value.find(choice => choice.value === raw)
  if (raw !== 'none' && !choice) return
  const familyCode = raw === 'none' ? null : choice!.code
  const result = requestEditorialFamilyChange(props.modelValue, familyCode)
  if (result.status === 'confirmation_required') pending.value = { familyCode }
  else if (result.status === 'changed') emit('update:modelValue', result.state)
}
function confirmed() {
  const target = pending.value
  pending.value = undefined
  if (!target || props.disabled) return
  const result = requestEditorialFamilyChange(props.modelValue, target.familyCode, true)
  if (result.status === 'changed') emit('update:modelValue', result.state)
}
</script>

<template>
  <div class="family-field">
    <label :for="id" class="label">Familia</label>
    <EditorialSelect :id="id" class="control" label="Familia" :items="items" :model-value="selection" :disabled="disabled"
      :describedby="described" :invalid="!!issue" @update:model-value="changed" />
    <p v-if="selection === 'unavailable'" :id="`${id}-unavailable`" class="notice">No disponible en las familias actuales. La selección existente se conserva.</p>
    <p v-if="issue" :id="`${id}-issue`" class="notice" role="status">{{ issue }}</p>
    <ConfirmModal v-model:open="asking" title="¿Cambiar la familia?" description="Se borran los datos de la familia actual en este borrador."
      confirm-label="Cambiar familia" confirm-color="error" :ui="{ content: 'hf-theme hf-ui' }" @confirm="confirmed" />
  </div>
</template>

<style scoped>
.family-field { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; color: var(--hf-ink); }
.label { margin: 0; color: var(--hf-muted); font-size: 13px; font-weight: 500; white-space: nowrap; }
.control { width: auto; min-width: 11rem; max-width: 100%; }
.notice { flex-basis: 100%; margin: 0; overflow-wrap: anywhere; font-size: 13px; line-height: 1.4; color: var(--hf-warning); }
</style>
