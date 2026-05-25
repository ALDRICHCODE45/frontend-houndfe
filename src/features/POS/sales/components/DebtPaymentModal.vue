<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { formatCentsMXN } from '../utils/currency.utils'
import { useDebtPayment } from '../composables/useDebtPayment'
import type { CollectionPaymentMethod, PaymentEntry } from '../interfaces/sale.types'
import {
  MAX_PAYMENT_ENTRIES,
  addEntry,
  paidSum,
  updateEntry,
  removeEntry,
  validateAggregate,
  validateEntry,
} from '../utils/paymentEntries.utils'
import { newIdempotencyKey } from '../utils/idempotency.utils'
import PaymentMethodTileGrid from './payments/PaymentMethodTileGrid.vue'
import PaymentEntryCard from './payments/PaymentEntryCard.vue'
import PaymentTotalsRow from './payments/PaymentTotalsRow.vue'

const props = defineProps<{
  open: boolean
  debtCents: number
  saleId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const entries = ref<PaymentEntry[]>([])
const idempotencyKey = ref('')
const inlineAggregateError = ref<string | null>(null)

const isDesktop = useMediaQuery('(min-width: 768px)')
const side = computed<'right' | 'bottom'>(() => (isDesktop.value ? 'right' : 'bottom'))
const slideoverUi = computed(() => ({
  content: side.value === 'right' ? 'sm:max-w-lg' : 'h-[92dvh] max-h-[92dvh]',
  body: 'min-h-0 flex-1 overflow-y-auto px-5 py-4',
}))

const {
  submitSafe,
  isSubmitting,
  externalErrorCode,
  shouldClose,
  resetError,
} = useDebtPayment(props.saleId)

const receivedCents = computed(() => paidSum(entries.value))
const aggregateError = computed(() => inlineAggregateError.value ?? validateAggregate(entries.value, props.debtCents) ?? null)
const entryErrors = computed(() => entries.value.map((entry) => validateEntry(entry)))
const hasEntryErrors = computed(() => entryErrors.value.some((errors) => Object.keys(errors).length > 0))
const canSubmit = computed(() => entries.value.length > 0 && !aggregateError.value && !hasEntryErrors.value && !isSubmitting.value)

function resetState() {
  entries.value = []
  idempotencyKey.value = newIdempotencyKey()
  inlineAggregateError.value = null
  resetError()
}

function close() {
  emit('update:open', false)
}

function handleMethodSelect(method: CollectionPaymentMethod): void {
  entries.value = addEntry(entries.value, method, props.debtCents)
}

function handleEntryUpdate(index: number, patch: Partial<Pick<PaymentEntry, 'amountCents' | 'reference'>>): void {
  entries.value = updateEntry(entries.value, index, patch)
}

function handleEntryRemove(index: number): void {
  entries.value = removeEntry(entries.value, index)
}

async function handleSubmit() {
  if (!canSubmit.value) return

  const result = await submitSafe({
    payload: { payments: entries.value },
    idempotencyKey: idempotencyKey.value,
  })

  if (!result) return

  emit('success')
  close()
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    resetState()
  },
)

watch(entries, () => {
  if (!props.open) return
  idempotencyKey.value = newIdempotencyKey()
  inlineAggregateError.value = null
}, { deep: true })

watch(shouldClose, (value) => {
  if (!value) return
  close()
})

watch(externalErrorCode, (code) => {
  if (code === 'PAYMENT_EXCEEDS_DEBT') {
    inlineAggregateError.value = 'El total supera la deuda'
  }
})
</script>

<template>
  <USlideover
    :open="open"
    inset
    :side="side"
    :dismissible="!isSubmitting"
    :close="false"
    :ui="slideoverUi"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex h-full flex-col">
        <div class="shrink-0 space-y-3 border-b border-default px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-lg font-bold text-highlighted">Cobrar deuda</p>
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                DEUDA PENDIENTE {{ formatCentsMXN(debtCents) }}
              </p>
            </div>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              :disabled="isSubmitting"
              @click="close"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <PaymentMethodTileGrid
            :disabled="isSubmitting || entries.length >= MAX_PAYMENT_ENTRIES"
            :max-reached="entries.length >= MAX_PAYMENT_ENTRIES"
            @select="handleMethodSelect"
          />

          <div class="space-y-3">
            <div
              v-if="entries.length === 0"
              class="rounded-xl border border-dashed border-default bg-elevated px-4 py-6 text-center text-sm text-muted"
            >
              Seleccioná un método de pago
            </div>

            <PaymentEntryCard
              v-for="(entry, index) in entries"
              :key="`${entry.method}-${index}`"
              :entry="entry"
              :index="index"
              :remaining="debtCents - receivedCents"
              :validation="entryErrors[index]"
              :disabled="isSubmitting"
              @update="handleEntryUpdate"
              @remove="handleEntryRemove"
            />
          </div>

          <PaymentTotalsRow :total-cents="debtCents" :received-cents="receivedCents" :error="aggregateError ?? undefined" />
        </div>

        <div class="shrink-0 border-t border-default px-5 py-4">
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" :disabled="isSubmitting" @click="close">Cancelar</UButton>
            <UButton
              data-testid="confirm-debt-payment"
              color="primary"
              :disabled="!canSubmit"
              :loading="isSubmitting"
              @click="handleSubmit"
            >
              Confirmar cobro
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
