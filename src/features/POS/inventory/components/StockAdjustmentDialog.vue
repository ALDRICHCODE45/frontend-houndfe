<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { AdjustmentDialogTarget, AdjustmentInput, AdjustmentReason, AdjustmentResult } from '../interfaces/inventory.types'
import { useInventoryContext } from '../composables/useInventoryAccess'
import { useStockAdjustment } from '../composables/useStockAdjustment'
import {
  ADJUSTMENT_REASONS, NOTE_MAX, adjustmentIssueCopy, countDelta, normalizeNote, signedDelta, validateAdjustment,
  type AdjustmentIssue,
} from '../utils/adjustment'

type Mode = 'add' | 'remove' | 'count'
const props = defineProps<{ open: boolean; target: AdjustmentDialogTarget }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  applied: [result: AdjustmentResult]
  // The shown stock may be stale (version conflict, unknown result): re-read it.
  reload: []
}>()

const MODES = [
  { label: 'Sumar', value: 'add' },
  { label: 'Restar', value: 'remove' },
  { label: 'Conteo físico', value: 'count' },
]
const form = reactive({ mode: 'add' as Mode, quantity: '', reason: '' as AdjustmentReason | '', note: '' })
const submitted = ref(false)
const adjustment = useStockAdjustment(useInventoryContext())
const locked = computed(() => adjustment.isPending.value || adjustment.hasUncertainResult.value)

function reset() {
  Object.assign(form, { mode: 'add', quantity: '', reason: '', note: '' })
  submitted.value = false
  adjustment.abandon()
}
watch(() => props.open, (open) => { if (open) reset() })
// Editing after a rejection clears it; an uncertain attempt locks the fields instead.
watch(() => [form.mode, form.quantity, form.reason, form.note], () => {
  if (!adjustment.hasUncertainResult.value && !adjustment.isPending.value) adjustment.abandon()
})
// «Conteo físico» is a count: its reason starts as such, and stays editable.
watch(() => form.mode, (mode) => { if (mode === 'count') form.reason = 'PHYSICAL_COUNT' })

const counted = computed(() => form.mode === 'count')
const quantity = computed(() => /^\d+$/.test(form.quantity.trim()) ? Number(form.quantity.trim()) : null)
const delta = computed(() => {
  if (quantity.value === null) return null
  return counted.value ? countDelta(quantity.value, props.target.quantity) : signedDelta(form.mode as 'add' | 'remove', quantity.value)
})
const resulting = computed(() => delta.value === null ? null : props.target.quantity + delta.value)

function build(patch: Partial<AdjustmentInput> = {}): AdjustmentInput {
  const { productId, lotId, variantId } = props.target
  return {
    target: { productId, ...(lotId !== undefined && { lotId }), ...(variantId !== undefined && { variantId }) },
    expectedVersion: props.target.version, delta: delta.value ?? 0, reason: form.reason as AdjustmentReason,
    ...(normalizeNote(form.note) !== undefined && { note: form.note }), ...patch,
  }
}
// Each field reports its own issue, so one submit shows every problem at once.
const quantityIssue = computed<AdjustmentIssue | 'REQUIRED' | 'SAME_COUNT' | null>(() => {
  if (quantity.value === null) return form.quantity.trim() ? 'DELTA_INVALID' : 'REQUIRED'
  const issue = validateAdjustment(build({ reason: 'DAMAGE', note: undefined }), props.target.quantity)
  return issue === 'DELTA_ZERO' && counted.value ? 'SAME_COUNT' : issue
})
const reasonIssue = computed(() => form.reason ? null : 'REASON_INVALID' as const)
// The note rules live in validateAdjustment; a neutral delta isolates them from the quantity.
const noteIssue = computed(() => {
  if (!form.reason) return null
  const issue = validateAdjustment(build({ delta: 1 }))
  return issue === 'NOTE_REQUIRED' || issue === 'NOTE_TOO_LONG' ? issue : null
})
function quantityCopy(issue: NonNullable<typeof quantityIssue.value>) {
  if (issue === 'REQUIRED') return counted.value ? 'Escribe la cantidad contada.' : 'Escribe una cantidad.'
  if (issue === 'SAME_COUNT') return 'La cantidad contada es igual al stock actual.'
  return adjustmentIssueCopy(issue)
}
const serverOnQuantity = computed(() => adjustment.errorCode.value === 'INSUFFICIENT_STOCK')
const quantityError = computed(() => {
  if (serverOnQuantity.value) return adjustment.errorMessage.value ?? undefined
  return submitted.value && quantityIssue.value ? quantityCopy(quantityIssue.value) : undefined
})
const reasonError = computed(() => submitted.value && reasonIssue.value ? adjustmentIssueCopy(reasonIssue.value) : undefined)
const noteError = computed(() => submitted.value && noteIssue.value ? adjustmentIssueCopy(noteIssue.value) : undefined)
const alertMessage = ref<string | null>(null)
const alertText = computed(() => {
  if (serverOnQuantity.value) return null
  return adjustment.errorMessage.value ?? alertMessage.value
})

