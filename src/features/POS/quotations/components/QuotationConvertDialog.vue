<script setup lang="ts">
/**
 * `QuotationConvertDialog.vue` — odd T3 / S4-S5: confirm «Convertir en venta» and show why the
 * backend refused it.
 *
 * Presentational: the parent owns `useConvertQuotationToSale` and passes `pending` / `failure`.
 *   Props ↓  open, pending, failure (decoded rejection or null), confirmLabel, portalClass
 *   Events ↑ confirm (convert, or retry), close, view-sale (saleId of QUOTATION_ALREADY_CONVERTED)
 *
 * Without a failure the body states the pricing rule. With one it shows the Spanish title and line
 * (`conversionFailureCopy`), the unavailable lines with their reason, «Ver venta» when the backend
 * names the sale, and «Reintentar» only when pressing again can succeed.
 */
import { computed } from 'vue'
import type { QuotationConversionFailure } from '../interfaces/quotation.types'
import {
  CONVERT_TO_SALE_RULE,
  conversionFailureCopy,
} from '../composables/useConvertQuotationToSale'

const props = withDefaults(
  defineProps<{
    open: boolean
    pending?: boolean
    failure?: QuotationConversionFailure | null
    confirmLabel?: string
    portalClass?: string
  }>(),
  {
    pending: false,
    failure: null,
    confirmLabel: 'Convertir en venta',
    portalClass: 'quotations-workspace-portal',
  },
)

const emit = defineEmits<{
  confirm: []
  close: []
  'view-sale': [saleId: string]
}>()

const failureCopy = computed(() => (props.failure ? conversionFailureCopy(props.failure) : null))

const showConfirm = computed(() => !failureCopy.value || failureCopy.value.retryable)
const confirmText = computed(() => (failureCopy.value ? 'Reintentar' : props.confirmLabel))

function handleClose(): void {
  if (props.pending) return
  emit('close')
}

function handleViewSale(): void {
  const saleId = failureCopy.value?.saleId
  if (saleId) emit('view-sale', saleId)
}
</script>

<template>
  <UModal
    :open="props.open"
    title="¿Convertir en venta?"
    :dismissible="!props.pending"
    :close="!props.pending"
    :ui="{ content: `hf-theme hf-ui hf-form-overlay ${props.portalClass}` }"
    @update:open="
      (value: boolean) => {
        if (!value) handleClose()
      }
    "
  >
    <template #body>
      <div class="flex flex-col gap-3 text-sm" data-testid="convert-dialog">
        <p v-if="!failureCopy" class="text-muted" data-testid="convert-dialog-rule">
          {{ CONVERT_TO_SALE_RULE }}
        </p>
        <div
          v-else
          role="alert"
          class="convert-dialog-failure"
          data-testid="convert-dialog-failure"
        >
          <p class="convert-dialog-failure-title">{{ failureCopy.title }}</p>
          <p class="mt-1 text-muted">{{ failureCopy.description }}</p>
          <ul v-if="failureCopy.lines.length > 0" class="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li v-for="line in failureCopy.lines" :key="line" data-testid="convert-dialog-line">
              {{ line }}
            </li>
          </ul>
          <button
            v-if="failureCopy.saleId"
            type="button"
            class="quotation-inline-link mt-2"
            data-testid="convert-dialog-view-sale"
            @click="handleViewSale"
          >Ver venta</button>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          :label="failureCopy ? 'Cerrar' : 'Volver'"
          color="neutral"
          variant="outline"
          :disabled="props.pending"
          class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="convert-dialog-cancel"
          @click="handleClose"
        />
        <UButton
          v-if="showConfirm"
          :label="confirmText"
          color="primary"
          :loading="props.pending"
          class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="convert-dialog-confirm"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
/* Teleported: the detail view's scoped banner classes do not reach here. */
.convert-dialog-failure {
  border: 1px solid var(--hf-danger-border);
  border-radius: var(--hf-radius-card);
  background: var(--hf-danger-soft);
  padding: 16px;
}
.convert-dialog-failure-title {
  color: var(--hf-danger);
  font-weight: 600;
}
.quotation-inline-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--hf-action);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.quotation-inline-link:focus-visible {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
