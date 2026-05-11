<script setup lang="ts">
import type { SalesListCounts, SaleDeliveryStatus } from '../interfaces/sale.types'

withDefaults(
  defineProps<{
    counts?: SalesListCounts
  }>(),
  {
    counts: () => ({ all: 0, pendingPayments: 0, notDelivered: 0 }),
  },
)

const emit = defineEmits<{
  change: [status: SaleDeliveryStatus | undefined]
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <UButton
      variant="soft"
      color="neutral"
      data-testid="sales-tab-all"
      @click="emit('change', undefined)"
    >
      Todas ({{ counts.all }})
    </UButton>

    <UButton
      variant="soft"
      color="neutral"
      data-testid="sales-tab-pending-delivery"
      @click="emit('change', 'PENDING')"
    >
      No Entregadas ({{ counts.notDelivered }})
    </UButton>
  </div>
</template>
