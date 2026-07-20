<script setup lang="ts">
import { computed } from 'vue'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { getDeliveryStatusBadge, getPaymentStatusBadge } from '../utils/saleStatus.utils'
import { SALE_STATUS } from '../constants/sale.constants'
import type { SaleDetail } from '../interfaces/sale.types'

const props = defineProps<{
  sale: SaleDetail
  actionItems: Array<{
    label: string
    icon: string
    disabled: boolean
    loading?: boolean
    onSelect?: (event: Event) => void
  }>
}>()

const emit = defineEmits<{
  back: []
}>()

const deliveryBadge = computed(() => getDeliveryStatusBadge(props.sale.deliveryStatus))
const paymentBadge = computed(() => props.sale.paymentStatus ? getPaymentStatusBadge(props.sale.paymentStatus) : null)
// sales-pdf-download: show the dropdown whenever there are items, regardless
// of enabled state — the user must see disabled PDF entries on DRAFT sales
// so the trigger tooltip can explain why they're unavailable (R1).
const hasAnyAction = computed(() => props.actionItems.length > 0)
// sales-pdf-download: only DRAFT has visible-but-disabled PDF entries, so
// that's the only status that needs the "Solo disponible para ventas
// confirmadas" tooltip on the trigger button. CONFIRMED → no tooltip.
const triggerTooltipText = computed(() =>
  props.sale.status === SALE_STATUS.DRAFT ? 'Solo disponible para ventas confirmadas' : null,
)
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="emit('back')">
        Volver
      </UButton>
      <h1 class="text-2xl font-bold text-highlighted">Venta {{ extractFolioNumber(sale.folio) }}</h1>
      <UBadge :color="deliveryBadge.color" size="sm" variant="soft" data-testid="badge">
        {{ deliveryBadge.label }}
      </UBadge>
      <UBadge v-if="paymentBadge" :color="paymentBadge.color" size="sm" variant="soft" data-testid="badge">
        {{ paymentBadge.label }}
      </UBadge>
    </div>

    <UDropdownMenu v-if="hasAnyAction" :items="actionItems">
      <UTooltip v-if="triggerTooltipText" :text="triggerTooltipText">
        <UButton trailing-icon="i-lucide-chevron-down" variant="outline">
          Más Acciones
        </UButton>
      </UTooltip>
      <template v-else>
        <UButton trailing-icon="i-lucide-chevron-down" variant="outline">
          Más Acciones
        </UButton>
      </template>
    </UDropdownMenu>
  </div>
</template>
