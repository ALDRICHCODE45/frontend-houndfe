<script setup lang="ts">
/**
 * PaymentDetailCardGrid — sdd payment-details-admin S3 (design.md §10)
 *
 * Single presentational component: renders skeleton / empty / grid states,
 * and INLINES the per-card markup (no separate `PaymentDetailCard.vue` —
 * that abstraction was removed in the compact rerun).
 *
 * Props / emits contract:
 *   - paymentDetails — array of rows (current page slice from the wrapper).
 *   - loading? — while true, renders 8 skeleton cards.
 *   - empty? — text shown inside the empty-state block.
 *   - emits(card-click, row) — forwarded back to the parent view, which
 *     opens the edit slideover (guarded by `canUpdatePaymentDetail`).
 *
 * The component is purely presentational. No mutation logic, no permission
 * checks, no i18n lookups — it just renders and forwards.
 */
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import {
  paymentDetailStatusLabel,
  type PaymentDetailTableRow,
} from '../interfaces/payment-detail.types'

const props = withDefaults(
  defineProps<{
    paymentDetails: PaymentDetailTableRow[]
    loading?: boolean
    empty?: string
  }>(),
  {
    loading: false,
    empty: 'No hay cuentas bancarias',
  },
)

const emit = defineEmits<{
  'card-click': [paymentDetail: PaymentDetailTableRow]
}>()

function statusTone(row: PaymentDetailTableRow) {
  return activityToBadgeTone(row.isActive)
}
</script>

<template>
  <div
    v-if="props.loading"
    data-testid="card-grid-skeleton"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <div
      v-for="i in 8"
      :key="i"
      data-testid="card-skeleton"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <div
    v-else-if="!props.paymentDetails.length"
    data-testid="card-grid-empty"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-credit-card" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ props.empty }}</p>
  </div>

  <div
    v-else
    data-testid="card-grid"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <article
      v-for="paymentDetail in props.paymentDetails"
      :key="paymentDetail.id"
      class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      data-testid="payment-detail-card"
      @click="emit('card-click', paymentDetail)"
    >
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p
            class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted"
            :data-testid="`card-bankName-${paymentDetail.id}`"
          >
            {{ paymentDetail.bankName }}
          </p>
          <p
            class="line-clamp-1 text-xs text-muted"
            :data-testid="`card-beneficiary-${paymentDetail.id}`"
          >
            {{ paymentDetail.beneficiary }}
          </p>
          <div class="flex min-h-6 flex-wrap items-center gap-1.5 pt-1">
            <StatusDotBadge
              :tone="statusTone(paymentDetail)"
              :label="paymentDetailStatusLabel(paymentDetail.isActive)"
              compact
            />
          </div>
        </div>
      </div>

      <div class="my-3 border-t border-dashed border-default" />

      <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div class="min-w-0">
          <p class="text-muted">CLABE</p>
          <p
            class="mt-1 truncate font-medium text-default"
            :data-testid="`card-clabe-${paymentDetail.id}`"
          >
            {{ paymentDetail.clabe }}
          </p>
        </div>
        <div class="min-w-0 text-right">
          <p class="text-muted">Número de cuenta</p>
          <p
            class="mt-1 truncate font-semibold text-default"
            :data-testid="`card-accountNumber-${paymentDetail.id}`"
          >
            {{ paymentDetail.accountNumber }}
          </p>
        </div>
      </div>
    </article>
  </div>
</template>
