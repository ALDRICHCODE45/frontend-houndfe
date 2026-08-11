<script setup lang="ts">
import { computed } from 'vue'
import type { ConfirmedSaleRow } from '../interfaces/sale.types'
import { SALE_STATUS } from '../constants/sale.constants'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { formatSaleDate, formatSaleDueDate } from '../utils/saleDate.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { getDeliveryStatusBadge } from '../utils/saleStatus.utils'
import { formatPaymentMethod } from '../utils/salePaymentMethod.utils'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'

const props = defineProps<{ sale: ConfirmedSaleRow }>()

const emit = defineEmits<{
  click: [sale: ConfirmedSaleRow]
}>()

const customerName = computed(() => props.sale.customer?.name ?? 'Público en General')
const hasDebt = computed(() => props.sale.debtCents > 0)
const firstPaymentMethod = computed(() => props.sale.paymentMethods[0] ?? null)

function statusColor(status: ConfirmedSaleRow['status']) {
  if (status === SALE_STATUS.CONFIRMED) return 'success'
  if (status === SALE_STATUS.DRAFT) return 'warning'
  return 'error'
}

const deliveryBadge = computed(() => getDeliveryStatusBadge(props.sale.deliveryStatus))
const showStatusDot = computed(() => props.sale.status === SALE_STATUS.CONFIRMED)
</script>

<template>
  <article
    class="group relative flex min-h-[220px] cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    @click="emit('click', sale)"
  >
    <div class="flex flex-col items-start gap-3">
      <EntityAvatar
        :name="customerName"
        :seed="sale.id"
        :show-dot="showStatusDot"
        size="lg"
      />

      <div class="min-w-0 space-y-1 pr-7">
        <p class="truncate text-sm font-semibold leading-tight text-highlighted">
          {{ customerName }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">
          Folio #{{ extractFolioNumber(sale.folio) }}
        </p>
      </div>

      <div class="flex min-h-6 flex-wrap items-center gap-1.5">
        <StatusDotBadge
          :tone="statusColor(sale.status)"
          :label="sale.status"
          compact
        />
        <StatusDotBadge
          :tone="deliveryBadge.color"
          :label="deliveryBadge.label"
          compact
        />
      </div>
    </div>

    <div class="my-3 border-t border-dashed border-default" />

    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Total</p>
        <p class="mt-1 truncate font-semibold text-default">{{ formatCentsMXN(sale.totalCents) }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Fecha</p>
        <p class="mt-1 truncate font-medium text-default">{{ formatSaleDate(sale.confirmedAt) }}</p>
      </div>
      <div class="min-w-0">
        <p class="text-muted">Cliente</p>
        <p class="mt-1 truncate font-medium text-default">{{ customerName }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Método</p>
        <p class="mt-1 truncate font-medium text-default">
          {{ firstPaymentMethod ? formatPaymentMethod(firstPaymentMethod) : 'Sin método' }}
        </p>
      </div>
    </div>

    <div
      v-if="hasDebt"
      data-testid="sale-card-debt"
      class="mt-2 flex items-center justify-between text-warning"
    >
      <p>{{ formatCentsMXN(sale.debtCents) }}</p>
      <p
        v-if="sale.dueDate"
        data-testid="sale-card-due-date"
        class="text-xs"
      >
        Vence: {{ formatSaleDueDate(sale.dueDate) }}
      </p>
    </div>
  </article>
</template>
