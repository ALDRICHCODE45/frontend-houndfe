<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'

/**
 * PCA-2 — dedicated modal shown after a `PROMO_CAPACITY_RE_QUOTE` (409).
 *
 * The backend recalculated the promotion eligibility during `charge`, so the
 * charge did NOT happen. This modal presents the authoritative server totals
 * for the refetched draft and lists the excluded promotions as no longer
 * applicable. Confirming only marks the new quote as accepted — it never
 * charges; the cashier must return to the payment modal and click the
 * existing charge action again (with a fresh idempotency key).
 */
export interface ExcludedPromotion {
  id: string
  label: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    subtotalCents: number
    discountCents: number
    totalCents: number
    excludedPromotions?: ExcludedPromotion[]
  }>(),
  {
    excludedPromotions: () => [],
  },
)

const emit = defineEmits<{
  accept: []
}>()

const excluded = computed(() => props.excludedPromotions)
const subtotalFormatted = computed(() => formatCentsMXN(props.subtotalCents))
const discountFormatted = computed(() => formatCentsMXN(props.discountCents))
const totalFormatted = computed(() => formatCentsMXN(props.totalCents))

function handleAccept() {
  emit('accept')
}
</script>

<template>
  <UModal
    :open="open"
    :dismissible="false"
    :close="false"
    title="Actualizamos los totales de tu venta"
    description="El cupo de una promoción cambió al confirmar el cobro. Revisá los nuevos importes antes de volver a cobrar."
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div data-testid="requote-modal" class="space-y-4">
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="El cupo de una promoción cambió"
          description="Recalculamos la venta con la disponibilidad actual. El cobro anterior no se realizó."
        />

        <dl class="space-y-2 rounded-xl border border-default bg-elevated px-4 py-3 text-sm">
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted">Subtotal</dt>
            <dd data-testid="requote-subtotal" class="font-semibold tabular-nums text-highlighted">
              {{ subtotalFormatted }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted">Descuento</dt>
            <dd data-testid="requote-discount" class="font-semibold tabular-nums text-highlighted">
              {{ discountFormatted }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 border-t border-default pt-2">
            <dt class="font-semibold text-highlighted">Total</dt>
            <dd data-testid="requote-total" class="text-lg font-bold tabular-nums text-highlighted">
              {{ totalFormatted }}
            </dd>
          </div>
        </dl>

        <div v-if="excluded.length > 0" class="space-y-2" data-testid="requote-excluded">
          <p class="text-sm font-semibold text-highlighted">Promociones que ya no aplican</p>
          <ul class="space-y-2" data-testid="requote-excluded-list">
            <li
              v-for="promotion in excluded"
              :key="promotion.id"
              data-testid="requote-excluded-promotion"
              class="flex items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2"
            >
              <span data-testid="requote-excluded-label" class="text-sm text-highlighted">
                {{ promotion.label }}
              </span>
              <UBadge color="warning" variant="soft" data-testid="requote-excluded-status">
                Ya no aplicable
              </UBadge>
            </li>
          </ul>
        </div>

        <p class="text-xs text-muted">Revisá los pagos y confirmá el cobro nuevamente.</p>
      </div>
    </template>

    <template #footer>
      <div
        data-testid="requote-footer"
        class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3"
      >
        <UButton
          data-testid="requote-accept"
          color="primary"
          class="w-full justify-center rounded-xl font-semibold shadow-sm sm:w-auto !bg-(--brand-action) !text-black hover:!brightness-110"
          @click="handleAccept"
        >
          Entendido, revisar pagos
        </UButton>
      </div>
    </template>
  </UModal>
</template>