const noteLength = computed(() => [...form.note.trim()].length)
// A counter only earns its place from 90% of the limit.
const nearLimit = computed(() => noteLength.value >= NOTE_MAX * 0.9)
const countText = computed(() => `${noteLength.value.toLocaleString('es-MX')} / ${NOTE_MAX.toLocaleString('es-MX')}`)
const deltaText = computed(() => {
  if (delta.value === null) return null
  if (delta.value === 0) return 'Sin diferencia'
  return `Diferencia: ${delta.value > 0 ? '+' : '−'}${Math.abs(delta.value).toLocaleString('es-MX')}`
})

async function submit() {
  if (adjustment.isPending.value) return
  alertMessage.value = null
  if (adjustment.hasUncertainResult.value) return finish(await adjustment.retry())
  submitted.value = true
  if (quantityIssue.value || reasonIssue.value || noteIssue.value) return
  finish(await adjustment.adjust(build()))
}
function finish(outcome: Awaited<ReturnType<typeof adjustment.adjust>>) {
  if (outcome.status === 'applied') {
    emit('applied', outcome.result)
    emit('update:open', false)
  } else if (outcome.status === 'rejected' && outcome.code === 'STOCK_VERSION_CONFLICT') {
    emit('reload')
  } else if (outcome.status === 'blocked') {
    alertMessage.value = 'No tienes permiso para ajustar el stock.'
  }
}
function review() {
  adjustment.abandon()
  emit('reload')
}
function onOpenChange(value: boolean) {
  if (!value && adjustment.isPending.value) return
  if (!value && adjustment.hasUncertainResult.value) emit('reload')
  if (!value) adjustment.abandon()
  emit('update:open', value)
}
</script>

