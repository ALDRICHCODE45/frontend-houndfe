<script setup lang="ts">
/**
 * `QuotationCancelDialog.vue` — S7 / REQ-QTN-011.
 *
 * Confirmation modal for `POST /quotations/drafts/:id/cancel`. The backend
 * requires a `cancelReason` from a closed enum (CUSTOMER_REQUEST,
 * PRICE_OBJECTION, EXPIRED, OTHER) — the dialog surfaces a 4-radio selector
 * and gates the confirm button until one is picked.
 *
 * Parent contract (props down / events up):
 *   - Props: `quotation` (QuotationResponseDto), `open` (boolean),
 *     `cancel` ((reason: CancelReason) => Promise<unknown>).
 *   - Emits: `close` (cancel/dismiss), `cancelled` (after a successful cancel).
 *
 * Loading state lives in a local `isCancelling` ref so the parent doesn't
 * need to expose the composable's `isPending`. Error path: the parent
 * composable already toasts; we leave the dialog open so the cashier can
 * retry or change the reason.
 */
import { computed, ref, watch } from 'vue'
import type { CancelReason, QuotationResponseDto } from '../interfaces/quotation.types'
import { CANCEL_REASONS, CANCEL_REASON_LABEL } from '../constants/quotation.constants'

const props = defineProps<{
  quotation: QuotationResponseDto
  open: boolean
  cancel: (reason: CancelReason) => Promise<unknown>
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'cancelled'): void
}>()

// ── Local state ──────────────────────────────────────────────────────────────

const selectedReason = ref<CancelReason | null>(null)
const isCancelling = ref(false)

// Reset the selected reason every time the dialog opens so a previous attempt
// doesn't leak into the next one.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selectedReason.value = null
      isCancelling.value = false
    }
  },
)

// ── Derived ──────────────────────────────────────────────────────────────────

/** Ordered list of reason options (stable order so the test-id mapping is
 *  deterministic). The label lives in `constants/quotation.constants.ts`. */
const reasonOptions = computed<Array<{ value: CancelReason; label: string }>>(() => {
  const order: CancelReason[] = [
    CANCEL_REASONS.CUSTOMER_REQUEST,
    CANCEL_REASONS.PRICE_OBJECTION,
    CANCEL_REASONS.EXPIRED,
    CANCEL_REASONS.OTHER,
  ]
  return order.map((value) => ({ value, label: CANCEL_REASON_LABEL[value] }))
})

const canConfirm = computed(() => selectedReason.value !== null && !isCancelling.value)

// ── Handlers ─────────────────────────────────────────────────────────────────

function handleReasonChange(value: CancelReason): void {
  selectedReason.value = value
}

async function handleConfirm(): Promise<void> {
  if (!selectedReason.value || isCancelling.value) return
  isCancelling.value = true
  try {
    await props.cancel(selectedReason.value)
    emit('cancelled')
  } catch {
    // Composable toasted the localized message — leave the dialog open so the
    // cashier can retry or pick a different reason.
  } finally {
    isCancelling.value = false
  }
}

function handleClose(): void {
  if (isCancelling.value) return
  emit('close')
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Cancelar cotización"
    :dismissible="!isCancelling"
    :close="!isCancelling"
    @update:open="(value: boolean) => { if (!value) handleClose() }"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="cancel-dialog">
        <p class="text-sm text-muted">
          Seleccioná el motivo de cancelación. Esta acción es terminal y no se
          puede deshacer.
        </p>

        <div role="radiogroup" class="flex flex-col gap-2">
          <label
            v-for="option in reasonOptions"
            :key="option.value"
            class="flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-sm cursor-pointer hover:bg-elevated"
          >
            <input
              type="radio"
              name="cancel-reason"
              :value="option.value"
              :checked="selectedReason === option.value"
              class="accent-primary"
              :data-testid="`reason-option-${option.value}`"
              @change="handleReasonChange(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="Volver"
          color="neutral"
          variant="outline"
          :disabled="isCancelling"
          data-testid="cancel-dialog-cancel"
          @click="handleClose"
        />
        <UButton
          label="Cancelar cotización"
          color="error"
          :loading="isCancelling"
          :disabled="!canConfirm"
          data-testid="cancel-dialog-confirm"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>