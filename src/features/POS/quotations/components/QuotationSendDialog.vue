<script setup lang="ts">
/**
 * `QuotationSendDialog.vue` — S7 / REQ-QTN-010.
 *
 * Confirmation modal for the `POST /quotations/drafts/:id/send` flow. Two
 * action buttons map to the two semantics the backend exposes via the
 * `?email=true|false` query param:
 *
 *   - "Enviar por email" → `send(true)` — renders the PDF, attaches it to
 *     a Resend email addressed to `customer.email`, transitions to SENT.
 *   - "Marcar como enviado" → `send(false)` — just transitions to SENT
 *     (used for in-person delivery where the cashier hands the PDF over
 *     directly).
 *
 * Pre-validation is UI-only: items-empty and customer-without-email both
 * surface a warning so the cashier sees the issue before they submit. The
 * backend still enforces the same checks (422 with structured error codes)
 * — see `useQuotationDraft.sendQuotation` for the error-surface mapping.
 *
 * Parent contract (props down / events up):
 *   - Props: `quotation` (QuotationResponseDto), `open` (boolean),
 *     `send` ((email: boolean) => Promise<unknown>) — the parent's mutation
 *     wrapper so the dialog stays decoupled from TanStack Query.
 *   - Emits: `close` (cancel/dismiss), `sent` (after a successful send).
 *
 * The dialog owns its own loading state via a local `isSending` ref — that
 * lets the buttons toggle disabled without round-tripping through the
 * composable's `isPending`.
 */
import { computed, ref, watch } from 'vue'
import type { QuotationResponseDto } from '../interfaces/quotation.types'

const props = defineProps<{
  quotation: QuotationResponseDto
  open: boolean
  send: (email: boolean) => Promise<unknown>
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'sent'): void
}>()

// ── Local loading state ──────────────────────────────────────────────────────

const isSending = ref(false)

// Reset local state every time the dialog opens so a previous failure doesn't
// leak into the next attempt.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) isSending.value = false
  },
)

// ── Pre-validation (UI surface) ──────────────────────────────────────────────

const hasItems = computed(() => props.quotation.items.length > 0)
const customerEmail = computed(() => props.quotation.customer?.email ?? null)
const hasEmail = computed(() => Boolean(customerEmail.value))

const customerName = computed(() => {
  const c = props.quotation.customer
  if (!c) return ''
  return [c.firstName, c.lastName].filter(Boolean).join(' ')
})

// ── Action handlers ──────────────────────────────────────────────────────────

async function handleSend(email: boolean): Promise<void> {
  if (isSending.value) return
  // Local guard for the "Marcar como enviado" path is intentionally lax: a
  // cashier might want to flip a quotation to SENT even when no email is
  // attached (e.g. handing the PDF over in person). Only the "Enviar por
  // email" path requires an address — which the disabled-when-no-email
  // button already enforces.
  if (email && !hasEmail.value) return

  isSending.value = true
  try {
    await props.send(email)
    emit('sent')
  } catch {
    // Composable already toasted the localized message — leave the dialog
    // open so the cashier can retry or pick the other mode.
  } finally {
    isSending.value = false
  }
}

function handleClose(): void {
  if (isSending.value) return
  emit('close')
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Enviar cotización"
    :dismissible="!isSending"
    :close="!isSending"
    @update:open="(value: boolean) => { if (!value) handleClose() }"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="send-dialog">
        <!-- Items-empty warning -->
        <div
          v-if="!hasItems"
          class="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
          data-testid="no-items-warning"
        >
          <UIcon name="i-lucide-alert-triangle" class="h-4 w-4 mt-0.5 shrink-0" />
          <span>La cotización no tiene productos. Agregá al menos uno antes de enviar.</span>
        </div>

        <!-- Customer-without-email warning -->
        <div
          v-if="!hasEmail"
          class="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
          data-testid="no-email-warning"
        >
          <UIcon name="i-lucide-alert-triangle" class="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <template v-if="customerName">
              {{ customerName }} no tiene email registrado.
            </template>
            <template v-else>
              La cotización no tiene cliente asignado.
            </template>
            No se puede enviar por email — usá "Marcar como enviado" si entregás el PDF en persona.
          </span>
        </div>

        <!-- Customer recap (when both fields are valid) -->
        <div
          v-if="hasItems && hasEmail"
          class="rounded-lg border border-default bg-elevated/40 p-3 text-sm"
          data-testid="send-summary"
        >
          <p class="text-muted">Se enviará un PDF con la cotización a:</p>
          <p class="mt-1 font-medium text-highlighted">{{ customerName }}</p>
          <p class="font-mono text-toned">{{ customerEmail }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="isSending"
          class="w-full sm:w-auto"
          data-testid="send-dialog-cancel"
          @click="handleClose"
        />
        <UButton
          label="Marcar como enviado"
          color="neutral"
          variant="soft"
          :loading="isSending"
          :disabled="!hasItems || isSending"
          class="w-full sm:w-auto"
          data-testid="mark-as-sent-button"
          @click="handleSend(false)"
        />
        <UButton
          label="Enviar por email"
          color="primary"
          :loading="isSending"
          :disabled="!hasItems || !hasEmail || isSending"
          class="w-full sm:w-auto"
          data-testid="send-by-email-button"
          @click="handleSend(true)"
        />
      </div>
    </template>
  </UModal>
</template>