<template>
  <UModal
    :open="open"
    title="Ajustar stock"
    :dismissible="!adjustment.isPending.value"
    :close="!adjustment.isPending.value"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay inventory-portal' }"
    @update:open="onOpenChange"
  >
    <template #description>
      <span class="sr-only">Registra una entrada o salida de stock con su motivo.</span>
    </template>

    <template #body>
      <form class="inventory-adjust" novalidate @submit.prevent="submit">
        <dl data-testid="adjustment-summary" class="inventory-summary">
          <div><dt>Producto</dt><dd>{{ target.productName }}</dd></div>
          <div><dt>Ubicación</dt><dd>{{ target.bucketLabel }}</dd></div>
          <div><dt>Stock actual</dt><dd class="hf-figure">{{ target.quantity.toLocaleString('es-MX') }}</dd></div>
          <div v-if="resulting !== null && !quantityIssue" data-testid="adjustment-result">
            <dt>Quedará en</dt><dd class="hf-figure">{{ resulting.toLocaleString('es-MX') }}</dd>
          </div>
        </dl>

        <URadioGroup
          v-model="form.mode"
          data-testid="adjustment-mode"
          legend="Tipo de ajuste"
          orientation="horizontal"
          :items="MODES"
          value-key="value"
          :disabled="locked"
        />

        <UFormField :label="counted ? 'Cantidad contada' : 'Cantidad'" name="quantity" required :error="quantityError">
          <UInput
            v-model="form.quantity"
            name="quantity"
            inputmode="numeric"
            autocomplete="off"
            class="w-full"
            :disabled="locked"
            :aria-invalid="quantityError ? 'true' : undefined"
          />
          <template v-if="quantityError" #error>
            <span data-testid="quantity-error">{{ quantityError }}</span>
          </template>
          <template v-if="counted && deltaText && !quantityError" #hint>
            <span data-testid="count-delta" class="hf-figure">{{ deltaText }}</span>
          </template>
        </UFormField>

        <UFormField label="Motivo" name="reason" required :error="reasonError">
          <USelect
            v-model="form.reason"
            name="reason"
            :items="[...ADJUSTMENT_REASONS]"
            value-key="value"
            label-key="label"
            placeholder="Selecciona un motivo"
            class="w-full"
            :disabled="locked"
            :ui="{ content: 'hf-theme hf-ui hf-form-overlay inventory-portal' }"
          />
          <template v-if="reasonError" #error>
            <span data-testid="reason-error">{{ reasonError }}</span>
          </template>
        </UFormField>

        <UFormField label="Nota" name="note" :required="form.reason === 'OTHER'" :error="noteError">
          <UTextarea v-model="form.note" name="note" :rows="3" class="w-full" :disabled="locked" />
          <template v-if="noteError" #error>
            <span data-testid="note-error">{{ noteError }}</span>
          </template>
          <p
            v-if="nearLimit"
            data-testid="note-counter"
            class="inventory-count"
            :class="{ 'at-limit': noteLength >= NOTE_MAX }"
            aria-live="polite"
          >{{ countText }}</p>
        </UFormField>

        <p v-if="alertText" role="alert" class="inventory-alert">{{ alertText }}</p>
        <button type="submit" hidden tabindex="-1" aria-hidden="true" />
      </form>
    </template>

    <template #footer>
      <div class="inventory-actions">
        <UButton
          v-if="adjustment.hasUncertainResult.value && !adjustment.isPending.value"
          data-testid="adjustment-review"
          color="neutral"
          variant="outline"
          label="Revisar stock"
          @click="review"
        />
        <UButton
          data-testid="adjustment-submit"
          class="hf-primary-control"
          type="button"
          :label="adjustment.hasUncertainResult.value ? 'Reintentar' : 'Aplicar ajuste'"
          :loading="adjustment.isPending.value"
          :disabled="adjustment.isPending.value"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.inventory-adjust { display: grid; gap: 16px; color: var(--hf-ink); }
.inventory-summary { display: grid; gap: 8px; margin: 0; padding: 12px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface-muted); font-size: 13px; }
.inventory-summary > div { display: flex; justify-content: space-between; gap: 12px; min-width: 0; }
.inventory-summary dt { color: var(--hf-muted); }
.inventory-summary dd { margin: 0; min-width: 0; font-weight: 600; color: var(--hf-heading); text-align: right; overflow-wrap: anywhere; }
.inventory-count { margin-top: 4px; font-size: 12px; font-weight: 600; color: var(--hf-warning); text-align: right; }
.inventory-count.at-limit { color: var(--hf-danger); }
.inventory-alert { margin: 0; padding: 12px; border: 1px solid var(--hf-danger-border); border-radius: 8px; background: var(--hf-danger-soft); color: var(--hf-danger); font-size: 13px; }
.inventory-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 12px; width: 100%; }
</style>
