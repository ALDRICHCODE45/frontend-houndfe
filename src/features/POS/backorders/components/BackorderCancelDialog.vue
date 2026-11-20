<script setup lang="ts">
/**
 * «Cancelar pedido» confirmation (S5): says what happens (RESERVED units pass to the next customer
 * in line), takes an optional reason (≤ 280) and reports intent. The owner sends the cancel with
 * the version it loaded and decides what to do with the answer; a retryable failure is shown here.
 */
import { computed, ref, watch } from 'vue'
import type { BackorderStatus } from '../interfaces/backorder.types'
import { BACKORDER_REASON_MAX } from '../interfaces/backorder.types'
import { backorderCancelCopy } from '../utils/backorderView'

const props = defineProps<{
  open: boolean
  folio: string
  status: BackorderStatus
  pending: boolean
  /** Message of a failure that leaves the dialog open. */
  error: string | null
}>()

const emit = defineEmits<{ confirm: [reason: string | undefined]; close: [] }>()

const reason = ref('')
// A previous attempt never leaks into the next one.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reason.value = ''
  },
)

/** Design system «Counts only near the limit»: from 90% of the maximum. */
const showCounter = computed(() => reason.value.length >= BACKORDER_REASON_MAX * 0.9)
const atLimit = computed(() => reason.value.length >= BACKORDER_REASON_MAX)

function confirm() {
  if (props.pending) return
  emit('confirm', reason.value.trim() || undefined)
}
function close() {
  if (!props.pending) emit('close')
}
</script>

<template>
  <UModal
    :open="open"
    :title="`Cancelar pedido ${folio}`"
    :dismissible="!pending"
    :close="!pending"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay bo-portal' }"
    @update:open="(value: boolean) => { if (!value) close() }"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="cancel-dialog">
        <p class="text-sm text-[var(--hf-ink)]">{{ backorderCancelCopy(status) }}</p>
        <div class="bo-field">
          <label for="backorder-cancel-reason" class="bo-label">Motivo (opcional)</label>
          <UTextarea
            id="backorder-cancel-reason"
            v-model="reason"
            :maxlength="BACKORDER_REASON_MAX"
            :rows="3"
            class="w-full"
            placeholder="Por ejemplo: el proveedor descontinuó el producto"
            :disabled="pending"
          />
          <span
            v-if="showCounter"
            class="bo-counter hf-figure"
            :class="{ 'bo-counter--limit': atLimit }"
            aria-live="polite"
            data-testid="cancel-counter"
          >{{ reason.length }} / {{ BACKORDER_REASON_MAX }}</span>
        </div>
        <p v-if="error" class="bo-warning" role="alert" data-testid="cancel-error">{{ error }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          label="Volver"
          color="neutral"
          variant="outline"
          :disabled="pending"
          class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="cancel-dialog-back"
          @click="close"
        />
        <UButton
          label="Cancelar pedido"
          color="error"
          :loading="pending"
          class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="cancel-dialog-confirm"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
