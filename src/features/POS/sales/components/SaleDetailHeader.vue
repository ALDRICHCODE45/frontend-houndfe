<script setup lang="ts">
import { computed } from 'vue'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { getDeliveryStatusBadge, getPaymentStatusBadge } from '../utils/saleStatus.utils'
import type { SaleDetail } from '../interfaces/sale.types'

const props = defineProps<{
  sale: SaleDetail
  actionItems: Array<{ label: string; icon: string; disabled: boolean }>
}>()

const emit = defineEmits<{
  back: []
}>()

const deliveryBadge = computed(() => getDeliveryStatusBadge(props.sale.deliveryStatus))
const paymentBadge = computed(() => props.sale.paymentStatus ? getPaymentStatusBadge(props.sale.paymentStatus) : null)
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="emit('back')">
        Volver
      </UButton>
      <h1 class="text-2xl font-bold">Venta {{ extractFolioNumber(sale.folio) }}</h1>
      <UBadge :color="deliveryBadge.color" variant="soft" data-testid="badge">
        {{ deliveryBadge.label }}
      </UBadge>
      <UBadge v-if="paymentBadge" :color="paymentBadge.color" variant="soft" data-testid="badge">
        {{ paymentBadge.label }}
      </UBadge>
    </div>
    
    <UDropdownMenu :items="actionItems">
      <UTooltip text="Funcionalidad próximamente">
        <UButton trailing-icon="i-lucide-chevron-down" variant="outline">
          Más Acciones
        </UButton>
      </UTooltip>
    </UDropdownMenu>
  </div>
</template>