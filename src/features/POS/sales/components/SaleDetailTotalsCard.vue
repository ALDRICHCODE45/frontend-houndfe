<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'

const props = defineProps<{
  subtotalCents: number
  discountCents: number
  totalCents: number
  paidCents: number
  debtCents: number
  changeDueCents: number
  canRegisterPayment?: boolean
  isPaymentSubmitting?: boolean
}>()

const emit = defineEmits<{
  'register-payment': []
}>()

// Discount is a positive number coming from the backend (e.g. 14000 ==
// $140.00). We render it with a leading minus so it reads as a deduction,
// matching the POS draft footer convention ("Descuentos -$140.00").
const discountLabel = computed(() => `-${formatCentsMXN(props.discountCents)}`)

// Deuda is colored when there is an outstanding balance; otherwise green
// to mirror the "pagada en su totalidad" success semantic that the
// financial card used to render.
const debtClass = computed(() =>
  props.debtCents > 0 ? 'text-error-600' : 'text-success-600',
)

const showChangeRow = computed(() => props.changeDueCents > 0)
</script>

<template>
  <section class="space-y-2">
    <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">Totales</h3>

    <div class="space-y-2 text-right">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Subtotal</span>
        <span data-testid="totals-subtotal-value">{{ formatCentsMXN(subtotalCents) }}</span>
      </div>
      <div
        v-if="discountCents > 0"
        data-testid="totals-discount-row"
        class="flex items-center justify-between text-sm"
      >
        <span class="text-muted">Descuentos</span>
        <span data-testid="totals-discount-value">{{ discountLabel }}</span>
      </div>

      <USeparator />

      <div class="flex items-center justify-between">
        <span class="text-muted">Total</span>
        <span class="text-2xl font-bold" data-testid="totals-total-value">
          {{ formatCentsMXN(totalCents) }}
        </span>
      </div>

      <USeparator />

      <div class="flex items-center justify-between text-sm" data-testid="totals-paid-row">
        <span class="text-muted">Pagado</span>
        <span>{{ formatCentsMXN(paidCents) }}</span>
      </div>
      <div class="flex items-center justify-between text-sm" data-testid="totals-debt-row">
        <span class="text-muted">Deuda</span>
        <span :class="debtClass" class="font-semibold">
          {{ formatCentsMXN(debtCents) }}
        </span>
      </div>
      <div
        v-if="showChangeRow"
        class="flex items-center justify-between text-sm"
        data-testid="totals-change-row"
      >
        <span class="text-muted">Cambio</span>
        <span>{{ formatCentsMXN(changeDueCents) }}</span>
      </div>

      <div v-if="canRegisterPayment" class="pt-2">
        <UButton
          block
          icon="i-lucide-credit-card"
          data-testid="register-debt-payment"
          :disabled="isPaymentSubmitting"
          @click="emit('register-payment')"
        >
          Registrar Pago
        </UButton>
      </div>
    </div>
  </section>
</template>