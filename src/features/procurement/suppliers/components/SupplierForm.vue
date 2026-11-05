<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import type { SupplierInput } from '../interfaces/supplier.types'
const NAME_MAX = 200
const TERMS_MAX = 4000
const props = defineProps<{ initial: SupplierInput; disabled?: boolean; editing?: boolean }>()
const emit = defineEmits<{ save: [input: SupplierInput] }>()
// The parent mounts a fresh form per explicit open; background reads never
// replace this local buffer or silently advance its expected version.
const form = reactive({ displayName: props.initial.displayName, termsText: props.initial.termsText ?? '' })
const validation = shallowRef('')
const nameLength = computed(() => [...form.displayName].length)
const termsLength = computed(() => [...form.termsText].length)
// A counter only earns its place from 90% of the limit.
const nearLimit = (length: number, max: number) => length >= max * 0.9
const formatCount = (length: number, max: number) => `${length.toLocaleString('es-MX')} / ${max.toLocaleString('es-MX')}`
function submit() {
  if (props.disabled) return
  if (!form.displayName.trim() || nameLength.value > NAME_MAX) {
    validation.value = 'El nombre es obligatorio y debe tener hasta 200 caracteres.'
    return
  }
  if (termsLength.value > TERMS_MAX) {
    validation.value = 'Las condiciones deben tener hasta 4000 caracteres.'
    return
  }
  validation.value = ''
  emit('save', { displayName: form.displayName, termsText: form.termsText === '' ? null : form.termsText, status: props.initial.status })
}
</script>

<template>
  <form class="supplier-form" @submit.prevent="submit">
    <div class="supplier-field">
      <label for="supplier-name">Nombre del proveedor <span aria-hidden="true">*</span></label>
      <input id="supplier-name" v-model="form.displayName" name="displayName" autocomplete="organization" :disabled="disabled" aria-required="true" />
      <p v-if="nearLimit(nameLength, NAME_MAX)" data-field="displayName" class="supplier-count" :class="{ 'at-limit': nameLength >= NAME_MAX }" aria-live="polite">{{ formatCount(nameLength, NAME_MAX) }}</p>
    </div>
    <div class="supplier-field">
      <label for="supplier-terms">Condiciones acordadas <span class="optional">(opcional)</span></label>
      <textarea id="supplier-terms" v-model="form.termsText" name="termsText" rows="6" :disabled="disabled" />
      <p v-if="nearLimit(termsLength, TERMS_MAX)" data-field="termsText" class="supplier-count" :class="{ 'at-limit': termsLength >= TERMS_MAX }" aria-live="polite">{{ formatCount(termsLength, TERMS_MAX) }}</p>
    </div>
    <p v-if="validation" role="alert" class="supplier-validation">{{ validation }}</p>
    <div class="supplier-form-actions">
      <button type="submit" class="hf-primary-control" :disabled="disabled">{{ disabled ? 'Espera…' : editing ? 'Guardar cambios' : 'Crear proveedor' }}</button>
    </div>
  </form>
</template>

<style scoped>
.supplier-form { display: grid; gap: 24px; color: var(--hf-ink); }
.supplier-field { display: grid; gap: 8px; min-width: 0; }
.supplier-field label { font-weight: 600; font-size: 14px; }
.supplier-field input, .supplier-field textarea { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.supplier-field textarea { resize: vertical; }
.supplier-field input:hover:not(:disabled), .supplier-field textarea:hover:not(:disabled) { border-color: var(--hf-field-border); }
.optional { color: var(--hf-muted); font-size: 13px; }
.supplier-count { font-size: 12px; font-weight: 600; color: var(--hf-warning); text-align: right; }
.supplier-count.at-limit { color: var(--hf-danger); }
.supplier-validation { color: var(--hf-warning); background: var(--hf-warning-soft); padding: 12px; border-radius: 6px; }
.supplier-form-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--hf-border); padding-top: 20px; }
.supplier-field input:focus-visible, .supplier-field textarea:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button:disabled, input:disabled, textarea:disabled { opacity: .6; cursor: not-allowed; }
</style>
