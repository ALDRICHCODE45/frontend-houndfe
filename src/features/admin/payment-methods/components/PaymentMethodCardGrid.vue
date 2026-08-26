<script setup lang="ts">
/**
 * PaymentMethodCardGrid — sdd custom-payment-methods S3B (design §10)
 *
 * Single presentational component: renders skeleton / empty / grid states,
 * and INLINES the per-card markup (no separate `PaymentMethodCard.vue` —
 * mirrors the PaymentDetailCardGrid precedent).
 *
 * Props / emits contract:
 *   - paymentMethods — array of rows (current page slice from the wrapper).
 *   - loading? — while true, renders 8 skeleton cards.
 *   - empty? — text shown inside the empty-state block.
 *   - emits(card-click, row) — forwarded back to the parent view, which
 *     opens the edit slideover (guarded by `canUpdatePaymentMethod`).
 *
 * The component is purely presentational. No mutation logic, no permission
 * checks, no i18n lookups — it just renders and forwards.
 */
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import {
  paymentMethodStatusLabel,
  type PaymentMethodTableRow,
} from '../interfaces/payment-method.types'
import { PAYMENT_METHOD_CATEGORY_LABELS, type PaymentMethodCategory } from '@/core/shared/constants/payment-method-category'

const props = withDefaults(
  defineProps<{
    paymentMethods: PaymentMethodTableRow[]
    loading?: boolean
    empty?: string
  }>(),
  {
    loading: false,
    empty: 'No hay métodos de cobro',
  },
)

const emit = defineEmits<{
  'card-click': [paymentMethod: PaymentMethodTableRow]
}>()

function statusTone(row: PaymentMethodTableRow) {
  return activityToBadgeTone(row.isActive)
}

function categoryLabel(category: string): string {
  return PAYMENT_METHOD_CATEGORY_LABELS[category as PaymentMethodCategory] ?? category
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
      class="h-40 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <div
    v-else-if="!props.paymentMethods.length"
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
      v-for="paymentMethod in props.paymentMethods"
      :key="paymentMethod.id"
      class="group relative flex cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      data-testid="payment-method-card"
      @click="emit('card-click', paymentMethod)"
    >
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p
            class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted"
            :data-testid="`card-name-${paymentMethod.id}`"
          >
            {{ paymentMethod.name }}
          </p>
          <p
            class="line-clamp-1 text-xs text-muted"
            :data-testid="`card-subtitle-${paymentMethod.id}`"
          >
            {{ paymentMethod.subtitle ?? '—' }}
          </p>
          <p class="line-clamp-1 text-xs text-muted">
            {{ categoryLabel(paymentMethod.category) }}
          </p>
          <div class="flex min-h-6 flex-wrap items-center gap-1.5 pt-1">
            <StatusDotBadge
              :tone="statusTone(paymentMethod)"
              :label="paymentMethodStatusLabel(paymentMethod.isActive)"
              compact
            />
          </div>
        </div>
      </div>
    </article>
  </div>
</template>