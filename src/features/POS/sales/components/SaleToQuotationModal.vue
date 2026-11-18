<script setup lang="ts">
/**
 * T2 (quotation-sale-conversion, S1 + S3): «Pasar a cotización».
 *
 * Confirm state: a question, the one-line consequence (the sale draft is
 * discarded and kept as a quotation), an optional «Nota para el cliente»
 * (≤ 280, counter) and the action named as a verb. A rejection stays inside
 * the dialog as a human message (with each unavailable line), so the cashier
 * can fix the cause and retry with the same Idempotency-Key.
 *
 * Success: emits `converted` (the view closes the tab). Without dropped
 * adjustments it opens the quotation at once; with them the dialog switches to
 * a summary («No se trasladó: Promo X (−$12.00)») so the cashier can tell the
 * customer before leaving, then offers «Abrir cotización» or «Seguir vendiendo».
 */
import { computed, ref, watch } from 'vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import type { CreateQuotationFromSaleResponse } from '@/features/POS/quotations/interfaces/quotation.types'
import {
  SALE_TO_QUOTATION_NOTES_MAX,
  formatDroppedAdjustment,
  saleToQuotationFailureMessage,
  useSaleToQuotation,
} from '../composables/useSaleToQuotation'
import '../styles/sale-to-quotation.css'

const props = defineProps<{
  open: boolean
  /** Sale draft captured when the dialog opened (survives the tab closing). */
  saleId: string | null
  itemCount: number
  /** Optional teleport boundary marker forwarded to the modal content. */
  portalClass?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  converted: [result: CreateQuotationFromSaleResponse]
  'open-quotation': [quotationId: string]
}>()

const NOTES_ID = 'sale-to-quotation-notes'

const { convert, startAttempt, isPending, failure } = useSaleToQuotation()

const notes = ref('')
const result = ref<CreateQuotationFromSaleResponse | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    notes.value = ''
    result.value = null
    startAttempt()
  },
)

const notesLength = computed(() => notes.value.length)
const notesTooLong = computed(() => notesLength.value > SALE_TO_QUOTATION_NOTES_MAX)
const notesError = computed(() =>
  notesTooLong.value ? `Máximo ${SALE_TO_QUOTATION_NOTES_MAX} caracteres.` : undefined,
)
const failureCopy = computed(() => (failure.value ? saleToQuotationFailureMessage(failure.value) : null))
const submitLabel = computed(() => (failure.value?.code === 'NETWORK' ? 'Reintentar' : 'Pasar a cotización'))
const itemSummary = computed(() =>
  props.itemCount === 1 ? 'Se lleva el producto' : `Se llevan los ${props.itemCount} productos`,
)
const dropped = computed(() => result.value?.droppedAdjustments ?? [])
const showSummary = computed(() => result.value !== null && dropped.value.length > 0)
const title = computed(() => (showSummary.value ? 'Cotización creada' : '¿Pasar esta venta a cotización?'))
const modalUi = computed(() => (props.portalClass ? { content: props.portalClass } : undefined))

function close() {
  emit('update:open', false)
}

async function handleSubmit() {
  if (isPending.value || notesTooLong.value || !props.saleId || result.value) return
  const created = await convert(props.saleId, notes.value)
  if (!created) return
  result.value = created
  emit('converted', created)
  if (created.droppedAdjustments.length === 0) {
    emit('open-quotation', created.quotation.id)
    close()
  }
}

function handleOpenQuotation() {
  if (!result.value) return
  emit('open-quotation', result.value.quotation.id)
  close()
}

function handleOpenChange(value: boolean) {
  if (!value && isPending.value) return
  emit('update:open', value)
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :dismissible="!isPending"
    :close="isPending ? false : { class: 'size-11 justify-center' }"
    :ui="modalUi"
    @update:open="handleOpenChange"
  >
    <template #description>
      <span class="sr-only">
        {{ showSummary ? 'La cotización no incluye algunos descuentos de la venta.' : 'La venta en curso se descarta y queda guardada como cotización.' }}
      </span>
    </template>

    <template #body>
      <div v-if="showSummary" class="sale-to-quotation" data-testid="sale-to-quotation-summary">
        <p class="sale-to-quotation__text" data-testid="sale-to-quotation-dropped-intro">
          La venta ya se descartó. Avísale al cliente que la cotización no incluye estos descuentos:
        </p>
        <ul class="sale-to-quotation__dropped" data-testid="sale-to-quotation-dropped">
          <li
            v-for="(adjustment, index) in dropped"
            :key="`${adjustment.promotionId ?? 'adjustment'}-${index}`"
            class="sale-to-quotation__dropped-item"
            data-testid="sale-to-quotation-dropped-item"
          >
            {{ formatDroppedAdjustment(adjustment) }}
          </li>
        </ul>
      </div>

      <form
        v-else
        id="sale-to-quotation-form"
        class="sale-to-quotation"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <p class="sale-to-quotation__consequence" data-testid="sale-to-quotation-consequence">
          La venta en curso se descarta y queda guardada como cotización.
        </p>
        <p class="sale-to-quotation__text" data-testid="sale-to-quotation-detail">
          {{ itemSummary }}. Si alguna promoción no aplica en cotizaciones, te la mostramos al terminar.
        </p>

        <HfFormField
          label="Nota para el cliente"
          :for="NOTES_ID"
          :hint="`${notesLength} de ${SALE_TO_QUOTATION_NOTES_MAX}`"
          help="Opcional. Aparece en la cotización."
          :error="notesError"
        >
          <UTextarea
            :id="NOTES_ID"
            v-model="notes"
            class="w-full"
            :rows="3"
            autoresize
            :maxrows="6"
            :disabled="isPending"
            placeholder="Ej.: Precios válidos al recoger en sucursal Norte"
            :aria-invalid="notesTooLong ? 'true' : undefined"
            :aria-describedby="`${NOTES_ID}-message`"
          />
        </HfFormField>

        <div
          v-if="failureCopy"
          role="alert"
          class="sale-to-quotation__error"
          data-testid="sale-to-quotation-error"
        >
          <UIcon name="i-lucide-triangle-alert" class="sale-to-quotation__error-icon" aria-hidden="true" />
          <div class="min-w-0">
            <p>{{ failureCopy.message }}</p>
            <ul v-if="failureCopy.lines.length > 0" class="sale-to-quotation__error-lines">
              <li
                v-for="line in failureCopy.lines"
                :key="line"
                data-testid="sale-to-quotation-error-line"
              >
                {{ line }}
              </li>
            </ul>
          </div>
        </div>
      </form>
    </template>

    <template #footer>
      <!-- Stacked full-width on phones with 44px targets; side by side from sm (ConfirmModal footer). -->
      <div v-if="showSummary" class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          label="Seguir vendiendo"
          color="neutral"
          variant="outline"
          class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="sale-to-quotation-stay"
          @click="close"
        />
        <UButton
          label="Abrir cotización"
          icon="i-lucide-file-text"
          class="hf-primary-control min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="sale-to-quotation-open"
          @click="handleOpenQuotation"
        />
      </div>
      <div v-else class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="isPending"
          class="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="sale-to-quotation-cancel"
          @click="close"
        />
        <UButton
          :label="submitLabel"
          :loading="isPending"
          :disabled="notesTooLong || !saleId"
          class="hf-primary-control min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
          data-testid="sale-to-quotation-submit"
          @click="handleSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
