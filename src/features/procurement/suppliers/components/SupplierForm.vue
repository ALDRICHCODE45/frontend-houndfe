<script setup lang="ts">
import { reactive, shallowRef } from 'vue'
import type { SupplierInput } from '../interfaces/supplier.types'
const props = defineProps<{ initial: SupplierInput; disabled?: boolean; editing?: boolean }>()
const emit = defineEmits<{ save: [input: SupplierInput]; cancel: [] }>()
// The parent mounts a fresh form per explicit open; background reads never
// replace this local buffer or silently advance its expected version.
const form = reactive({ displayName: props.initial.displayName, termsText: props.initial.termsText ?? '' })
const validation = shallowRef('')
function submit() {
  if (props.disabled) return
  if (!form.displayName.trim() || [...form.displayName].length > 200) {
    validation.value = 'El nombre es obligatorio y debe tener hasta 200 caracteres.'
    return
  }
  if ([...form.termsText].length > 4000) {
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
      <input id="supplier-name" v-model="form.displayName" name="displayName" autocomplete="organization" :disabled="disabled" aria-required="true" aria-describedby="supplier-name-help" />
      <p id="supplier-name-help">Nombre comercial. Hasta 200 caracteres.</p>
    </div>
    <div class="supplier-field">
      <label for="supplier-terms">Condiciones acordadas <span class="optional">(opcional)</span></label>
      <textarea id="supplier-terms" v-model="form.termsText" name="termsText" rows="6" :disabled="disabled" aria-describedby="supplier-terms-help" />
      <p id="supplier-terms-help">Notas de referencia, hasta 4000 caracteres. No generan pagos ni deuda.</p>
    </div>
    <p class="supplier-state">Estado: {{ initial.status === 'ACTIVE' ? 'Activo' : 'Archivado' }}</p>
    <p v-if="validation" role="alert" class="supplier-validation">{{ validation }}</p>
    <div class="supplier-form-actions">
      <button type="button" data-testid="cancel" class="supplier-secondary" :disabled="disabled" @click="emit('cancel')">Cancelar</button>
      <button type="submit" class="hf-primary-control" :disabled="disabled">{{ disabled ? 'Espera…' : editing ? 'Guardar cambios' : 'Crear proveedor' }}</button>
    </div>
  </form>
</template>

<style scoped>
.supplier-form { display: grid; gap: 24px; color: var(--hf-ink); }
.supplier-field { display: grid; gap: 8px; min-width: 0; }
.supplier-field label { font-weight: 600; font-size: 14px; }
.supplier-field input, .supplier-field textarea { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.supplier-field textarea { resize: vertical; }
.supplier-field p, .supplier-state, .optional { color: var(--hf-muted); font-size: 13px; line-height: 1.5; }
.supplier-validation { color: var(--hf-warning); background: var(--hf-warning-soft); padding: 12px; border-radius: 6px; }
.supplier-form-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--hf-border); padding-top: 20px; }
.supplier-secondary { min-height: 44px; padding: 8px 16px; border: 1px solid var(--hf-field-border); border-radius: 6px; background: var(--hf-surface); }
.supplier-field input:focus-visible, .supplier-field textarea:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button:disabled, input:disabled, textarea:disabled { opacity: .6; cursor: not-allowed; }
</style>
