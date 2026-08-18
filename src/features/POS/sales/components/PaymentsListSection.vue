<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SaleDetailPayment } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatSaleDate } from '../utils/saleDate.utils'
import { getMethodMeta } from '../utils/paymentMethodMeta'
import { shouldShowEditReference } from '../utils/referenceEditAffordance'
import EditReferenceSlideover from './EditReferenceSlideover.vue'

/**
 * sales-pos-charge WU-B.4 — presentational list of the payments attached to
 * a sale. The component is presentation + local slideover orchestration; the
 * mutation lives in the parent view (`SaleDetailView.vue`) per design D6
 * ("PaymentsListSection is presentational; the view owns the mutation").
 *
 * Contract (REQ-NEW-3, REQ-NEW-4, REQ-NEW-5):
 *   - one row per payment with method / amount / reference / paidAt
 *   - "Editar referencia" affordance ONLY for rows where
 *     `shouldShowEditReference` is true (non-CASH + has paymentId)
 *   - empty state when no payments AND not loading
 *   - skeleton rows while loading
 *   - reference truncation at 20 chars (tooltip shows the full value)
 */
const props = withDefaults(
  defineProps<{
    payments: SaleDetailPayment[]
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)

const emit = defineEmits<{
  submit: [payload: { paymentId: string; reference: string | null }]
}>()

const editingPaymentId = ref<string | null>(null)
const editingReference = ref<string | null>(null)
const editingMethod = ref<string>('')

const editingPayment = computed(() =>
  editingPaymentId.value
    ? props.payments.find((payment) => payment.paymentId === editingPaymentId.value) ?? null
    : null,
)

function startEdit(payment: SaleDetailPayment) {
  editingPaymentId.value = payment.paymentId
  editingReference.value = payment.reference
  editingMethod.value = payment.method
}

function closeEdit() {
  editingPaymentId.value = null
  editingReference.value = null
  editingMethod.value = ''
}

function handleSubmit(payload: { reference: string | null }) {
  if (!editingPaymentId.value) return
  emit('submit', { paymentId: editingPaymentId.value, reference: payload.reference })
  closeEdit()
}

const TRUNCATE_AT = 20

function truncateReference(reference: string | null): string {
  if (!reference) return ''
  return reference.length > TRUNCATE_AT ? `${reference.slice(0, TRUNCATE_AT)}…` : reference
}

function isReferenceTruncated(reference: string | null): boolean {
  return !!reference && reference.length > TRUNCATE_AT
}
</script>

<template>
  <section class="space-y-2" data-testid="payments-list-section">
    <header class="flex items-center justify-between">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-muted">
        Pagos registrados
      </h3>
      <span v-if="!loading" class="text-xs text-muted" data-testid="payments-count">
        {{ payments.length }}
      </span>
    </header>

    <!-- Loading: one skeleton row per row we will render. The shape mirrors
         the real table so layout does not jump when data arrives. -->
    <div v-if="loading" class="space-y-2" data-testid="payments-list-skeleton">
      <USkeleton v-for="row in 3" :key="row" class="h-12 w-full rounded-lg" />
    </div>

    <!-- Empty state: when no payments AND not loading, render a subtle hint
         (per spec — NOT a placeholder card). -->
    <p
      v-else-if="payments.length === 0"
      class="text-sm text-muted"
      data-testid="payments-list-empty"
    >
      Sin pagos registrados
    </p>

    <!-- Real list -->
    <ul v-else class="space-y-2" data-testid="payments-list">
      <li
        v-for="payment in payments"
        :key="payment.paymentId"
        class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
        :data-testid="`payment-row-${payment.paymentId}`"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <UIcon :name="getMethodMeta(payment.method).icon" class="size-4 text-muted" />
            <span class="font-semibold text-highlighted">
              {{ getMethodMeta(payment.method).label }}
            </span>
          </div>

          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span class="tabular-nums">{{ formatSaleDate(payment.paidAt) }}</span>
            <UTooltip
              v-if="payment.reference"
              :text="payment.reference"
              :disabled="!isReferenceTruncated(payment.reference)"
            >
              <span
                class="font-mono tabular-nums"
                :data-testid="`payment-reference-${payment.paymentId}`"
              >
                {{ truncateReference(payment.reference) }}
              </span>
            </UTooltip>
            <span v-else class="italic">Sin referencia</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="font-semibold tabular-nums" :data-testid="`payment-amount-${payment.paymentId}`">
            {{ formatCentsMXN(payment.amountCents) }}
          </span>
          <UButton
            v-if="shouldShowEditReference(payment)"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-pencil"
            :disabled="loading"
            :data-testid="`payment-edit-${payment.paymentId}`"
            aria-label="Editar referencia"
            @click="startEdit(payment)"
          />
        </div>
      </li>
    </ul>

    <EditReferenceSlideover
      v-if="editingPayment"
      :open="editingPaymentId !== null"
      :current-reference="editingReference"
      :payment-method="editingMethod"
      :loading="loading"
      data-testid="payments-list-edit-slideover"
      @update:open="(open) => !open && closeEdit()"
      @submit="handleSubmit"
    />
  </section>
</template>